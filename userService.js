// ======================================================================
//                      USERSERVICE.JS
//         VERSÃO FINAL COM LÓGICA MULTI-EMPRESA E COBRANÇA
// ======================================================================

// Imports do Firebase
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

// --- Funções Auxiliares (INTACTAS) ---

async function getEmpresasDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot;
}

// --- Funções Exportadas (INTACTAS) ---

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
            const trialDurationDays = 15;
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

/**
 * ======================================================================
 * FUNÇÃO PRINCIPAL COM A ADIÇÃO DA VERIFICAÇÃO DE COBRANÇA
 * ======================================================================
 */
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                window.location.href = 'login.html';
                return reject(new Error("Utilizador não autenticado."));
            }

            console.log("--- Iniciando verificação de acesso para o utilizador:", user.uid, "---");

            try {
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                console.log(`Foram encontradas ${empresasSnapshot ? empresasSnapshot.size : 0} empresas para este dono.`);

                // ===================================================================
                //               NOVA LÓGICA DE VERIFICAÇÃO DE TRIAL
                // ===================================================================
                // Esta verificação acontece ANTES de decidir para onde o dono vai.
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    const status = await checkUserStatus();
                    const currentPage = window.location.pathname.split('/').pop();

                    if (!status.hasActivePlan && !status.isTrialActive && currentPage !== 'assinatura.html') {
                        console.log("Trial expirado. Redirecionando para a página de assinatura.");
                        window.location.href = 'assinatura.html';
                        return reject(new Error("Assinatura expirada.")); // Para a execução
                    }
                }
                // ===================================================================

                if (empresasSnapshot && !empresasSnapshot.empty) {
                    const currentPage = window.location.pathname.split('/').pop();
                    console.log(`Número de empresas: ${empresasSnapshot.size}. Página atual: ${currentPage}`);

                    if (empresasSnapshot.size === 1) {
                        console.log("Cenário: UMA empresa. A entrar diretamente.");
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
                        console.log("Cenário: MÚLTIPLAS empresas. A verificar se uma empresa ativa já foi selecionada.");
                        const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                        console.log("ID da empresa ativa no localStorage:", empresaAtivaId);
                        const empresaAtivaValida = empresasSnapshot.docs.some(doc => doc.id === empresaAtivaId);

                        if (empresaAtivaId && empresaAtivaValida) {
                            console.log("Empresa ativa válida encontrada. A continuar a navegação.");
                             const empresaDoc = empresasSnapshot.docs.find(doc => doc.id === empresaAtivaId);
                             const empresaData = empresaDoc.data();
                             const userDocRef = doc(db, "usuarios", user.uid);
                             const userDocSnap = await getDoc(userDocRef);
                             empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                             return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                        } else {
                            console.log("Nenhuma empresa ativa válida. A verificar se é necessário redirecionar.");
                            if (currentPage !== 'selecionar-empresa.html' && currentPage !== 'perfil.html') {
                                console.log("Redirecionando para a tela de seleção...");
                                window.location.href = 'selecionar-empresa.html';
                                return new Promise(() => {});
                            }
                            return resolve({ user, isOwner: true, role: "dono" });
                        }
                    }
                }

                // A sua lógica de funcionário continua intacta
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

                console.log("Cenário: PRIMEIRO ACESSO. Nenhum vínculo de dono ou funcionário encontrado.");
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                return reject(error);
            }
        });
    });
}
