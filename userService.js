import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação desnecessária
let cachedSessionProfile = null;

// --- Funções Auxiliares (sem alterações) ---
export async function ensureUserAndTrialDoc() {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            nome: user.displayName || user.email,
            email: user.email,
            trialStart: serverTimestamp(),
            isPremium: false,
        });
    } else if (!userSnap.data().trialStart) {
        await updateDoc(userRef, {
            trialStart: serverTimestamp(),
        });
    }
}

async function checkUserStatus(user, empresaData) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
    const userData = userSnap.data();
    if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
    if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };
    let trialDurationDays = 15;
    if (empresaData && empresaData.freeEmDias !== undefined) {
        trialDurationDays = empresaData.freeEmDias;
    }
    const startDate = new Date(userData.trialStart.seconds * 1000);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + trialDurationDays);
    return { hasActivePlan: false, isTrialActive: endDate > new Date() };
}

// --- Nova Função Central de Verificação com DIAGNÓSTICO ---
async function hasAccessToCompany(user, empresaId) {
    console.log(`[DIAGNÓSTICO] A iniciar verificação para empresaId: ${empresaId}`);
    if (!user || !empresaId) {
        console.error("[DIAGNÓSTICO] Falha: Utilizador ou empresaId em falta.");
        return { hasAccess: false };
    }

    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);

        if (!empresaSnap.exists()) {
            console.error(`[DIAGNÓSTICO] Falha: A empresa com ID ${empresaId} não foi encontrada na base de dados.`);
            return { hasAccess: false, error: "empresa_nao_existe" };
        }
        console.log("[DIAGNÓSTICO] Sucesso: Documento da empresa encontrado.");

        const empresaData = empresaSnap.data();
        const isOwner = empresaData.donoId === user.uid;

        if (isOwner) {
            console.log("[DIAGNÓSTICO] Sucesso: O utilizador é o DONO da empresa.");
            return { hasAccess: true, isOwner: true, perfil: empresaData, empresaDoc: empresaSnap };
        }
        console.log("[DIAGNÓSTICO] Info: O utilizador não é o dono. A verificar se é um profissional...");

        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
        const profissionalSnap = await getDoc(profissionalRef);

        if (profissionalSnap.exists()) {
            console.log("[DIAGNÓSTICO] Sucesso: O utilizador existe na subcoleção 'profissionais'.");
            const profissionalData = profissionalSnap.data();
            if (profissionalData.status === 'ativo') {
                console.log("[DIAGNÓSTICO] Sucesso: O status do profissional é 'ativo'. Acesso concedido.");
                return { hasAccess: true, isOwner: false, perfil: profissionalData, empresaDoc: empresaSnap };
            } else {
                console.error(`[DIAGNÓSTICO] Falha: O status do profissional é '${profissionalData.status}', mas deveria ser 'ativo'.`);
                return { hasAccess: false };
            }
        } else {
            console.error("[DIAGNÓSTICO] Falha: O utilizador não foi encontrado como DONO nem como PROFISSIONAL nesta empresa.");
            return { hasAccess: false };
        }

    } catch (error) {
        console.error("[DIAGNÓSTICO] Falha: Ocorreu um erro de base de dados durante a verificação de acesso.", error);
        return { hasAccess: false };
    }
}


// ======================================================================
// FUNÇÃO PRINCIPAL REESCRITA PARA SER A ÚNICA FONTE DE VERDADE
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        return Promise.resolve(cachedSessionProfile);
    }

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            const currentPage = window.location.pathname.split('/').pop();
            const paginasPublicas = ['login.html', 'cadastro.html'];
            const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

            if (!user) {
                if (!paginasPublicas.includes(currentPage)) {
                    console.log("[AuthGuard] Utilizador não autenticado. A redirecionar para o login.");
                    window.location.replace('login.html');
                }
                return reject(new Error("Utilizador não autenticado."));
            }

            try {
                await ensureUserAndTrialDoc();

                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                if (user.uid === ADMIN_UID) {
                    cachedSessionProfile = { user, isAdmin: true, perfil: { nome: "Admin" }, isOwner: true, role: 'admin', empresaId: null };
                    return resolve(cachedSessionProfile);
                }

                let empresaAtivaId = localStorage.getItem('empresaAtivaId');

                if (!empresaAtivaId) {
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                        console.log("[AuthGuard] Nenhuma empresa ativa. A redirecionar para a seleção.");
                        window.location.replace('selecionar-empresa.html');
                        return reject(new Error("primeiro_acesso_ou_selecao"));
                    } else {
                         return reject(new Error("A aguardar ação do utilizador na página de configuração."));
                    }
                }

                const accessCheck = await hasAccessToCompany(user, empresaAtivaId);

                if (!accessCheck.hasAccess) {
                    // ########## ALTERAÇÃO PRINCIPAL AQUI ##########
                    console.error(`### ACESSO BLOQUEADO! ### O motivo do bloqueio está acima. A página será redirecionada em 10 segundos.`);
                    localStorage.removeItem('empresaAtivaId');
                    
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                         setTimeout(() => {
                            window.location.replace('selecionar-empresa.html');
                         }, 10000); // Pausa de 10 segundos
                    }
                    return reject(new Error("O acesso à empresa foi revogado. A aguardar redirecionamento."));
                }

                const empresaDocSnap = accessCheck.empresaDoc;
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaDocSnap.data());

                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("[AuthGuard] Assinatura expirada. A redirecionar.");
                    window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                const userProfile = {
                    user,
                    empresaId: empresaDocSnap.id,
                    perfil: accessCheck.perfil,
                    isOwner: accessCheck.isOwner,
                    isAdmin: false,
                    role: accessCheck.isOwner ? "dono" : "funcionario"
                };

                cachedSessionProfile = userProfile;
                return resolve(userProfile);

            } catch (error) {
                console.error("[AuthGuard] Erro final em verificarAcesso:", error);
                if (error.message.includes("autenticado") || error.message.includes("revogado") || error.message.includes("expirada") || error.message.includes("selecao") || error.message.includes("configuração")) {
                    return reject(error);
                }
                window.location.replace('login.html');
                return reject(new Error("Erro inesperado no acesso."));
            }
        });
    });
}
