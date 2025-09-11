/**
 * @file userService.js
 * @description Módulo central para gerenciamento de usuários, empresas e sessões.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final (Corrigido para Seleção, Permissões e ReferenceError)
 */

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// ======================= INÍCIO DA CORREÇÃO DO ERRO =======================
// ✅ RESTAURADO: As duas linhas que eu apaguei por engano. Elas definem o cache.
let cachedSessionProfile = null;
let isProcessing = false;
// ======================== FIM DA CORREÇÃO DO ERRO =========================


// Funções auxiliares (checkUserStatus, ensureUserAndTrialDoc )
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || !userSnap.data()) return { hasActivePlan: false, isTrialActive: true };
        const userData = userSnap.data();
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };
        let trialDurationDays = empresaData?.freeEmDias ?? 15;
        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);
        return { hasActivePlan: false, isTrialActive: endDate > new Date() };
    } catch (error) { 
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: true };
    }
}

async function ensureUserAndTrialDoc() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { nome: user.displayName || user.email || 'Usuário', email: user.email || '', trialStart: serverTimestamp(), isPremium: false });
        } else if (!userSnap.data().trialStart) {
            await updateDoc(userRef, { trialStart: serverTimestamp() });
        }
    } catch (error) { console.error("❌ [ensureUserAndTrialDoc] Erro:", error); }
}


/**
 * Busca todas as empresas associadas a um usuário.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();

    try {
        const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            if (!empresasEncontradas.has(doc.id)) {
                empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    } catch (e) { console.error("❌ [getEmpresasDoUsuario] Erro ao buscar como dono:", e); }

    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && mapaSnap.data().empresas && mapaSnap.data().empresas.length > 0) {
            const idsDeEmpresas = mapaSnap.data().empresas;
            const empresasRef = collection(db, "empresarios");
            const q = query(empresasRef, where(documentId(), "in", idsDeEmpresas));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                if (!empresasEncontradas.has(doc.id)) {
                    empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
        }
    } catch(e) { console.error("❌ [getEmpresasDoUsuario] Erro ao buscar pelo mapa:", e); }
    
    return Array.from(empresasEncontradas.values());
}


/**
 * Função guarda principal: Valida a sessão, empresa ativa, plano e permissões.
 */
export async function verificarAcesso() {
    if (cachedSessionProfile) return Promise.resolve(cachedSessionProfile);
    if (isProcessing) return new Promise((_, reject) => reject(new Error("Processamento em andamento...")));
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'nova-empresa.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    isProcessing = false;
                    return reject(new Error("Utilizador não autenticado."));
                }

                await ensureUserAndTrialDoc();
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;

                if (empresaAtivaId) {
                    const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (!empresaDoc.exists()) {
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                    } else {
                        empresaDocSnap = empresaDoc;
                    }
                }

                if (!empresaAtivaId) {
                    const empresas = await getEmpresasDoUsuario(user);

                    if (empresas.length === 0) {
                        if (currentPage !== 'nova-empresa.html') window.location.replace('nova-empresa.html');
                        return reject(new Error("Nenhuma empresa associada."));
                    }
                    
                    if (empresas.length > 1) {
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    }

                    if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    }
                }

                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    localStorage.removeItem('empresaAtivaId');
                    if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Empresa inválida. Selecione uma empresa."));
                }

                const empresaData = empresaDocSnap.data();
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive && !isAdmin) {
                    if (currentPage !== 'assinatura.html') window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                const isOwner = empresaData.donoId === user.uid;
                let papel = isAdmin ? 'admin' : (isOwner ? 'dono' : 'funcionario');
                let perfilDetalhado;

                if (papel === 'funcionario') {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.clear(); window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado."));
                    }
                    perfilDetalhado = { ...profSnap.data(), ehDono: false, papel };
                } else {
                    perfilDetalhado = { ...empresaData, nome: user.displayName || user.email, ehDono: true, status: 'ativo', email: user.email, papel };
                }

                cachedSessionProfile = { user, empresaId: empresaAtivaId, perfil: perfilDetalhado, isAdmin };
                resolve(cachedSessionProfile);

            } catch (error) {
                console.error("❌ Erro fatal em verificarAcesso:", error);
                reject(error);
            } finally {
                isProcessing = false;
            }
        });
    });
}
