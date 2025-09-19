// ======================================================================
//      USER-SERVICE.JS (VERSÃO FINAL COM LÓGICA DE ACESSO REVISADA)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

// ======================================================================
// SUAS FUNÇÕES ORIGINAIS (PRESERVADAS)
// ======================================================================

export async function ensureUserAndTrialDoc() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário',
                email: user.email || '',
                trialStart: serverTimestamp(),
                isPremium: false,
            });
        } else {
            const userData = userSnap.data();
            let updateObj = {};
            if (!userData.nome) updateObj.nome = user.displayName || user.email || 'Usuário';
            if (!userData.email) updateObj.email = user.email || '';
            if (!userData.trialStart) updateObj.trialStart = serverTimestamp();
            if (Object.keys(updateObj).length) {
                await updateDoc(userRef, updateObj);
            }
        }
    } catch (error) {
        console.error("❌ Erro em ensureUserAndTrialDoc:", error);
    }
}

// ---> CORREÇÃO: SUBSTITUÍDO PELA VERSÃO FINAL E CORRETA DA LÓGICA DE TRIAL <---
async function checkUserStatus(userId, empresaData) {
    try {
        if (!userId) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        const userRef = doc(db, "usuarios", userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };

        const trialDurationDays = empresaData?.freeEmDias ?? 0;
        let trialDaysRemaining = 0;
        let isTrialActive = false;

        // REGRA 1: CONTROLE MANUAL. Se 'freeEmDias' for 0, o trial é FORÇADO como expirado.
        if (trialDurationDays <= 0) {
            return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        }

        // REGRA 2: CÁLCULO DE TEMPO. Se 'freeEmDias' > 0, o tempo corre normalmente.
        if (userData.trialStart?.seconds) {
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (endDate >= hoje) {
                isTrialActive = true;
                trialDaysRemaining = Math.ceil((endDate - hoje) / (1000 * 60 * 60 * 24));
            }
        } else {
            isTrialActive = true;
            trialDaysRemaining = trialDurationDays;
        }
        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };
    } catch (error) {
        console.error("❌ Erro em checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
    }
}

export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();
    try {
        const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid), where("status", "==", "ativo"));
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            if (!empresasEncontradas.has(doc.id)) {
                empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    } catch (e) { console.error("❌ Erro ao buscar empresas (dono):", e); }
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && mapaSnap.data().empresas && mapaSnap.data().empresas.length > 0) {
            const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasEncontradas.has(id));
            if (idsDeEmpresas.length === 0) return Array.from(empresasEncontradas.values());
            
            for (let i = 0; i < idsDeEmpresas.length; i += 10) {
                const chunk = idsDeEmpresas.slice(i, i + 10);
                if (chunk.length > 0) {
                    const q = query(collection(db, "empresarios"), where(documentId(), "in", chunk), where("status", "==", "ativo"));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach(doc => {
                        if (!empresasEncontradas.has(doc.id)) {
                            empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
                        }
                    });
                }
            }
        }
    } catch(e) { console.error("❌ Erro ao buscar empresas (mapa):", e); }
    return Array.from(empresasEncontradas.values());
}

// ======================================================================
// ✅ FUNÇÃO PRINCIPAL 'verificarAcesso' (REVISADA E ORGANIZADA)
// Esta função agora segue uma ordem lógica que evita o "pisca-pisca" da tela.
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) return cachedSessionProfile;
    if (isProcessing) return Promise.reject(new Error("Processamento de acesso já em andamento."));
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html', 'recuperar-senha.html'];
                
                // 1. O usuário está logado?
                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) {
                        window.location.replace('login.html');
                    }
                    return reject(new Error("Usuário não autenticado."));
                }

                // A partir daqui, TEMOS um usuário logado.
                await ensureUserAndTrialDoc();
                
                // 2. Quantas empresas este usuário possui?
                const empresas = await getEmpresasDoUsuario(user);
                
                // 3. Se ele não tem NENHUMA empresa, o destino é criar uma.
                if (empresas.length === 0) {
                    if (currentPage !== 'meuperfil.html') { // Assumindo que 'meuperfil.html' é onde se cria
                        window.location.replace('meuperfil.html');
                    }
                    return reject(new Error("Nenhuma empresa. Redirecionando para criação."));
                }

                // 4. Se ele tem EXATAMENTE UMA empresa (LÓGICA ANTI-PISCA-PISCA)
                if (empresas.length === 1) {
                    const empresaUnica = empresas[0];
                    const status = await checkUserStatus(empresaUnica.donoId, empresaUnica);
                    localStorage.setItem('empresaAtivaId', empresaUnica.id);

                    if (status.isTrialActive) {
                        // Se o trial está OK, vai para o app
                        if (currentPage !== 'index.html') window.location.replace('index.html');
                        // Resolve para permitir que a página index carregue seu conteúdo
                        const sessionProfile = { user, empresaId: empresaUnica.id, statusAssinatura: status, empresas };
                        return resolve(sessionProfile);
                    } else {
                        // Se o trial expirou, vai para a assinatura
                        if (currentPage !== 'assinatura.html') window.location.replace('assinatura.html');
                        return reject(new Error("Assinatura expirada."));
                    }
                }

                // 5. Se chegamos aqui, ele tem MAIS DE UMA empresa.
                if (empresas.length > 1) {
                    if (currentPage !== 'selecionar-empresa.html') {
                        window.location.replace('selecionar-empresa.html');
                    }
                    // Rejeita para parar a execução e deixar a página de seleção carregar
                    return reject(new Error("Múltiplas empresas. Seleção necessária."));
                }

            } catch (error) {
                reject(error);
            } finally {
                isProcessing = false;
            }
        });
    });
}

// Suas outras funções exportadas, 100% preservadas.
export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
}

export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
