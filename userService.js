// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM FLUXO DE EXECUÇÃO CORRIGIDO
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

            // ===================================================================
            //                      CORREÇÃO APLICADA AQUI
            // ===================================================================
            // Se o usuário é o Admin, o fluxo para aqui e resolve imediatamente.
            if (user.uid === ADMIN_UID) {
                console.log("Admin detectado. Configurando ambiente e concedendo acesso.");
                
                const primeiraEmpresaQuery = query(collection(db, "empresarios"));
                const snapshot = await getDocs(primeiraEmpresaQuery);
                
                if (!snapshot.empty) {
                    const primeiraEmpresaId = snapshot.docs[0].id;
                    localStorage.setItem('empresaAtivaId', primeiraEmpresaId);
                    console.log(`Ambiente do Admin configurado com a empresa placeholder: ${primeiraEmpresaId}`);
                } else {
                    localStorage.removeItem('empresaAtivaId');
                }

                // A CHAMADA 'return' AQUI É CRUCIAL. ELA IMPEDE QUE O RESTO DO CÓDIGO EXECUTE.
                return resolve({ 
                    user, 
                    isAdmin: true, 
                    perfil: { nome: "Administrador" },
                    empresaId: localStorage.getItem('empresaAtivaId'),
                    isOwner: false,
                    role: 'admin'
                });
            }

            // O código abaixo só será executado se o usuário NÃO for o admin.
            const { hasActivePlan, isTrialActive } = await checkUserStatus();
            if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                console.log("Acesso bloqueado: Sem plano ativo e trial expirado. Redirecionando...");
                window.location.href = 'assinatura.html';
                return new Promise(() => {}); // Para a execução para usuários sem acesso
            }

            console.log("--- Iniciando verificação de acesso para o utilizador (NÃO-ADMIN):", user.uid, "---");

            try {
                // Lógica para usuários normais (donos e funcionários) - SEM ALTERAÇÕES
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    if (empresasSnapshot.size === 1) {
                        const empresaDoc = empresasSnapshot.docs[0];
                        localStorage.setItem('empresaAtivaId', empresaDoc.id);
                        const empresaData = empresaDoc.data();
                        const userDocRef = doc(db, "usuarios", user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                        return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                    } else {
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

                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                if (mapaRef.exists()) {
                    // ... (lógica de funcionário)
                }

                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
