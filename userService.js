// ======================================================================
//             USER-SERVICE.JS (VERSÃO FINAL E CORRIGIDA)
// - Lógica de busca de empresas compatível com estruturas de dados antigas e novas.
// - Lógica de verificação inteligente e auto-corretiva.
// - CORRIGIDO: O fluxo para utilizadores administradores agora concede
//   privilégios de 'dono' para qualquer empresa selecionada.
// - Proteção contra múltiplas execuções simultâneas (race conditions).
// ======================================================================

import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação desnecessária
let cachedSessionProfile = null;
let isProcessing = false; // Previne múltiplas execuções simultâneas

// --- Funções Auxiliares ---
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
        } else if (!userSnap.data().trialStart) {
            await updateDoc(userRef, {
                trialStart: serverTimestamp(),
            });
        }
    } catch (error) {
        console.error("❌ [ensureUserAndTrialDoc] Erro:", error);
    }
}

async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: true };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };
        
        let trialDurationDays = 15; // Padrão
        
        if (empresaData && typeof empresaData.freeEmDias === 'number' && empresaData.freeEmDias > 0) {
            trialDurationDays = empresaData.freeEmDias;
        }

        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);
        return { hasActivePlan: false, isTrialActive: endDate > new Date() };
    } catch (error) {
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: true };
    }
}

/**
 * Busca empresas. Se for admin, busca TODAS. Se for utilizador normal, busca no mapaUsuarios.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

    try {
        if (user.uid === ADMIN_UID) {
            const empresasCol = collection(db, "empresarios");
            const snap = await getDocs(empresasCol);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (!mapaSnap.exists()) {
            return [];
        }
        const mapaData = mapaSnap.data();
        if (!mapaData) return [];
        let empresaIds = [];
        if (mapaData.empresas && Array.isArray(mapaData.empresas)) {
            empresaIds = mapaData.empresas.filter(id => id && typeof id === 'string');
        } else if (mapaData.empresaId && typeof mapaData.empresaId === 'string') {
            empresaIds = [mapaData.empresaId];
        } else {
            return [];
        }
        if (empresaIds.length === 0) return [];
        const promessasEmpresas = empresaIds.map(id => getDoc(doc(db, "empresarios", id)));
        const docsEmpresas = await Promise.all(promessasEmpresas);
        return docsEmpresas
            .filter(doc => doc.exists())
            .map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("❌ [getEmpresasDoUsuario] Erro:", error);
        return [];
    }
}

// ======================================================================
// FUNÇÃO GUARDA PRINCIPAL (REESCRITA COM LÓGICA RESILIENTE)
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        return Promise.resolve(cachedSessionProfile);
    }
    if (isProcessing) {
        return Promise.reject(new Error("Race condition detectada."));
    }
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];
                const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    return reject(new Error("Utilizador não autenticado."));
                }

                await ensureUserAndTrialDoc();
                const isAdmin = user.uid === "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;

                if (empresaAtivaId) {
                    const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (empresaDoc.exists()) {
                        empresaDocSnap = empresaDoc;
                    } else {
                        localStorage.removeItem('empresaAtivaId');
                    }
                }

                if (!empresaDocSnap) {
                    const empresas = await getEmpresasDoUsuario(user);
                    if (empresas.length === 0) {
                        if (!paginasDeConfiguracao.includes(currentPage)) window.location.replace('perfil.html');
                        return reject(new Error("Nenhuma empresa associada."));
                    } else if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    } else {
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    }
                }
                
                if (!empresaDocSnap || !empresaDocSnap.exists()) return reject(new Error("Empresa não encontrada."));

                const empresaData = empresaDocSnap.data();
                if (!empresaData) return reject(new Error("Dados da empresa inválidos."));

                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive) {
                    if (currentPage !== 'assinatura.html') {
                        window.location.replace('assinatura.html');
                    }
                    return reject(new Error("Assinatura expirada."));
                }
                
                const isOwner = empresaData.donoId === user.uid;
                let perfilDetalhado = empresaData;
                let role = 'dono';

                if (!isOwner && !isAdmin) {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = profSnap.data();
                    role = 'funcionario';
                }

                // ### CORREÇÃO FINAL DA LÓGICA DE 'DONO' E 'ADMIN' ###
                // O perfil de sessão agora reflete a permissão correta.
                // Um admin terá sempre privilégios de dono.
                cachedSessionProfile = { 
                    user, 
                    empresaId: empresaAtivaId, 
                    perfil: perfilDetalhado, 
                    isOwner: isOwner || isAdmin, // <-- A CORREÇÃO ESTÁ AQUI
                    isAdmin: isAdmin, 
                    role 
                };
                resolve(cachedSessionProfile);

            } catch (error) {
                reject(error);
            } finally {
                isProcessing = false;
            }
        });
    });
}

export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
}
