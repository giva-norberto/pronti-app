    // ======================================================================
    //                      USERSERVICE.JS
    //           VERSÃO FINAL COM LÓGICA MULTI-EMPRESA
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
     * Função auxiliar para encontrar TODOS os documentos de empresa associados a um dono.
     * @param {string} uid - O ID do dono.
     * @returns {Promise<QuerySnapshot<DocumentData>>} - O resultado da query.
     */
    async function getEmpresasDoDono(uid) {
        if (!uid) return null;
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const querySnapshot = await getDocs(q);
        return querySnapshot;
    }

    // --- Funções Exportadas ---

    /**
     * Garante que um documento para o utilizador exista na coleção 'usuarios' e que
     * o seu período de trial tenha sido iniciado.
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
     * Verifica o status de assinatura e trial do utilizador logado.
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
     * ======================================================================
     * FUNÇÃO PRINCIPAL ATUALIZADA PARA MÚLTIPLAS EMPRESAS
     * ======================================================================
     * Verifica o acesso do utilizador e o redireciona com base no número de empresas que ele possui.
     */
    export async function verificarAcesso() {
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                unsubscribe();

                if (!user) {
                    window.location.href = 'login.html';
                    return reject(new Error("Utilizador não autenticado."));
                }

                try {
                    // 1. Checa se é o DONO e busca as suas empresas
                    const empresasSnapshot = await getEmpresasDoDono(user.uid);
                    
                    if (empresasSnapshot && !empresasSnapshot.empty) {
                        // O utilizador é dono de pelo menos uma empresa.
                        const currentPage = window.location.pathname.split('/').pop();

                        if (empresasSnapshot.size === 1) {
                            // --- CENÁRIO: UMA EMPRESA ---
                            // Entra direto no painel.
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
                            // --- CENÁRIO: MÚLTIPLAS EMPRESAS ---
                            const empresaAtivaId = localStorage.getItem('empresaAtivaId');
                            const empresaAtivaValida = empresasSnapshot.docs.some(doc => doc.id === empresaAtivaId);

                            if (empresaAtivaId && empresaAtivaValida) {
                                // Se já tem uma empresa ativa selecionada, continua.
                                const empresaDoc = empresasSnapshot.docs.find(doc => doc.id === empresaAtivaId);
                                const empresaData = empresaDoc.data();
                                const userDocRef = doc(db, "usuarios", user.uid);
                                const userDocSnap = await getDoc(userDocRef);
                                empresaData.nome = userDocSnap.exists() && userDocSnap.data().nome ? userDocSnap.data().nome : (user.displayName || user.email);
                                return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                            } else {
                                // Se não tem seleção, força a ida para a tela de seleção.
                                if (currentPage !== 'selecionar-empresa.html' && currentPage !== 'perfil.html') {
                                    window.location.href = 'selecionar-empresa.html';
                                    return reject(new Error("A redirecionar para a seleção de empresa."));
                                }
                                return resolve({ user, isOwner: true, role: "dono" });
                            }
                        }
                    }

                    // 2. Se não é dono, checa se é FUNCIONÁRIO
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

                    // 3. Se não é dono nem funcionário, é o PRIMEIRO ACESSO
                    return reject(new Error("primeiro_acesso"));

                } catch (error) {
                    return reject(error);
                }
            });
        });
    }
