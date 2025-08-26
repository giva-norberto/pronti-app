// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM LÓGICA DE ASSINATURA CORRIGIDA
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

import { db, auth } from './firebase-config.js';

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

// ======================================================================
//                      CORREÇÃO APLICADA AQUI
// ======================================================================
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
            // CORREÇÃO: Busca as empresas do dono para encontrar os dias de teste.
            const empresasSnapshot = await getEmpresasDoDono(user.uid);
            let trialDurationDays = 15; // Valor padrão

            // Se o dono tem pelo menos uma empresa, usamos os dias de teste da primeira que encontrarmos.
            // A lógica assume que os dias de teste são os mesmos para todas as empresas de um dono.
            if (empresasSnapshot && !empresasSnapshot.empty) {
                const empresaData = empresasSnapshot.docs[0].data();
                if (empresaData.freeEmDias !== undefined) {
                    trialDurationDays = empresaData.freeEmDias;
                }
            }

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
        console.error("Erro em checkUserStatus:", error);
        return safeReturn;
    }
}

// ======================================================================
// FUNÇÃO PRINCIPAL (sem alterações, já estava correta)
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
            
            // Se o usuário for o admin, libera o acesso direto.
            const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
            if (user.uid === ADMIN_UID) {
                console.log("Admin logado, acesso liberado.");
                return resolve({ user, isAdmin: true });
            }

            const { hasActivePlan, isTrialActive } = await checkUserStatus();
            
            if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                console.log("Acesso bloqueado: Sem plano ativo e trial expirado. Redirecionando...");
                window.location.href = 'assinatura.html';
                return new Promise(() => {});
            }

            console.log("--- Iniciando verificação de acesso para o utilizador:", user.uid, "---");

            try {
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                console.log(`Foram encontradas ${empresasSnapshot ? empresasSnapshot.size : 0} empresas para este dono.`);

                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // O resto da sua lógica de dono de empresa...
                    // ...
                    return resolve({ user, isOwner: true, role: "dono" }); // Simplificado para o exemplo
                }

                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                if (mapaSnap.exists()) {
                    // O resto da sua lógica de funcionário...
                    // ...
                    return resolve({ user, isOwner: false, role: "funcionario" }); // Simplificado para o exemplo
                }

                console.log("Cenário: PRIMEIRO ACESSO. Nenhum vínculo de dono ou funcionário encontrado.");
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
