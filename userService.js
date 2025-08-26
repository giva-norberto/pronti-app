// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL - ESTÁVEL E FUNCIONAL
// ======================================================================

// Imports
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação
let cachedSessionProfile = null;

// Funções Auxiliares
async function getEmpresasDoDono(uid ) {
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
        console.log("Criando documento inicial para o usuário:", user.uid);
        await setDoc(userRef, {
            nome: user.displayName || user.email,
            email: user.email,
            trialStart: serverTimestamp(),
            isPremium: false
        });
    } else if (!userSnap.data().trialStart) {
        await updateDoc(userRef, {
            trialStart: serverTimestamp()
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

// FUNÇÃO PRINCIPAL COM A ORDEM DE OPERAÇÕES CORRIGIDA E MEMÓRIA
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        return Promise.resolve(cachedSessionProfile);
    }

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                cachedSessionProfile = null;
                window.location.href = 'login.html';
                return reject(new Error("Utilizador não autenticado."));
            }
            
            // Garante que o documento do usuário exista ANTES de qualquer outra coisa.
            await ensureUserAndTrialDoc();

            const currentPage = window.location.pathname.split('/').pop();
            const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

            if (user.uid === ADMIN_UID) {
                const adminProfile = { user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, isOwner: true, role: 'admin' };
                cachedSessionProfile = adminProfile;
                return resolve(adminProfile);
            }

            const empresasSnapshot = await getEmpresasDoDono(user.uid);
            const mapaRef = doc(db, "mapaUsuarios", user.uid);
            const mapaSnap = await getDoc(mapaRef);

            if ((empresasSnapshot && !empresasSnapshot.empty) || mapaSnap.exists()) {
                let empresaData = null;
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    empresaData = empresasSnapshot.docs[0].data();
                }
                
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive) {
                    cachedSessionProfile = null;
                    if (currentPage !== 'assinatura.html') {
                        window.location.href = 'assinatura.html';
                    }
                    return reject(new Error("Assinatura expirada."));
                }

                if (empresasSnapshot && !empresasSnapshot.empty) {
                    const empresaDoc = empresasSnapshot.docs[0];
                    const empresaData = empresaDoc.data();
                    empresaData.nome = (await getDoc(doc(db, "usuarios", user.uid))).data()?.nome || user.displayName;
                    const userProfile = { user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" };
                    cachedSessionProfile = userProfile;
                    return resolve(userProfile);
                } else {
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

            return reject(new Error("primeiro_acesso"));
        });
    });
}

