// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM LÓGICA ORIGINAL RESTAURADA
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

// Função corrigida para buscar os dias de teste corretamente
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
            const empresasSnapshot = await getEmpresasDoDono(user.uid);
            let trialDurationDays = 15; 

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
// FUNÇÃO PRINCIPAL COM A LÓGICA ORIGINAL RESTAURADA
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
            if (user.uid === ADMIN_UID) {
                console.log("Admin logado, acesso liberado.");
                // Retornando um objeto que não quebra outras partes do sistema
                return resolve({ user, isAdmin: true, perfil: { nome: "Admin" } });
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
                    // O utilizador é dono de pelo menos uma empresa.
                    if (empresasSnapshot.size === 1) {
                        const empresaDoc = empresasSnapshot.docs[0];
                        localStorage.setItem('empresaAtivaId', empresaDoc.id);
                        const empresaData = empresaDoc.data();
                        const userDocRef = doc(db, "usuarios", user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                        
                        // SUA LÓGICA ORIGINAL RESTAURADA
                        return resolve({
                            user,
                            empresaId: empresaDoc.id,
                            perfil: empresaData,
                            isOwner: true,
                            role: "dono"
                        });

                    } else {
                        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                        const empresaAtivaValida = empresasSnapshot.docs.some(doc => doc.id === empresaAtivaId);

                        if (empresaAtivaId && empresaAtivaValida) {
                             const empresaDoc = empresasSnapshot.docs.find(doc => doc.id === empresaAtivaId);
                             const empresaData = empresaDoc.data();
                             const userDocRef = doc(db, "usuarios", user.uid);
                             const userDocSnap = await getDoc(userDocRef);
                             empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                             
                             // SUA LÓGICA ORIGINAL RESTAURADA
                             return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                        } else {
                            if (currentPage !== 'selecionar-empresa.html' && currentPage !== 'perfil.html') {
                                window.location.href = 'selecionar-empresa.html';
                                return new Promise(() => {});
                            }
                            // SUA LÓGICA ORIGINAL RESTAURADA
                            return resolve({ user, isOwner: true, role: "dono" });
                        }
                    }
                }

                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                if (mapaSnap.exists()) {
                    const empresaId = mapaSnap.data().empresaId;
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);

                    if (profissionalSnap.exists()) {
                        if (profissionalSnap.data().status === 'ativo') {
                             localStorage.setItem('empresaAtivaId', empresaId);
                             // SUA LÓGICA ORIGINAL RESTAURADA
                             return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" });
                        } else {
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }

                console.log("Cenário: PRIMEIRO ACESSO. Nenhum vínculo de dono ou funcionário encontrado.");
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
