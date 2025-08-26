// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL - LÓGICA UNIFICADA E CORRETA
// ======================================================================

// Imports (sem alterações)
import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// Funções Auxiliares (sem alterações )
async function getEmpresasDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot;
}
export async function ensureUserAndTrialDoc() { /* ...código inalterado... */ }

// Função de verificação de status (agora recebe os dados da empresa)
async function checkUserStatus(user, empresaData) {
    const safeReturn = { hasActivePlan: false, isTrialActive: false };
    if (!user) return safeReturn;

    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
        
        const userData = userSnap.data();
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };

        // LÓGICA CORRIGIDA: Usa os dados da empresa que já foram buscados
        let trialDurationDays = 15;
        if (empresaData && empresaData.freeEmDias !== undefined) {
            trialDurationDays = empresaData.freeEmDias;
        }
        
        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);

        return { hasActivePlan: false, isTrialActive: endDate > new Date() };

    } catch (error) {
        console.error("Erro em checkUserStatus:", error);
        return safeReturn;
    }
}

// ======================================================================
// FUNÇÃO PRINCIPAL COM A ORDEM DE OPERAÇÕES CORRIGIDA
// ======================================================================
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                window.location.href = 'login.html';
                return reject(new Error("Utilizador não autenticado."));
            }
            
            const currentPage = window.location.pathname.split('/').pop();
            const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

            // Etapa 1: Tratar o Admin
            if (user.uid === ADMIN_UID) {
                // ... (lógica do admin sem alterações)
                return resolve({ user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, isOwner: true, role: 'admin' });
            }

            // Etapa 2: Buscar os dados essenciais UMA ÚNICA VEZ
            const empresasSnapshot = await getEmpresasDoDono(user.uid);
            const mapaRef = doc(db, "mapaUsuarios", user.uid);
            const mapaSnap = await getDoc(mapaRef);

            // Etapa 3: Verificar se o usuário tem um vínculo (é dono OU funcionário)
            if ((empresasSnapshot && !empresasSnapshot.empty) || mapaSnap.exists()) {
                
                let empresaData = null;
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // Pega os dados da primeira empresa (ou da ativa, se houver lógica para isso)
                    empresaData = empresasSnapshot.docs[0].data();
                }

                // ...aí sim, verificamos a assinatura, passando os dados da empresa.
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive) {
                    if (currentPage !== 'assinatura.html') {
                        window.location.href = 'assinatura.html';
                    }
                    return reject(new Error("Assinatura expirada."));
                }

                // Se a assinatura está OK, prossiga com a lógica de perfil.
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // Lógica de Dono (sem alterações)
                    // ...
                    return resolve({ user, empresaId: empresasSnapshot.docs[0].id, perfil: empresaData, isOwner: true, role: "dono" });
                } else { 
                    // Lógica de Funcionário (sem alterações)
                    // ...
                    return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" });
                }
            }

            // Etapa 4: Se não é Admin, nem Dono, nem Funcionário, então é PRIMEIRO ACESSO.
            return reject(new Error("primeiro_acesso"));
        });
    });
}
