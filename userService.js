/**
 * @file userService.js
 * @description Módulo central para gerenciamento de usuários, empresas e sessões.
 * Contém a lógica principal de verificação de acesso da aplicação.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final
 */

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" da sessão para evitar buscas repetidas no banco de dados
let cachedSessionProfile = null;
let isProcessing = false;

/**
 * Garante que um documento para o usuário exista na coleção 'usuarios' e que
 * ele tenha uma data de início de trial.
 */
export async function ensureUserAndTrialDoc() {
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
 * Verifica se o usuário tem um plano ativo ou se o período de trial ainda é válido.
 * @param {object} user - O objeto de usuário do Firebase Auth.
 * @param {object} empresaData - Os dados da empresa ativa.
 * @returns {object} Um objeto com { hasActivePlan: boolean, isTrialActive: boolean }.
 */
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true }; // Permite o acesso inicial
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
        
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: true };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };

        let trialDurationDays = 15; // Duração padrão do trial
        if (empresaData && typeof empresaData.freeEmDias === 'number') {
            trialDurationDays = empresaData.freeEmDias;
        }
        
        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);
        
        return { hasActivePlan: false, isTrialActive: endDate > new Date() };
    } catch (error) { 
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: true }; // Em caso de erro, permite o trial
    }
}

/**
 * Busca todas as empresas associadas a um usuário, seja como dono ou profissional.
 * @param {object} user - O objeto de usuário do Firebase Auth.
 * @returns {Array} Uma lista de objetos de empresa.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    
    const empresasEncontradas = new Map();

    // 1. Busca por empresas onde o usuário é o dono
    try {
        const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            if (!empresasEncontradas.has(doc.id)) {
                empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    } catch (e) { console.error("❌ [getEmpresasDoUsuario] Erro ao buscar como dono:", e); }

    // 2. Busca por empresas onde o usuário é profissional (via mapa)
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && mapaSnap.data().empresas) {
            const idsDeEmpresas = mapaSnap.data().empresas;
            const promessas = idsDeEmpresas.map(id => getDoc(doc(db, "empresarios", id)));
            const resultados = await Promise.all(promessas);
            resultados.forEach(doc => {
                if (doc.exists() && !empresasEncontradas.has(doc.id)) {
                    empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
        }
    } catch(e) { console.error("❌ [getEmpresasDoUsuario] Erro ao buscar pelo mapa:", e); }
    
    return Array.from(empresasEncontradas.values());
}


/**
 * Função guarda principal: Valida a sessão, empresa ativa, plano e permissões.
 * É o ponto de entrada para qualquer página protegida.
 * @returns {Promise<object>} Uma promessa que resolve com o objeto da sessão do usuário.
 */
export async function verificarAcesso() {
    if (cachedSessionProfile) return Promise.resolve(cachedSessionProfile);
    if (isProcessing) return Promise.reject(new Error("Redirecionando..."));
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Executa apenas uma vez
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'nova-empresa.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    isProcessing = false;
                    return reject(new Error("Utilizador não autenticado. Redirecionando..."));
                }

                await ensureUserAndTrialDoc();
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;

                if (empresaAtivaId) {
                    const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (empresaDoc.exists()) {
                        empresaDocSnap = empresaDoc;
                    } else {
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                    }
                }

                if (!empresaDocSnap) {
                    const empresas = await getEmpresasDoUsuario(user);
                    if (empresas.length === 0) {
                        if (!paginasDeConfig.includes(currentPage)) window.location.replace('nova-empresa.html');
                        return reject(new Error("Nenhuma empresa associada. Redirecionando..."));
                    } else if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    } else {
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        return reject(new Error("Múltiplas empresas, seleção necessária. Redirecionando..."));
                    }
                }

                if (!empresaDocSnap || !empresaDocSnap.exists()) return reject(new Error("Empresa não encontrada."));

                const empresaData = empresaDocSnap.data();
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive) {
                    if (currentPage !== 'assinatura.html') window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada. Redirecionando..."));
                }

                const isOwner = empresaData.donoId === user.uid;
                let perfilDetalhado;
                let papel;

                // Define o papel (a "fonte da verdade")
                if (isAdmin) {
                    papel = 'admin';
                } else if (isOwner) {
                    papel = 'dono';
                } else {
                    papel = 'funcionario';
                }

                // Busca o perfil detalhado com base no papel
                if (papel === 'funcionario') {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.clear();
                        window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = { ...profSnap.data(), ehDono: false };
                } else { // Para Dono e Admin
                    perfilDetalhado = { ...empresaData, nome: user.displayName || user.email, ehDono: true, status: 'ativo', email: user.email };
                }
                
                // ⭐ REVISÃO: Adicionamos o 'papel' diretamente ao perfil para uso fácil na UI
                perfilDetalhado.papel = papel;

                cachedSessionProfile = {
                    user,
                    empresaId: empresaAtivaId,
                    perfil: perfilDetalhado,
                    isAdmin: isAdmin
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
