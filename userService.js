// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM VERIFICAÇÃO DE ASSINATURA
// ======================================================================

// Imports do Firebase (sem alterações)
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { db, auth } from './firebase-config.js'; // Ajuste o caminho se necessário

// --- Funções Auxiliares (sem alterações ) ---
async function getEmpresasDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot;
}

// --- Funções Exportadas (sem alterações) ---
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
            isPremium: false
        });
    } else if (!userSnap.data().trialStart) {
        await updateDoc(userRef, {
            trialStart: serverTimestamp()
        });
    }
}

export async function checkUserStatus() {
    const safeReturn = { hasActivePlan: false, isTrialActive: false, trialEndDate: null };
    const user = auth.currentUser;
    if (!user) return safeReturn;

    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return safeReturn;

        const userData = userSnap.data();
        const hasActivePlan = userData.isPremium === true;
        let isTrialActive = false;
        let trialEndDate = null;

        if (userData.trialStart && userData.trialStart.seconds) {
            // AQUI ESTÁ A LÓGICA DE DIAS DE TESTE. VAMOS USAR O CAMPO DA EMPRESA
            const empresaRef = doc(db, "empresarios", user.uid); // Supondo que o ID da empresa é o mesmo do dono
            const empresaSnap = await getDoc(empresaRef);
            const trialDurationDays = (empresaSnap.exists() && empresaSnap.data().freeEmDias !== undefined) ? empresaSnap.data().freeEmDias : 15;

            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);

            trialEndDate = endDate;

            if (endDate > new Date()) {
                isTrialActive = true;
            }
        }
        return { hasActivePlan, isTrialActive, trialEndDate };

    } catch (error) {
        return safeReturn;
    }
}

// ======================================================================
// FUNÇÃO PRINCIPAL ATUALIZADA COM A VERIFICAÇÃO DE ASSINATURA
// ======================================================================
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                window.location.href = 'login.html';
                return reject(new Error("Utilizador não autenticado."));
            }
            
            // ===================================================================
            //                      LÓGICA DE ASSINATURA INSERIDA AQUI
            // ===================================================================
            // Antes de qualquer outra coisa, verifica o status da assinatura.
            const { hasActivePlan, isTrialActive } = await checkUserStatus();
            const currentPage = window.location.pathname.split('/').pop();

            // Se não tem plano ativo E o trial acabou, redireciona para a assinatura.
            if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                console.log("Acesso bloqueado: Sem plano ativo e trial expirado. Redirecionando...");
                window.location.href = 'assinatura.html';
                return new Promise(() => {}); // Para a execução do script
            }
            // ===================================================================

            console.log("--- Iniciando verificação de acesso para o utilizador:", user.uid, "---");

            try {
                // 1. Checa se é o DONO e busca as suas empresas
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                
                console.log(`Foram encontradas ${empresasSnapshot ? empresasSnapshot.size : 0} empresas para este dono.`);

                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // ... (O RESTO DA SUA LÓGICA DE MÚLTIPLAS EMPRESAS CONTINUA IGUAL)
                    // ...
                    if (empresasSnapshot.size === 1) {
                        // ...
                    } else {
                        // ...
                    }
                }

                // 2. Se não é dono, checa se é FUNCIONÁRIO
                // ... (O RESTO DA SUA LÓGICA DE FUNCIONÁRIO CONTINUA IGUAL)
                // ...

                // 3. Se não é dono nem funcionário, é o PRIMEIRO ACESSO
                console.log("Cenário: PRIMEIRO ACESSO. Nenhum vínculo de dono ou funcionário encontrado.");
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
