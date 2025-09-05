// ======================================================================
//                      USERSERVICE.JS (VERSÃO FINAL CORRIGIDA E ESTÁVEL)
// ======================================================================

import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação desnecessária
let cachedSessionProfile = null;

// --- Funções Auxiliares ---
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

// ======================================================================
// FUNÇÃO PRINCIPAL COM A LÓGICA DE ROTEAMENTO CENTRALIZADA (CORRIGIDA E OTIMIZADA)
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        return Promise.resolve(cachedSessionProfile);
    }

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Garante que o listener rode apenas uma vez

            const currentPage = window.location.pathname.split('/').pop();
            const paginasPublicas = ['login.html', 'cadastro.html'];
            const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

            // --- 1. Usuário não logado ---
            if (!user) {
                if (!paginasPublicas.includes(currentPage)) {
                    console.log("[AuthGuard] Usuário não logado. Redirecionando para login.");
                    window.location.replace('login.html');
                }
                return reject(new Error("Utilizador não autenticado."));
            }

            try {
                await ensureUserAndTrialDoc();

                // --- 2. Admin ---
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                if (user.uid === ADMIN_UID) {
                    cachedSessionProfile = { user, isAdmin: true, perfil: { nome: "Admin" }, isOwner: true, role: 'admin' };
                    return resolve(cachedSessionProfile);
                }

                // --- 3. Obter empresaId do mapaUsuarios (fonte primária para todos os usuários) ---
                const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
                let empresaAssociadaAoUsuario = null;

                if (mapaSnap.exists()) {
                    empresaAssociadaAoUsuario = mapaSnap.data().empresaId;
                }

                // --- 4. Lógica de seleção de empresa ---
                let empresaAtivaIdNoLocalStorage = localStorage.getItem('empresaAtivaId');
                let empresaFinalId = null;

                if (empresaAtivaIdNoLocalStorage) {
                    // Prioriza o localStorage se existir e for válido
                    empresaFinalId = empresaAtivaIdNoLocalStorage;
                } else if (empresaAssociadaAoUsuario) {
                    // Se não tem no localStorage, usa o do mapaUsuarios como padrão
                    localStorage.setItem('empresaAtivaId', empresaAssociadaAoUsuario);
                    empresaFinalId = empresaAssociadaAoUsuario;
                }

                // Se ainda não temos uma empresa final, ou se o usuário está em uma página de configuração
                // e precisa selecionar/criar uma empresa.
                if (!empresaFinalId && !paginasDeConfiguracao.includes(currentPage)) {
                    console.log("[AuthGuard] Nenhuma empresa ativa/associada. Redirecionando para seleção.");
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Redirecionando para seleção de empresa."));
                }

                // --- 5. Carregar dados da empresa (com empresaFinalId garantido ou nulo se na página de config) ---
                let empresaDocSnap = null;
                let empresaData = null;
                if (empresaFinalId) {
                    empresaDocSnap = await getDoc(doc(db, "empresarios", empresaFinalId));
                    if (empresaDocSnap.exists()) {
                        empresaData = empresaDocSnap.data();
                    } else {
                        // Inconsistência: empresaId no mapa/localStorage não existe mais.
                        console.error(`[AuthGuard] Inconsistência: empresaId ${empresaFinalId} inexistente. Limpando localStorage.`);
                        localStorage.removeItem('empresaAtivaId'); // Limpa para forçar nova seleção
                        if (!paginasDeConfiguracao.includes(currentPage)) {
                            window.location.replace('selecionar-empresa.html');
                        }
                        return reject(new Error("Empresa não encontrada ou removida."));
                    }
                } else if (!paginasDeConfiguracao.includes(currentPage)) {
                    // Se não tem empresaFinalId e não está em página de config, algo deu errado.
                    console.error("[AuthGuard] Erro lógico: empresaFinalId não definido fora de páginas de configuração.");
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Erro: Empresa ativa não definida."));
                }

                // --- 6. Verificar status da assinatura (apenas se tiver empresaData) ---
                if (empresaData) {
                    const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                    if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                        console.log("[AuthGuard] Assinatura expirada. Redirecionando.");
                        window.location.replace('assinatura.html');
                        return reject(new Error("Assinatura expirada."));
                    }
                }

                // --- 7. Determinar o perfil (dono ou funcionário) ---
                let userProfile = null;
                if (empresaData) { // Só tenta determinar o perfil se tiver dados da empresa
                    const isOwner = empresaData.donoId === user.uid;

                    if (isOwner) {
                        userProfile = { user, empresaId: empresaDocSnap.id, perfil: empresaData, isOwner: true, role: "dono" };
                    } else {
                        // É um funcionário, verifica o status na subcoleção 'profissionais'
                        const profissionalRef = doc(db, "empresarios", empresaDocSnap.id, "profissionais", user.uid);
                        const profissionalSnap = await getDoc(profissionalRef);

                        if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                            userProfile = { user, perfil: profissionalSnap.data(), empresaId: empresaDocSnap.id, isOwner: false, role: "funcionario" };
                        } else {
                            // Funcionário existe mas não está ativo, ou não foi encontrado
                            console.log("[AuthGuard] Funcionário pendente ou inativo. Redirecionando para login.");
                            window.location.replace('login.html'); // Redireciona para login ou uma página de status
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                } else if (currentPage === 'perfil.html') {
                    // Se não tem empresaData, mas está na página de perfil, é o primeiro acesso para criar a empresa.
                    return reject(new Error("primeiro_acesso"));
                } else {
                    // Se não tem empresaData e não está na página de perfil, redireciona para perfil para criar a empresa.
                    console.log("[AuthGuard] Primeiro acesso (sem empresa). Redirecionando para perfil.");
                    window.location.replace('perfil.html');
                    return reject(new Error("primeiro_acesso"));
                }

                cachedSessionProfile = userProfile;
                return resolve(userProfile);

            } catch (error) {
                console.error("[AuthGuard] Erro final em verificarAcesso:", error);
                // Tratamento de erro mais robusto para evitar loops
                if (error.message === "Utilizador não autenticado.") {
                    // Já tratado no início, apenas rejeita
                    return reject(error);
                } else if (error.message === "Redirecionando para seleção de empresa." || error.message === "Assinatura expirada." || error.message === "primeiro_acesso") {
                    // Erros de redirecionamento intencionais, apenas rejeita
                    return reject(error);
                } else if (error.code === 'permission-denied') {
                    console.log("[AuthGuard] Permissão negada. Possível funcionário não aprovado ou regra de segurança.");
                    // Se for permission-denied e não for uma página de configuração, redireciona para login
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                        window.location.replace('login.html');
                    }
                    return reject(new Error("Permissão negada ou aguardando aprovação."));
                } else {
                    // Erros inesperados, redireciona para login para resetar o estado
                    console.error("[AuthGuard] Erro inesperado, forçando logout/redirecionamento.");
                    window.location.replace('login.html');
                    return reject(new Error("Erro inesperado no acesso."));
                }
            }
        });
    });
}
