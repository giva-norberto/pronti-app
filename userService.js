// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL - CORRIGINDO O FLUXO DE CRIAÇÃO DE USUÁRIO
//           **PADRONIZADO PARA FIREBASE 10.13.2**
// ======================================================================

import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação
let cachedSessionProfile = null;

// Funções Auxiliares
async function getEmpresasDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    console.log("[LOG] getEmpresasDoDono:", {uid, empresas: querySnapshot.size});
    return querySnapshot;
}

export async function ensureUserAndTrialDoc() {
    const user = auth.currentUser;
    if (!user) {
        console.log("[LOG] ensureUserAndTrialDoc: usuário não autenticado");
        return;
    }
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.log("[LOG] Criando documento inicial para o usuário:", user.uid);
        await setDoc(userRef, {
            nome: user.displayName || user.email,
            email: user.email,
            trialStart: serverTimestamp(),
            isPremium: false
        });
    } else if (!userSnap.data().trialStart) {
        console.log("[LOG] Adicionando trialStart ao usuário:", user.uid);
        await updateDoc(userRef, {
            trialStart: serverTimestamp()
        });
    }
}

async function checkUserStatus(user, empresaData) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.log("[LOG] checkUserStatus: userSnap não existe");
        return { hasActivePlan: false, isTrialActive: true };
    }
    const userData = userSnap.data();
    if (userData.isPremium === true) {
        console.log("[LOG] checkUserStatus: usuário é premium");
        return { hasActivePlan: true, isTrialActive: false };
    }
    if (!userData.trialStart?.seconds) {
        console.log("[LOG] checkUserStatus: trialStart ausente");
        return { hasActivePlan: false, isTrialActive: true };
    }
    let trialDurationDays = 15;
    if (empresaData && empresaData.freeEmDias !== undefined) {
        trialDurationDays = empresaData.freeEmDias;
    }
    const startDate = new Date(userData.trialStart.seconds * 1000);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + trialDurationDays);
    const trialOk = endDate > new Date();
    console.log("[LOG] checkUserStatus: startDate, endDate, trialOk", startDate, endDate, trialOk);
    return { hasActivePlan: false, isTrialActive: trialOk };
}

// ======================================================================
// FUNÇÃO PRINCIPAL COM A ORDEM DE OPERAÇÕES CORRIGIDA + LOGS
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        console.log("[LOG] Retornando sessionProfile em cache");
        return Promise.resolve(cachedSessionProfile);
    }
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (!user) {
                cachedSessionProfile = null;
                console.log("[LOG] Usuário não autenticado, redirecionando para login.html");
                window.location.href = 'login.html';
                return reject(new Error("Utilizador não autenticado."));
            }
            try {
                // Garante que o documento do usuário exista ANTES de qualquer outra coisa.
                await ensureUserAndTrialDoc();

                const currentPage = window.location.pathname.split('/').pop();
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                if (user.uid === ADMIN_UID) {
                    const adminProfile = { user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, isOwner: true, role: 'admin' };
                    cachedSessionProfile = adminProfile;
                    console.log("[LOG] Usuário ADMIN detectado, retornando perfil admin");
                    return resolve(adminProfile);
                }

                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                console.log("[LOG] empresasSnapshot.empty:", empresasSnapshot.empty, "| mapaSnap.exists():", mapaSnap.exists());

                if ((empresasSnapshot && !empresasSnapshot.empty) || mapaSnap.exists()) {
                    let empresaData = null;
                    if (empresasSnapshot && !empresasSnapshot.empty) {
                        empresaData = empresasSnapshot.docs[0].data();
                    }

                    const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                    console.log("[LOG] Plano ativo:", hasActivePlan, "| Trial ativo:", isTrialActive);

                    if (!hasActivePlan && !isTrialActive) {
                        cachedSessionProfile = null;
                        console.log("[LOG] Assinatura expirada, redirecionando para assinatura.html");
                        if (currentPage !== 'assinatura.html') {
                            window.location.href = 'assinatura.html';
                        }
                        return reject(new Error("Assinatura expirada."));
                    }

                    if (empresasSnapshot && !empresasSnapshot.empty) {
                        const empresaDoc = empresasSnapshot.docs[0];
                        const empresaData = empresaDoc.data();
                        // Preenchimento defensivo dos campos essenciais do perfil da empresa
                        empresaData.nomeFantasia = empresaData.nomeFantasia || "Empresa sem nome";
                        empresaData.plano = empresaData.plano || "free";
                        empresaData.descricao = empresaData.descricao || "-";
                        empresaData.localizacao = empresaData.localizacao || "-";
                        empresaData.horarioFuncionamento = empresaData.horarioFuncionamento || "-";
                        empresaData.chavePix = empresaData.chavePix || "-";
                        empresaData.logoUrl = empresaData.logoUrl || "https://placehold.co/80x80";
                        empresaData.nome = (await getDoc(doc(db, "usuarios", user.uid))).data()?.nome || user.displayName;
                        const userProfile = { user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" };
                        cachedSessionProfile = userProfile;
                        console.log("[LOG] Perfil DONO retornado:", userProfile);
                        return resolve(userProfile);
                    } else {
                        const empresaId = mapaSnap.data().empresaId;
                        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                        const profissionalSnap = await getDoc(profissionalRef);
                        if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                            const userProfile = { user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" };
                            cachedSessionProfile = userProfile;
                            console.log("[LOG] Perfil FUNCIONÁRIO retornado:", userProfile);
                            return resolve(userProfile);
                        } else {
                            console.log("[LOG] Profissional aguardando aprovação!");
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }
                console.log("[LOG] Primeiro acesso detectado: nenhuma empresa encontrada para o usuário");
                return reject(new Error("primeiro_acesso"));
            } catch (error) {
                // Torna o erro visível para debug e sempre rejeita
                console.error("[LOG] Erro em verificarAcesso:", error);
                return reject(error);
            }
        });
    });
}
