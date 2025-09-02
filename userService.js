
// ======================================================================
//                      USERSERVICE.JS (O "Guarda de Trânsito" Definitivo)
// ======================================================================

import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação
let cachedSessionProfile = null;

// --- Funções Auxiliares (sem alterações ) ---
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
// FUNÇÃO PRINCIPAL COM A LÓGICA DE ROTEAMENTO CENTRALIZADA
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
                // Se não há usuário e a página não é pública, redireciona para o login.
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
                    // ... (sua lógica de admin continua a mesma)
                    cachedSessionProfile = { user, isAdmin: true, perfil: { nome: "Admin" }, isOwner: true, role: 'admin' };
                    return resolve(cachedSessionProfile);
                }

                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));

                // LÓGICA DE REDIRECIONAMENTO PARA SELEÇÃO DE EMPRESA
                const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                if (!empresaAtivaId && !paginasDeConfiguracao.includes(currentPage)) {
                    // Se não há empresa ativa e o usuário não está numa página de configuração,
                    // ele é forçado a ir para a seleção.
                    console.log("[AuthGuard] Nenhuma empresa ativa. Redirecionando para seleção.");
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Redirecionando para seleção de empresa."));
                }

                // LÓGICA DE REDIRECIONAMENTO PARA ASSINATURA
                let empresaData = null;
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    empresaData = empresasSnapshot.docs[0].data();
                }
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("[AuthGuard] Assinatura expirada. Redirecionando.");
                    window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                // Se chegou aqui, o usuário tem permissão para estar na página.
                // O código continua para resolver o perfil (dono ou funcionário).
                if ((empresasSnapshot && !empresasSnapshot.empty) || mapaSnap.exists()) {
                    // ... (o resto da sua lógica para resolver o perfil de dono/funcionário continua exatamente a mesma)
                    if (empresasSnapshot && !empresasSnapshot.empty) {
                        const empresaDoc = empresasSnapshot.docs[0];
                        const empresaData = empresaDoc.data();
                        // ... (preenchimento defensivo)
                        const userProfile = { user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" };
                        cachedSessionProfile = userProfile;
                        return resolve(userProfile);
                    } else {
                        // ... (lógica de funcionário)
                        const empresaId = mapaSnap.data().empresaId;
                        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                        const profissionalSnap = await getDoc(profissionalRef);
                        if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                            const userProfile = { user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" };
                            cachedSessionProfile = userProfile;
                            return resolve(userProfile);
                        } else {
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }

                // Se não caiu em nenhuma das lógicas acima, é o primeiro acesso.
                // Redireciona para a página de perfil para criar a primeira empresa.
                if (!paginasDeConfiguracao.includes(currentPage)) {
                    console.log("[AuthGuard] Primeiro acesso. Redirecionando para perfil.");
                    window.location.replace('perfil.html');
                    return reject(new Error("primeiro_acesso"));
                }
                // Se já estiver na página de perfil, apenas rejeita para que a página possa continuar.
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                console.error("[AuthGuard] Erro final em verificarAcesso:", error);
                return reject(error);
            }
        });
    });
}
