// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL COM FLUXO DE LÓGICA CORRIGIDO
// ======================================================================

// Imports (sem alterações)
import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// Funções Auxiliares (sem alterações )
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

            // Etapa 1: Tratar o Admin como um caso especial e sair imediatamente.
            if (user.uid === ADMIN_UID) {
                console.log("Admin detectado. Concedendo acesso.");
                const primeiraEmpresaQuery = query(collection(db, "empresarios"));
                const snapshot = await getDocs(primeiraEmpresaQuery);
                if (!snapshot.empty) {
                    localStorage.setItem('empresaAtivaId', snapshot.docs[0].id);
                }
                return resolve({ user, isAdmin: true, perfil: { nome: "Administrador" }, empresaId: localStorage.getItem('empresaAtivaId'), isOwner: false, role: 'admin' });
            }

            // Etapa 2: Verificar status de assinatura para usuários normais.
            const { hasActivePlan, isTrialActive } = await checkUserStatus();
            
            // Se o acesso deve ser bloqueado...
            if (!hasActivePlan && !isTrialActive) {
                // ...e a página atual NÃO é a de assinatura, redireciona.
                if (currentPage !== 'assinatura.html') {
                    console.log("Acesso bloqueado. Redirecionando para assinatura...");
                    window.location.href = 'assinatura.html';
                } else {
                    // Se já está na página de assinatura, apenas informa e para.
                    console.log("Acesso bloqueado. Permanecendo na página de assinatura.");
                }
                // CRUCIAL: Rejeita a promessa para parar a execução aqui.
                return reject(new Error("Assinatura expirada."));
            }

            // Etapa 3: Se chegou até aqui, o usuário tem acesso. Prossiga com a lógica normal.
            console.log("--- Acesso permitido. Verificando perfil do utilizador:", user.uid, "---");

            try {
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // Lógica de Dono (sem alterações)
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
                const mapaSnap = await getDoc(mapaRef);
                if (mapaSnap.exists()) {
                    // Lógica de Funcionário (sem alterações)
                    const empresaId = mapaSnap.data().empresaId;
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);
                    if (profissionalSnap.exists()) {
                        if (profissionalSnap.data().status === 'ativo') {
                             localStorage.setItem('empresaAtivaId', empresaId);
                             return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" });
                        } else {
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }

                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
