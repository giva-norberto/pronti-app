// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL - CORREÇÃO DA LÓGICA DE NOVO USUÁRIO
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

        if (!userSnap.exists()) {
            // Se o documento do usuário ainda não foi criado, não podemos fazer nada.
            // Isso pode acontecer em um breve momento antes do ensureUserAndTrialDoc completar.
            // Considerar o trial ativo por segurança evita um bloqueio indevido.
            return { hasActivePlan: false, isTrialActive: true };
        }
        
        const userData = userSnap.data();

        // Se o usuário já pagou, o acesso é liberado.
        if (userData.isPremium === true) {
            return { hasActivePlan: true, isTrialActive: false };
        }

        // Se a data de início do trial não existe, algo está errado, mas não devemos bloquear.
        if (!userData.trialStart?.seconds) {
            return { hasActivePlan: false, isTrialActive: true };
        }

        // Busca as empresas do dono para pegar os dias de teste.
        const empresasSnapshot = await getEmpresasDoDono(user.uid);

        // CRUCIAL: Se o usuário é novo e AINDA NÃO TEM EMPRESA, o trial DEVE estar ativo.
        if (!empresasSnapshot || empresasSnapshot.empty) {
            console.log("Usuário novo sem empresa. Trial considerado ativo por padrão.");
            return { hasActivePlan: false, isTrialActive: true };
        }

        // Se tem empresa, pega a configuração de dias de teste dela.
        let trialDurationDays = 15; // Padrão
        const empresaData = empresasSnapshot.docs[0].data();
        if (empresaData.freeEmDias !== undefined) {
            trialDurationDays = empresaData.freeEmDias;
        }
        
        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);

        // Retorna se o trial está ativo ou não.
        return { hasActivePlan: false, isTrialActive: endDate > new Date() };

    } catch (error) {
        console.error("Erro em checkUserStatus:", error);
        return safeReturn; // Em caso de erro, não bloqueia o usuário.
    }
}

// --- Função Principal (verificarAcesso) - SEM ALTERAÇÕES ---
export async function verificarAcesso() {
    // O corpo desta função permanece exatamente o mesmo da versão anterior.
    // ... (cole o corpo da função verificarAcesso da versão anterior aqui)
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
                const primeiraEmpresaQuery = query(collection(db, "empresarios"));
                const snapshot = await getDocs(primeiraEmpresaQuery);
                if (!snapshot.empty) {
                    localStorage.setItem('empresaAtivaId', snapshot.docs[0].id);
                }
                return resolve({ user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, empresaId: localStorage.getItem('empresaAtivaId'), isOwner: true, role: 'admin' });
            }

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
