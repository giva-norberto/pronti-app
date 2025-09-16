// ======================================================================
//        USER-SERVICE.JS (VERSÃO FINAL COM LÓGICA DE ACESSO CENTRALIZADA)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// --- Variáveis de Controle ---
let cachedSessionProfile = null;
let activeAccessCheckPromise = null; // Evita múltiplas verificações simultâneas
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// ======================================================================
// FUNÇÃO PRINCIPAL: O GUARDA DE ACESSO ÚNICO
// Esta função é a única fonte da verdade sobre o acesso do usuário.
// ======================================================================

export async function verificarAcesso() {
    // Se já temos um perfil na sessão, retorna imediatamente.
    if (cachedSessionProfile) return cachedSessionProfile;
    // Se uma verificação já está em andamento, aguarda por ela.
    if (activeAccessCheckPromise) return activeAccessCheckPromise;

    // ✅ CORREÇÃO ANTI-PISCA: Toda a lógica é encapsulada em uma única promessa.
    // Nenhuma página continuará a carregar até que esta promessa seja resolvida ou rejeitada.
    activeAccessCheckPromise = new Promise(async (resolve, reject) => {
        try {
            // 1. VERIFICA O USUÁRIO ATUAL
            const user = await getCurrentUser();
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const publicPages = ['login.html', 'cadastro.html', 'recuperar-senha.html'];

            if (!user) {
                if (!publicPages.includes(currentPage)) {
                    window.location.replace('login.html');
                }
                return reject(new Error("Usuário não autenticado."));
            }

            // 2. VERIFICA SE É O ADMIN (REGRA DE EXCEÇÃO)
            if (user.uid === ADMIN_UID) {
                const adminProfile = {
                    user, empresaId: null, perfil: { nome: "Administrador", papel: "admin" },
                    isOwner: true, isAdmin: true, papel: 'admin'
                };
                cachedSessionProfile = adminProfile;
                return resolve(adminProfile);
            }

            // 3. FLUXO PARA USUÁRIOS NORMAIS
            await ensureUserAndTrialDoc(user);
            const empresas = await getEmpresasDoUsuario(user);

            // Se não tem empresa ou tem mais de uma, o lugar dele é na tela de seleção.
            if (empresas.length !== 1 && currentPage !== 'selecionar-empresa.html') {
                window.location.replace('selecionar-empresa.html');
                return reject(new Error("Seleção de empresa necessária."));
            }

            // Se tem uma empresa e está na tela de seleção, vai para o início.
            if (empresas.length === 1 && currentPage === 'selecionar-empresa.html') {
                localStorage.setItem('empresaAtivaId', empresas[0].id);
                window.location.replace('index.html');
                return reject(new Error("Redirecionando para o painel principal."));
            }
            
            // Se chegou aqui, ele tem 1 empresa e está numa página interna.
            const empresaAtivaId = empresas.length === 1 ? empresas[0].id : localStorage.getItem('empresaAtivaId');

            if (!empresaAtivaId) {
                 window.location.replace('selecionar-empresa.html');
                 return reject(new Error("Nenhuma empresa ativa encontrada."));
            }

            // 4. VALIDA A EMPRESA ATIVA E A ASSINATURA
            const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
            if (!empresaDoc.exists()) {
                localStorage.removeItem('empresaAtivaId');
                window.location.replace('selecionar-empresa.html');
                return reject(new Error("Empresa ativa não encontrada no DB."));
            }

            const empresaData = empresaDoc.data();
            const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);

            if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                window.location.replace('assinatura.html');
                return reject(new Error("Assinatura expirada."));
            }

            // 5. CONSTRÓI E RETORNA O PERFIL FINAL DA SESSÃO
            const sessionProfile = await buildSessionProfile(user, empresaAtivaId, empresaData);
            cachedSessionProfile = sessionProfile;
            resolve(sessionProfile);

        } catch (error) {
            reject(error); // A promessa é rejeitada, parando a execução de quem a chamou.
        } finally {
            activeAccessCheckPromise = null; // Reseta o controle para a próxima navegação.
        }
    });

    return activeAccessCheckPromise;
}

// ======================================================================
// FUNÇÕES AUXILIARES (REVISADAS E COMPLETAS)
// ======================================================================

/** Transforma o onAuthStateChanged em uma promessa para ser usada com await. */
function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            unsubscribe();
            resolve(user);
        }, reject);
    });
}

/** Constrói o objeto de sessão detalhado. */
async function buildSessionProfile(user, empresaId, empresaData) {
    const isAdmin = user.uid === ADMIN_UID;
    const isOwner = empresaData.donoId === user.uid;
    let perfilDetalhado = empresaData;
    let papel = 'dono';

    if (!isOwner && !isAdmin) {
        const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
        if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
            localStorage.removeItem('empresaAtivaId');
            throw new Error("Acesso de profissional revogado ou inativo.");
        }
        perfilDetalhado = profSnap.data();
        papel = 'funcionario';
    }
    
    return { user, empresaId, perfil: perfilDetalhado, isOwner: isOwner || isAdmin, isAdmin, papel };
}

/** Limpa o cache ao fazer logout. */
export function clearCache() {
    cachedSessionProfile = null;
}

/** Garante que o documento do usuário exista. */
export async function ensureUserAndTrialDoc(user) {
    if (!user) return;
    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário', email: user.email || '',
                trialStart: serverTimestamp(), isPremium: false,
            });
        } else if (!userSnap.data().trialStart) {
            await updateDoc(userRef, { trialStart: serverTimestamp() });
        }
    } catch (error) { console.error("❌ Erro em ensureUserAndTrialDoc:", error); }
}

/** Verifica o status da assinatura/trial. */
async function checkUserStatus(user, empresaData) {
    try {
        if (user.uid === ADMIN_UID) return { hasActivePlan: true, isTrialActive: false };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
        const userData = userSnap.data();
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };
        let trialDurationDays = empresaData?.freeEmDias ?? 15;
        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);
        return { hasActivePlan: false, isTrialActive: endDate > new Date() };
    } catch (error) {
        console.error("❌ Erro em checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: true };
    }
}

/** Busca as empresas associadas ao usuário. */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();
    try {
        const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            if (!empresasEncontradas.has(doc.id)) {
                empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    } catch (e) { console.error("❌ Erro ao buscar empresas (dono):", e); }
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && mapaSnap.data().empresas?.length > 0) {
            const idsDeEmpresas = mapaSnap.data().empresas;
            const empresasRef = collection(db, "empresarios");
            const q = query(empresasRef, where(documentId(), "in", idsDeEmpresas));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                if (!empresasEncontradas.has(doc.id)) {
                    empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
        }
    } catch(e) { console.error("❌ Erro ao buscar empresas (mapa):", e); }
    return Array.from(empresasEncontradas.values());
}
