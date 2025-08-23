// ======================================================================
//                      USERSERVICE.JS (Revisado)
//           VERSÃO FINAL COM LÓGICA MULTI-EMPRESA (FORÇA SELEÇÃO)
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
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js'; // Ajuste o caminho se necessário

// --- Funções Auxiliares ---

/**
 * Busca todas as empresas associadas ao dono autenticado.
 * @param {string} uid - O ID do dono.
 * @returns {Promise<QuerySnapshot<DocumentData>>}
 */
async function getEmpresasDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    return await getDocs(q);
}

// --- Funções Exportadas ---

/**
 * Garante que o documento do usuário exista em 'usuarios' e inicia o trial se necessário.
 */
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
        await updateDoc(userRef, { trialStart: serverTimestamp() });
    }
}

/**
 * Verifica status de assinatura e trial do usuário logado.
 * @returns {Promise<{hasActivePlan: boolean, isTrialActive: boolean, trialEndDate: Date|null}>}
 */
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
            if (endDate > new Date()) isTrialActive = true;
        }
        return { hasActivePlan, isTrialActive, trialEndDate };
    } catch (_) {
        return safeReturn;
    }
}

/**
 * ======================================================================
 *    FUNÇÃO PRINCIPAL MULTI-EMPRESA - REVISADA
 *    Sempre mostra seleção se houver múltiplas empresas!
 * ======================================================================
 * Verifica acesso do usuário e redireciona conforme vínculo com empresas.
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
                // 1. DONO: verifica empresas associadas
                const empresasSnapshot = await getEmpresasDoDono(user.uid);
                console.log(`Foram encontradas ${empresasSnapshot ? empresasSnapshot.size : 0} empresas para este dono.`);

                const currentPage = window.location.pathname.split('/').pop();

                if (empresasSnapshot && !empresasSnapshot.empty) {
                    // Se tem UMA empresa, entra direto
                    if (empresasSnapshot.size === 1) {
                        console.log("Cenário: UMA empresa. Entrando direto.");
                        const empresaDoc = empresasSnapshot.docs[0];
                        localStorage.setItem('empresaAtivaId', empresaDoc.id);

                        const empresaData = empresaDoc.data();
                        const userDocRef = doc(db, "usuarios", user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome
                            ? userDocSnap.data().nome
                            : (user.displayName || user.email);

                        return resolve({
                            user,
                            empresaId: empresaDoc.id,
                            perfil: empresaData,
                            isOwner: true,
                            role: "dono"
                        });
                    }
                    // Se tem MAIS de uma empresa, força seleção SEMPRE!
                    if (empresasSnapshot.size > 1) {
                        console.log("Cenário: MULTIPLAS empresas. Forçando seleção.");
                        // Limpa empresa ativa anterior
                        localStorage.removeItem('empresaAtivaId');
                        if (currentPage !== 'selecionar-empresa.html' && currentPage !== 'perfil.html') {
                            window.location.href = 'selecionar-empresa.html';
                            return reject(new Error("A redirecionar para a seleção de empresa."));
                        }
                        return resolve({ user, isOwner: true, role: "dono" });
                    }
                }

                // 2. FUNCIONÁRIO: mapeamento por mapaUsuarios
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);
                if (mapaSnap.exists()) {
                    const empresaId = mapaSnap.data().empresaId;
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);

                    if (profissionalSnap.exists()) {
                        if (profissionalSnap.data().status === 'ativo') {
                            localStorage.setItem('empresaAtivaId', empresaId);
                            return resolve({
                                user,
                                perfil: profissionalSnap.data(),
                                empresaId,
                                isOwner: false,
                                role: "funcionario"
                            });
                        } else {
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }

                // 3. PRIMEIRO ACESSO: não é dono nem funcionário
                console.log("Cenário: PRIMEIRO ACESSO. Nenhum vínculo encontrado.");
                return reject(new Error("primeiro_acesso"));
            } catch (error) {
                return reject(error);
            }
        });
    });
}
