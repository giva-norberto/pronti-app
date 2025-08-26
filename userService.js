// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM PREPARAÇÃO DE AMBIENTE PARA ADMIN
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
// FUNÇÃO PRINCIPAL COM A LÓGICA DE ADMIN CORRIGIDA
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
            // Se o usuário é o Admin, o fluxo para aqui, mas prepara o ambiente.
            if (user.uid === ADMIN_UID) {
                console.log("Admin detectado. Configurando ambiente e concedendo acesso.");
                
                // Pega a primeira empresa que existir no banco de dados para usar como "placeholder".
                // Isso satisfaz a verificação do agenda.js e outras páginas.
                const primeiraEmpresaQuery = query(collection(db, "empresarios"));
                const snapshot = await getDocs(primeiraEmpresaQuery);
                
                if (!snapshot.empty) {
                    const primeiraEmpresaId = snapshot.docs[0].id;
                    localStorage.setItem('empresaAtivaId', primeiraEmpresaId);
                    console.log(`Ambiente do Admin configurado com a empresa placeholder: ${primeiraEmpresaId}`);
                } else {
                    // Se não houver nenhuma empresa, limpa para evitar IDs antigos.
                    localStorage.removeItem('empresaAtivaId');
                }

                return resolve({ 
                    user, 
                    isAdmin: true, 
                    perfil: { nome: "Administrador" },
                    empresaId: localStorage.getItem('empresaAtivaId'), // Passa o ID para consistência
                    isOwner: false,
                    role: 'admin'
                });
            }

            // O código abaixo só será executado se o usuário NÃO for o admin.
            const { hasActivePlan, isTrialActive } = await checkUserStatus();
            if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                console.log("Acesso bloqueado: Sem plano ativo e trial expirado. Redirecionando...");
                window.location.href = 'assinatura.html';
                return new Promise(() => {});
            }

            // ... (O resto do seu código para usuários normais continua exatamente igual)
            try {
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // ... (lógica de dono)
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
