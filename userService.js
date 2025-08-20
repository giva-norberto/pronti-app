// ======================================================================
//                      USERSERVICE.JS
//             VERSÃO FINAL CORRIGIDA E REVISADA
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

// --- Funções Auxiliares ---

/**
 * Função auxiliar para encontrar o documento da empresa associado a um dono.
 */
async function getEmpresaDocPorDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    return querySnapshot.docs[0];
}

// --- Funções Exportadas ---

/**
 * Garante que um documento para o usuário exista na coleção 'usuarios' e que
 * seu período de trial tenha sido iniciado.
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
        await updateDoc(userRef, {
            trialStart: serverTimestamp()
        });
    }
}

/**
 * Verifica o status de assinatura e trial do usuário logado.
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
 * Verifica o acesso do usuário e retorna seu papel para montagem dinâmica do menu.
 * Não faz redirecionamentos automáticos (exceto login).
 */
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                window.location.href = 'login.html';
                return reject(new Error("Usuário não autenticado."));
            }

            try {
                // 1. Checa se é o DONO
                const empresaDoc = await getEmpresaDocPorDono(user.uid);
                if (empresaDoc) {
                    const empresaData = empresaDoc.data();
                    const userDocRef = doc(db, "usuarios", user.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists() && userDocSnap.data().nome) {
                        empresaData.nome = userDocSnap.data().nome;
                    } else {
                        empresaData.nome = user.displayName || user.email;
                    }

                    return resolve({
                        user,
                        empresaId: empresaDoc.id,
                        perfil: empresaData,
                        isOwner: true,
                        role: "dono"
                    });
                }

                // 2. Checa se é FUNCIONÁRIO
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                if (mapaSnap.exists()) {
                    const empresaId = mapaSnap.data().empresaId;
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);

                    if (profissionalSnap.exists()) {
                        if (profissionalSnap.data().status === 'ativo') {
                            return resolve({
                                user,
                                perfil: profissionalSnap.data(),
                                empresaId,
                                isOwner: false,
                                role: "funcionario"
                            });
                        } else {
                            // Profissional existe, mas não está ativo (aguardando aprovação)
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }

                // 3. Usuário existe em 'usuarios' mas não tem empresa nem vínculo como funcionário
                const userDocRef = doc(db, "usuarios", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    // Usuário existe, mas não foi vinculado a nenhuma empresa
                    return reject(new Error("primeiro_acesso"));
                }

                // Caso extremo: usuário nem existe nos usuários
                return reject(new Error("usuario_invalido"));
            } catch (error) {
                return reject(error);
            }
        });
    });
}
