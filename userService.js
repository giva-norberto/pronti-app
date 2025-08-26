// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL - CORREÇÃO NA LÓGICA DE TRIAL
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

// ======================================================================
//                      CORREÇÃO APLICADA AQUI
// ======================================================================
export async function checkUserStatus() {
    const safeReturn = { hasActivePlan: false, isTrialActive: false };
    const user = auth.currentUser;
    if (!user) return safeReturn;

    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return safeReturn;
        const userData = userSnap.data();

        if (userData.isPremium === true) {
            return { hasActivePlan: true, isTrialActive: false };
        }

        if (!userData.trialStart?.seconds) {
            // Se não tem data de início, o trial é considerado ativo por padrão
            return { hasActivePlan: false, isTrialActive: true };
        }

        // LÓGICA CORRIGIDA: Busca os dias de teste da empresa ATIVA.
        let trialDurationDays = 15; // Padrão
        const empresaAtivaId = localStorage.getItem('empresaAtivaId');

        if (empresaAtivaId) {
            const empresaRef = doc(db, "empresarios", empresaAtivaId);
            const empresaSnap = await getDoc(empresaRef);
            if (empresaSnap.exists() && empresaSnap.data().freeEmDias !== undefined) {
                trialDurationDays = empresaSnap.data().freeEmDias;
                console.log(`Encontrada configuração de ${trialDurationDays} dias de teste para a empresa ativa.`);
            }
        } else {
            console.log("Nenhuma empresa ativa no localStorage. Usando 15 dias de teste como padrão.");
        }

        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);

        if (endDate > new Date()) {
            return { hasActivePlan: false, isTrialActive: true };
        }

        return safeReturn; // Trial expirado

    } catch (error) {
        console.error("Erro em checkUserStatus:", error);
        return safeReturn;
    }
}

// --- Função Principal (sem alterações na lógica) ---
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
                // Lógica do Admin (sem alterações)
                const primeiraEmpresaQuery = query(collection(db, "empresarios"));
                const snapshot = await getDocs(primeiraEmpresaQuery);
                if (!snapshot.empty) {
                    localStorage.setItem('empresaAtivaId', snapshot.docs[0].id);
                }
                return resolve({ user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, empresaId: localStorage.getItem('empresaAtivaId'), isOwner: true, role: 'admin' });
            }

            // Lógica para usuários normais (sem alterações)
            const { hasActivePlan, isTrialActive } = await checkUserStatus();
            if (!hasActivePlan && !isTrialActive) {
                if (currentPage !== 'assinatura.html') {
                    window.location.href = 'assinatura.html';
                }
                return reject(new Error("Assinatura expirada."));
            }

            try {
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    if (empresasSnapshot.size === 1) {
                        const empresaDoc = empresasSnapshot.docs[0];
                        localStorage.setItem('empresaAtivaId', empresaDoc.id);
                        const empresaData = empresaDoc.data();
                        empresaData.nome = (await getDoc(doc(db, "usuarios", user.uid))).data()?.nome || user.displayName;
                        return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                    } else {
                        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                        if (empresaAtivaId && empresasSnapshot.docs.some(d => d.id === empresaAtivaId)) {
                             const empresaDoc = empresasSnapshot.docs.find(d => d.id === empresaAtivaId);
                             const empresaData = empresaDoc.data();
                             empresaData.nome = (await getDoc(doc(db, "usuarios", user.uid))).data()?.nome || user.displayName;
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
                    const empresaId = mapaSnap.data().empresaId;
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);
                    if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                         localStorage.setItem('empresaAtivaId', empresaId);
                         return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" });
                    } else {
                        return reject(new Error("aguardando_aprovacao"));
                    }
                }

                return reject(new Error("primeiro_acesso"));
            } catch (error) {
                return reject(error);
            }
        });
    });
}
