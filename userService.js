// ======================================================================
//                      USERSERVICE.JS (REVISADO: ESTABILIDADE + PERFIL ADMIN/DONO/FUNCIONÁRIO)
// ======================================================================

import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação
let cachedSessionProfile = null;

// --- Funções Auxiliares ---
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
// FUNÇÃO PRINCIPAL: PERFIL ADMIN/DONO/FUNCIONÁRIO COM ESTABILIDADE
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

            // 1. Usuário não logado
            if (!user) {
                if (!paginasPublicas.includes(currentPage)) {
                    console.log("[AuthGuard] Usuário não logado. Redirecionando para login.");
                    window.location.replace('login.html');
                }
                return reject(new Error("Utilizador não autenticado."));
            }

            try {
                await ensureUserAndTrialDoc();

                // 2. Admin
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                if (user.uid === ADMIN_UID) {
                    cachedSessionProfile = { user, isAdmin: true, perfil: { nome: "Admin" }, isOwner: true, role: 'admin' };
                    return resolve(cachedSessionProfile);
                }

                // 3. Obter empresaId do mapaUsuarios
                const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
                let empresaAtivaId = null;

                if (mapaSnap.exists()) {
                    empresaAtivaId = mapaSnap.data().empresaId;
                } else {
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                        console.log("[AuthGuard] Primeiro acesso (sem mapa). Redirecionando para perfil.");
                        window.location.replace('perfil.html');
                    }
                    return reject(new Error("primeiro_acesso"));
                }

                // 4. Seleciona empresa ativa pelo localStorage ou mapa
                let empresaSelecionadaId = localStorage.getItem('empresaAtivaId');
                if (!empresaSelecionadaId) {
                    if (empresaAtivaId) {
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaSelecionadaId = empresaAtivaId;
                    } else {
                        if (!paginasDeConfiguracao.includes(currentPage)) {
                            console.log("[AuthGuard] Nenhuma empresa ativa. Redirecionando para seleção.");
                            window.location.replace('selecionar-empresa.html');
                        }
                        return reject(new Error("Redirecionando para seleção de empresa."));
                    }
                }

                // 5. Carregar dados da empresa
                let empresaDocSnap = null;
                let empresaData = null;
                if (empresaSelecionadaId) {
                    empresaDocSnap = await getDoc(doc(db, "empresarios", empresaSelecionadaId));
                    if (empresaDocSnap.exists()) {
                        empresaData = empresaDocSnap.data();
                    } else {
                        console.error(`[AuthGuard] Inconsistência: empresaId ${empresaSelecionadaId} inexistente.`);
                        localStorage.removeItem('empresaAtivaId');
                        if (!paginasDeConfiguracao.includes(currentPage)) {
                            window.location.replace('selecionar-empresa.html');
                        }
                        return reject(new Error("Empresa não encontrada ou removida."));
                    }
                } else {
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                        window.location.replace('selecionar-empresa.html');
                    }
                    return reject(new Error("Erro: Empresa ativa não definida."));
                }

                // 6. Verificar status da assinatura
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("[AuthGuard] Assinatura expirada. Redirecionando.");
                    window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                // 7. Determinar perfil: dono, admin ou funcionário
                const isOwner = empresaData.donoId === user.uid;
                let userProfile = null;

                if (isOwner) {
                    userProfile = {
                        user,
                        empresaId: empresaDocSnap.id,
                        perfil: empresaData,
                        isOwner: true,
                        isAdmin: false,
                        role: "dono"
                    };
                } else {
                    // Verifica funcionário ativo na SUBCOLEÇÃO profissionais
                    const profissionalRef = doc(db, "empresarios", empresaDocSnap.id, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);

                    if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                        userProfile = {
                            user,
                            perfil: profissionalSnap.data(),
                            empresaId: empresaDocSnap.id,
                            isOwner: false,
                            isAdmin: false,
                            role: "funcionario"
                        };
                    } else {
                        // Funcionário existe mas não está ativo, ou não foi encontrado
                        console.log("[AuthGuard] Funcionário pendente ou inativo. Redirecionando para login.");
                        if (!paginasPublicas.includes(currentPage)) {
                            window.location.replace('login.html');
                        }
                        return reject(new Error("funcionario_inativo"));
                    }
                }

                cachedSessionProfile = userProfile;
                resolve(userProfile);

            } catch (error) {
                console.error("[AuthGuard] Erro de verificação de acesso:", error);
                reject(error);
            }
        });
    });
}
