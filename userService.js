// ======================================================================
//      USER-SERVICE.JS (VERSÃO FINAL, VALIDADA E ROBUSTA)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// --- Variáveis de Controle de Cache ---
let cachedSessionProfile = null;
let activeAccessCheckPromise = null;

// --- Constantes ---
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// ======================================================================
// FUNÇÃO PRINCIPAL: O NOVO "GUARDA DE ACESSO"
// Esta função centraliza toda a lógica de permissão e roteamento.
// ======================================================================

export async function verificarAcesso() {
    // Se já temos um perfil na sessão, retorna imediatamente.
    if (cachedSessionProfile) return cachedSessionProfile;
    // Se uma verificação já está em andamento, aguarda por ela para evitar chamadas duplicadas.
    if (activeAccessCheckPromise) return activeAccessCheckPromise;

    // ✅ CORREÇÃO CRÍTICA: Cria uma promessa que encapsula toda a lógica de verificação.
    activeAccessCheckPromise = new Promise(async (resolve, reject) => {
        try {
            // 1. ESPERAR PELO USUÁRIO
            const user = await getCurrentUser();
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const publicPages = ['login.html', 'cadastro.html', 'recuperar-senha.html'];

            if (!user) {
                // Se não há usuário e a página não é pública, redireciona para o login.
                if (!publicPages.includes(currentPage)) {
                    window.location.replace('login.html');
                }
                // Rejeita a promessa, pois não há sessão para criar.
                return reject(new Error("Usuário não autenticado."));
            }

            // A partir daqui, TEMOS um usuário.
            await ensureUserAndTrialDoc(user);

            // 2. COLETAR DADOS (EMPRESAS)
            const empresas = await getEmpresasDoUsuario(user);
            const empresaAtivaId = localStorage.getItem('empresaAtivaId');

            // 3. LÓGICA DE ROTEAMENTO CENTRALIZADA (DECIDIR PARA ONDE IR)
            // Esta é a mudança mais importante. A decisão é tomada em um só lugar.

            // Cenário A: Usuário não tem exatamente UMA empresa E não está na tela de seleção.
            if (empresas.length !== 1 && currentPage !== 'selecionar-empresa.html') {
                window.location.replace('selecionar-empresa.html');
                return reject(new Error("Seleção de empresa necessária."));
            }

            // Cenário B: Usuário tem exatamente UMA empresa, MAS está na tela de seleção.
            if (empresas.length === 1 && currentPage === 'selecionar-empresa.html') {
                localStorage.setItem('empresaAtivaId', empresas[0].id);
                window.location.replace('index.html');
                return reject(new Error("Redirecionando para o painel principal."));
            }
            
            // Se chegamos aqui, o usuário está em uma página interna e tem uma empresa ativa.
            const idDaEmpresaParaVerificar = empresas.length === 1 ? empresas[0].id : empresaAtivaId;

            if (!idDaEmpresaParaVerificar) {
                 window.location.replace('selecionar-empresa.html');
                 return reject(new Error("Nenhuma empresa ativa encontrada no fluxo."));
            }

            // 4. VALIDAR EMPRESA E ASSINATURA
            const empresaDoc = await getDoc(doc(db, "empresarios", idDaEmpresaParaVerificar));
            if (!empresaDoc.exists()) {
                localStorage.removeItem('empresaAtivaId');
                window.location.replace('selecionar-empresa.html');
                return reject(new Error("Empresa ativa não encontrada no banco de dados."));
            }

            const empresaData = empresaDoc.data();
            const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);

            if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                window.location.replace('assinatura.html');
                return reject(new Error("Assinatura ou período de teste expirado."));
            }

            // 5. CONSTRUIR O PERFIL DE SESSÃO
            const sessionProfile = await buildSessionProfile(user, idDaEmpresaParaVerificar, empresaData);
            
            // Armazena em cache e resolve a promessa, liberando o acesso.
            cachedSessionProfile = sessionProfile;
            resolve(sessionProfile);

        } catch (error) {
            // Se qualquer passo falhar, rejeita a promessa.
            // Apenas loga erros que não sejam de redirecionamento para não poluir o console.
            if (!error.message.includes("Redirecionando") && !error.message.includes("Seleção de empresa necessária")) {
                console.error("❌ Erro no fluxo de verificação de acesso:", error.message);
            }
            reject(error);
        } finally {
            // Limpa a promessa de verificação para permitir futuras checagens se necessário.
            activeAccessCheckPromise = null;
        }
    });

    return activeAccessCheckPromise;
}

// ======================================================================
// FUNÇÕES AUXILIARES (REVISADAS E COMPLETAS)
// ======================================================================

/** Transforma onAuthStateChanged em uma promessa para uso com async/await. */
function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            unsubscribe(); // Para de ouvir após obter a primeira resposta.
            resolve(user);
        }, reject);
    });
}

/** Constrói o objeto final da sessão do usuário. */
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
    
    return {
        user,
        empresaId,
        perfil: perfilDetalhado,
        isOwner: isOwner || isAdmin,
        isAdmin,
        papel
    };
}

/** Limpa o cache ao fazer logout. Essencial para trocar de usuário. */
export function clearCache() {
    cachedSessionProfile = null;
}

/** Cria o documento do usuário e de trial se não existirem. */
export async function ensureUserAndTrialDoc(user) {
    if (!user) return;
    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário',
                email: user.email || '',
                trialStart: serverTimestamp(),
                isPremium: false,
            });
        } else if (!userSnap.data().trialStart) {
            await updateDoc(userRef, {
                trialStart: serverTimestamp(),
            });
        }
    } catch (error) {
        console.error("❌ Erro em ensureUserAndTrialDoc:", error);
    }
}

/** Verifica se o usuário tem um plano ativo ou trial. */
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: true };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };
        let trialDurationDays = 15;
        if (empresaData && typeof empresaData.freeEmDias === 'number') {
            trialDurationDays = empresaData.freeEmDias;
        }
        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);
        return { hasActivePlan: false, isTrialActive: endDate > new Date() };
    } catch (error) {
        console.error("❌ Erro em checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: true };
    }
}

/** Busca todas as empresas associadas a um usuário. */
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
        if (mapaSnap.exists() && mapaSnap.data().empresas && mapaSnap.data().empresas.length > 0) {
            const idsDeEmpresas = mapaSnap.data().empresas;
            if (idsDeEmpresas.length === 0) return Array.from(empresasEncontradas.values());
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

/** (Função extra) Busca todas as empresas do sistema - útil para o painel de admin. */
export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
