// ======================================================================
//             USER-SERVICE.JS (VERSÃO FINAL REVISADA E CORRIGIDA)
// - Busca empresas usando apenas o campo NOVO "empresas" (array) de mapaUsuarios.
// - Admin NÃO vê todas as empresas na seleção, vê apenas as suas (igual usuário comum).
// - Admin pode acessar painel administrativo separado para ver/editar todas se desejar.
// - Lógica de validação resiliente para sessão, login, seleção de empresa ativa, trial/premium.
// - Corrige e remove dependências de métodos/campos antigos (ignora empresaId legado).
// - Protegido contra race conditions e multi-execução.
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação desnecessária
let cachedSessionProfile = null;
let isProcessing = false; // Previne múltiplas execuções simultâneas

// --- Função: Garante doc do usuário e trial ---
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

// --- Função: Checa status de plano/trial ---
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

        let trialDurationDays = 15; // padrão
        if (empresaData && typeof empresaData.freeEmDias === 'number') {
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
 * Busca empresas do usuário (admin e usuários comuns veem apenas suas empresas na seleção):
 * - Busca o array 'empresas' do doc mapaUsuarios/{uid}.
 * - IGNORA qualquer campo legado (ex: empresaId antigo).
 * - NÃO FILTRA por trial, plano, status, etc — a seleção mostra todas.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];

    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (!mapaSnap.exists()) return [];
        const mapaData = mapaSnap.data();
        if (!mapaData || !Array.isArray(mapaData.empresas)) return [];
        const empresaIds = mapaData.empresas.filter(id => id && typeof id === 'string');
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
// FUNÇÃO GUARDA PRINCIPAL: Valida sessão, empresa ativa, plano, permissões
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) return Promise.resolve(cachedSessionProfile);
    if (isProcessing) return Promise.reject(new Error("Race condition detectada."));
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

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

                // Tenta usar empresa ativa salva
                if (empresaAtivaId) {
                    const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (empresaDoc.exists()) {
                        empresaDocSnap = empresaDoc;
                    } else {
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                    }
                }

                // Se não há empresa ativa válida, busca todas as empresas do usuário
                if (!empresaDocSnap) {
                    const empresas = await getEmpresasDoUsuario(user);
                    if (empresas.length === 0) {
                        if (!paginasDeConfig.includes(currentPage)) window.location.replace('perfil.html');
                        isProcessing = false;
                        return reject(new Error("Nenhuma empresa associada."));
                    } else if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    } else if (empresas.length > 1) {
                        // Multiempresa: sempre força seleção
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        isProcessing = false;
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    }
                }

                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    isProcessing = false;
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                if (!empresaData) {
                    isProcessing = false;
                    return reject(new Error("Dados da empresa inválidos."));
                }

                // Validação de assinatura/trial: só para acesso ao painel, não para seleção!
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive) {
                    if (currentPage !== 'assinatura.html') window.location.replace('assinatura.html');
                    isProcessing = false;
                    return reject(new Error("Assinatura expirada."));
                }

                // Checagem de permissão
                const isOwner = empresaData.donoId === user.uid;
                let perfilDetalhado = empresaData;
                let role = 'dono';

                if (!isOwner && !isAdmin) {
                    // Busca em profissionais (subcoleção)
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        isProcessing = false;
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = profSnap.data();
                    role = 'funcionario';
                }

                // Sessão cacheada
                cachedSessionProfile = { 
                    user, 
                    empresaId: empresaAtivaId, 
                    perfil: perfilDetalhado, 
                    isOwner: isOwner || isAdmin,
                    isAdmin: isAdmin, 
                    role 
                };
                isProcessing = false;
                resolve(cachedSessionProfile);

            } catch (error) {
                isProcessing = false;
                reject(error);
            }
        });

        // Safety fallback: limpa isProcessing após 5s se algo travar
        setTimeout(() => { isProcessing = false; }, 5000);
    });
}

// --- Função para limpar cache ---
export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
}

/**
 * FUNÇÃO ADMINISTRATIVA OPCIONAL
 * Use apenas no painel administrativo exclusivo para admin!
 * Busca todas as empresas da coleção 'empresarios' (não interfere na tela de seleção comum).
 */
export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
