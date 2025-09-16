// ======================================================================
//        USER-SERVICE.JS (VERSÃO FINAL COM LÓGICA DE ACESSO CORRIGIDA)
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
// ======================================================================

export async function verificarAcesso() {
    // Se já temos um perfil na sessão, retorna imediatamente.
    if (cachedSessionProfile) return cachedSessionProfile;
    // Se uma verificação já está em andamento, aguarda por ela.
    if (activeAccessCheckPromise) return activeAccessCheckPromise;

    // CORREÇÃO ANTI-PISCA: Toda a lógica é encapsulada em uma única promessa.
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
            const isAdmin = user.uid === ADMIN_UID;

            // 3. FLUXO PARA TODOS OS USUÁRIOS (INCLUINDO ADMIN)
            await ensureUserAndTrialDoc(user);
            const empresas = await getEmpresasAtivasDoUsuario(user);

            if (empresas.length === 0 && !isAdmin) {
                if (currentPage !== 'selecionar-empresa.html') {
                    window.location.replace('selecionar-empresa.html');
                }
                return reject(new Error("Novo usuário. Exibindo tela de boas-vindas."));
            }

            let empresaAtivaId = localStorage.getItem('empresaAtivaId');

            // Se tem múltiplas empresas ativas e empresa ativa não está entre elas, força seleção
            if (empresas.length > 1 && (!empresaAtivaId || !empresas.find(e => e.id === empresaAtivaId))) {
                localStorage.removeItem('empresaAtivaId');
                if (currentPage !== 'selecionar-empresa.html') {
                    window.location.replace('selecionar-empresa.html');
                }
                return reject(new Error("Múltiplas empresas. Seleção necessária."));
            }

            // Se só tem uma empresa ativa, define como ativa
            if (empresas.length === 1) {
                empresaAtivaId = empresas[0].id;
                localStorage.setItem('empresaAtivaId', empresaAtivaId);
            }

            // Se está na seleção e já tem empresa ativa, vai para o painel
            if (empresaAtivaId && currentPage === 'selecionar-empresa.html') {
                window.location.replace('index.html');
                return reject(new Error("Redirecionando para o painel principal."));
            }

            // Admin sem empresa ativa: perfil especial
            if (!empresaAtivaId && isAdmin) {
                const adminProfile = {
                    user,
                    empresaId: null,
                    perfil: { nome: "Administrador", papel: "admin" },
                    isOwner: true,
                    isAdmin: true,
                    papel: 'admin',
                    empresas: []
                };
                cachedSessionProfile = adminProfile;
                return resolve(adminProfile);
            }

            // Se não tem empresa ativa, obriga escolher
            if (!empresaAtivaId) {
                window.location.replace('selecionar-empresa.html');
                return reject(new Error("Nenhuma empresa ativa encontrada."));
            }

            // 4. VALIDA A EMPRESA ATIVA E A ASSINATURA
            const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
            if (!empresaDoc.exists() || empresaDoc.data().ativa === false) {
                localStorage.removeItem('empresaAtivaId');
                window.location.replace('selecionar-empresa.html');
                return reject(new Error("Empresa ativa não encontrada no DB ou está desativada."));
            }

            const empresaData = empresaDoc.data();
            // ✅ AQUI A MÁGICA ACONTECE: CHAMAMOS A FUNÇÃO CORRIGIDA
            const statusAssinatura = await checkUserStatus(user, empresaData);

            // ✅ E ANEXAMOS O RESULTADO COMPLETO AO PERFIL PARA USO POSTERIOR
            empresaData.statusAssinatura = statusAssinatura;

            // A verificação de assinatura só acontece se o usuário NÃO for admin.
            if (!isAdmin && !statusAssinatura.hasActivePlan && !statusAssinatura.isTrialActive && currentPage !== 'assinatura.html') {
                window.location.replace('assinatura.html');
                return reject(new Error("Assinatura expirada."));
            }

            // 5. CONSTRÓI E RETORNA O PERFIL FINAL DA SESSÃO
            const sessionProfile = await buildSessionProfile(user, empresaAtivaId, empresaData, empresas);
            cachedSessionProfile = sessionProfile;
            resolve(sessionProfile);

        } catch (error) {
            reject(error);
        } finally {
            // A variável 'isProcessing' foi removida pois 'activeAccessCheckPromise' já faz esse controle.
            activeAccessCheckPromise = null;
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
async function buildSessionProfile(user, empresaId, empresaData, empresasAtivasDoUsuario) {
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
        papel,
        empresas: empresasAtivasDoUsuario
    };
}

/** Limpa o cache ao fazer logout. */
export function clearCache() {
    cachedSessionProfile = null;
    activeAccessCheckPromise = null; // Limpa a promessa também
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

/** ✅ Verifica o status da assinatura/trial (VERSÃO COMPLETA E CORRIGIDA) */
async function checkUserStatus(user, empresaData) {
    const defaultReturn = { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
    try {
        // REGRA 1: O Admin Global sempre tem acesso total.
        if (user.uid === ADMIN_UID) {
            return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };
        }

        let hasActivePlan = false;
        let isTrialActive = false;
        let trialDaysRemaining = 0;

        // REGRA 2: Verifica se a EMPRESA tem um plano pago.
        if (empresaData && empresaData.plano && empresaData.plano !== 'free') {
            hasActivePlan = true;
        }

        // REGRA 3: Verifica se o USUÁRIO individual tem a flag 'isPremium'.
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().isPremium === true) {
            hasActivePlan = true;
        }

        // REGRA 4: Calcula os dias de trial, independentemente de ter um plano pago.
        if (userSnap.exists() && userSnap.data().trialStart?.seconds) {
            const trialDurationDays = empresaData?.freeEmDias ?? 15;
            const startDate = new Date(userSnap.data().trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);

            const hoje = new Date();
            endDate.setHours(23, 59, 59, 999);
            hoje.setHours(0, 0, 0, 0);

            if (endDate >= hoje) {
                isTrialActive = true;
                const diffTime = endDate.getTime() - hoje.getTime();
                trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        } else if (!userSnap.exists()) {
            // Se o documento do usuário ainda não existe, ele está no primeiro acesso.
            isTrialActive = true;
            trialDaysRemaining = empresaData?.freeEmDias ?? 15;
        }

        // Retorna o objeto completo com todas as informações.
        return { hasActivePlan, isTrialActive, trialDaysRemaining };

    } catch (error) {
        console.error("❌ Erro em checkUserStatus:", error);
        return defaultReturn;
    }
}

/** Busca SOMENTE empresas ATIVAS associadas ao usuário. */
export async function getEmpresasAtivasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();
    try {
        // Busca empresas em que o usuário é DONO e estão ativas
        const qDono = query(collection(db, "empresarios"),
            where("donoId", "==", user.uid),
            where("ativa", "==", true)
        );
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            if (!empresasEncontradas.has(doc.id)) {
                empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    } catch (e) { console.error("❌ Erro ao buscar empresas ativas (dono):", e); }
    try {
        // Busca empresas em que o usuário é FUNCIONÁRIO e estão ativas
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && mapaSnap.data().empresas?.length > 0) {
            const idsDeEmpresas = mapaSnap.data().empresas;
            const empresasRef = collection(db, "empresarios");
            const q = query(empresasRef,
                where(documentId(), "in", idsDeEmpresas),
                where("ativa", "==", true)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                if (!empresasEncontradas.has(doc.id)) {
                    empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
        }
    } catch (e) { console.error("❌ Erro ao buscar empresas ativas (mapa):", e); }
    return Array.from(empresasEncontradas.values());
}
