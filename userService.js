// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO FINAL - SEM LOOP INFINITO (PARA O VERCEL)
// ======================================================================

// Imports
import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// Funções Auxiliares
async function getEmpresasDoDono(uid ) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot;
}
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

// Função Principal
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
                const primeiraEmpresaQuery = query(collection(db, "empresarios"));
                const snapshot = await getDocs(primeiraEmpresaQuery);
                if (!snapshot.empty) {
                    localStorage.setItem('empresaAtivaId', snapshot.docs[0].id);
                }
                return resolve({ user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, empresaId: localStorage.getItem('empresaAtivaId'), isOwner: true, role: 'admin' });
            }

            // Etapa 2: Para usuários normais, buscar TODOS os dados de uma vez.
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            const empresasSnapshot = await getEmpresasDoDono(user.uid);

            if (!userSnap.exists()) {
                return reject(new Error("primeiro_acesso"));
            }
            const userData = userSnap.data();

            // Etapa 3: Verificar assinatura com os dados já buscados.
            const hasActivePlan = userData.isPremium === true;
            let isTrialActive = false;
            if (!hasActivePlan && userData.trialStart?.seconds) {
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
                if (endDate > new Date()) {
                    isTrialActive = true;
                }
            }

            if (!hasActivePlan && !isTrialActive) {
                if (currentPage !== 'assinatura.html') {
                    window.location.href = 'assinatura.html';
                }
                return reject(new Error("Assinatura expirada."));
            }

            // Etapa 4: Se chegou aqui, o usuário tem acesso. Prossiga com a lógica de perfil.
            if (empresasSnapshot && !empresasSnapshot.empty) {
                if (empresasSnapshot.size === 1) {
                    const empresaDoc = empresasSnapshot.docs[0];
                    localStorage.setItem('empresaAtivaId', empresaDoc.id);
                    const empresaData = empresaDoc.data();
                    empresaData.nome = userData.nome || user.displayName || user.email;
                    return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                } else {
                    const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                    const empresaAtivaValida = empresasSnapshot.docs.some(doc => doc.id === empresaAtivaId);
                    if (empresaAtivaId && empresaAtivaValida) {
                         const empresaDoc = empresasSnapshot.docs.find(doc => doc.id === empresaAtivaId);
                         const empresaData = empresaDoc.data();
                         empresaData.nome = userData.nome || user.displayName || user.email;
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
        });
    });
}
