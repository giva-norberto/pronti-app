// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM CORREÇÃO DE FLUXO DO ADMIN
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

// --- Funções Auxiliares e checkUserStatus (sem alterações ) ---
async function getEmpresasDoDono(uid) { /* ...código inalterado... */ }
export async function ensureUserAndTrialDoc() { /* ...código inalterado... */ }
export async function checkUserStatus() { /* ...código inalterado... */ }

// ======================================================================
// FUNÇÃO PRINCIPAL COM A LÓGICA DE FLUXO CORRIGIDA
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
            const isAdmin = user.uid === ADMIN_UID;

            // ===================================================================
            //                      CORREÇÃO APLICADA AQUI
            // ===================================================================
            // A verificação de assinatura só acontece se o usuário NÃO for o admin.
            if (!isAdmin) {
                const { hasActivePlan, isTrialActive } = await checkUserStatus();
                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("Acesso bloqueado: Sem plano ativo e trial expirado. Redirecionando...");
                    window.location.href = 'assinatura.html';
                    return new Promise(() => {});
                }
            }

            console.log("--- Iniciando verificação de acesso para o utilizador:", user.uid, "---");

            try {
                // O código agora continua a execução para TODOS os usuários, incluindo o admin,
                // garantindo que os dados da empresa sejam sempre buscados.
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                console.log(`Foram encontradas ${empresasSnapshot ? empresasSnapshot.size : 0} empresas para este dono.`);

                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // ... (SUA LÓGICA ORIGINAL DE DONO DE EMPRESA - SEM ALTERAÇÕES)
                    if (empresasSnapshot.size === 1) {
                        const empresaDoc = empresasSnapshot.docs[0];
                        localStorage.setItem('empresaAtivaId', empresaDoc.id);
                        const empresaData = empresaDoc.data();
                        const userDocRef = doc(db, "usuarios", user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                        
                        return resolve({
                            user,
                            empresaId: empresaDoc.id,
                            perfil: empresaData,
                            isOwner: true,
                            role: "dono"
                        });

                    } else {
                        // ... (SUA LÓGICA ORIGINAL DE MÚLTIPLAS EMPRESAS - SEM ALTERAÇÕES)
                        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                        const empresaAtivaValida = empresasSnapshot.docs.some(doc => doc.id === empresaAtivaId);

                        if (empresaAtivaId && empresaAtivaValida) {
                             const empresaDoc = empresasSnapshot.docs.find(doc => doc.id === empresaAtivaId);
                             const empresaData = empresaDoc.data();
                             const userDocRef = doc(db, "usuarios", user.uid);
                             const userDocSnap = await getDoc(userDocRef);
                             empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                             
                             return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                        } else {
                            if (currentPage !== 'selecionar-empresa.html' && currentPage !== 'perfil.html') {
                                window.location.href = 'selecionar-empresa.html';
                                return new Promise(() => {});
                            }
                            return resolve({ user, isOwner: true, role: "dono" });
                        }
                    }
                }

                // ... (SUA LÓGICA ORIGINAL DE FUNCIONÁRIO E PRIMEIRO ACESSO - SEM ALTERAÇÕES)
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                if (mapaSnap.exists()) {
                    // ...
                }

                console.log("Cenário: PRIMEIRO ACESSO. Nenhum vínculo de dono ou funcionário encontrado.");
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
