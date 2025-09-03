// ======================================================================
//                      USERSERVICE.JS (CORRIGIDO)
// ======================================================================

import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação
let cachedSessionProfile = null;

// --- Funções Auxiliares (sem alterações ) ---
// ESTA FUNÇÃO NÃO SERÁ MAIS USADA DIRETAMENTE NO AUTHGUARD, POIS CAUSA O ERRO DE PERMISSÃO.
// Mantida aqui caso seja usada em outro lugar por um admin.
async function getEmpresasDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot;
}

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
    // ... (sua função checkUserStatus continua a mesma)
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
// FUNÇÃO PRINCIPAL COM A LÓGICA DE ROTEAMENTO CORRIGIDA
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
            const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html'];

            if (!user) {
                if (!paginasPublicas.includes(currentPage)) {
                    console.log("[AuthGuard] Usuário não logado. Redirecionando para login.");
                    window.location.replace('login.html');
                }
                return reject(new Error("Utilizador não autenticado."));
            }

            try {
                await ensureUserAndTrialDoc();

                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                if (user.uid === ADMIN_UID) {
                    cachedSessionProfile = { user, isAdmin: true, perfil: { nome: "Admin" }, isOwner: true, role: 'admin' };
                    return resolve(cachedSessionProfile);
                }

                // ================== MUDANÇA CRÍTICA INICIA AQUI ==================

                // 1. LER O MAPA PRIMEIRO. É a única leitura que sempre funciona.
                const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));

                // Se o usuário não tem mapa, ele é novo.
                if (!mapaSnap.exists()) {
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                        console.log("[AuthGuard] Primeiro acesso (sem mapa). Redirecionando para perfil.");
                        window.location.replace('perfil.html');
                    }
                    return reject(new Error("primeiro_acesso"));
                }

                // 2. OBTER O empresaId DO MAPA.
                const empresaId = mapaSnap.data().empresaId || localStorage.getItem('empresaAtivaId');

                if (!empresaId && !paginasDeConfiguracao.includes(currentPage)) {
                    console.log("[AuthGuard] Nenhuma empresa ativa. Redirecionando para seleção.");
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Redirecionando para seleção de empresa."));
                }
                
                // 3. AGORA, COM O empresaId, LER O DOCUMENTO DA EMPRESA. Esta leitura é permitida pelas regras.
                let empresaDocSnap = null;
                let empresaData = null;
                if (empresaId) {
                    empresaDocSnap = await getDoc(doc(db, "empresarios", empresaId));
                    if (empresaDocSnap.exists()) {
                        empresaData = empresaDocSnap.data();
                    } else {
                        // Inconsistência de dados: mapa aponta para empresa que não existe.
                        console.error(`[AuthGuard] Inconsistência: mapa aponta para empresaId ${empresaId} inexistente.`);
                        // Limpar o localStorage para forçar nova seleção
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('selecionar-empresa.html');
                        return reject(new Error("Empresa não encontrada."));
                    }
                }

                // LÓGICA DE REDIRECIONAMENTO PARA ASSINATURA (agora usa empresaData obtido de forma segura)
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("[AuthGuard] Assinatura expirada. Redirecionando.");
                    window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                // 4. DETERMINAR O PERFIL (DONO OU FUNCIONÁRIO)
                const isOwner = empresaData && empresaData.donoId === user.uid;

                if (isOwner) {
                    const userProfile = { user, empresaId: empresaDocSnap.id, perfil: empresaData, isOwner: true, role: "dono" };
                    cachedSessionProfile = userProfile;
                    return resolve(userProfile);
                } else { // É um funcionário
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);
                    if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                        const userProfile = { user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" };
                        cachedSessionProfile = userProfile;
                        return resolve(userProfile);
                    } else {
                        // Funcionário existe mas não está ativo, ou não foi encontrado
                        return reject(new Error("aguardando_aprovacao"));
                    }
                }
                // ================== MUDANÇA CRÍTICA TERMINA AQUI ==================

            } catch (error) {
                console.error("[AuthGuard] Erro final em verificarAcesso:", error);
                // Se o erro for de permissão, pode ser um funcionário tentando acessar antes da aprovação
                if (error.code === 'permission-denied') {
                    return reject(new Error("aguardando_aprovacao"));
                }
                return reject(error);
            }
        });
    });
}
