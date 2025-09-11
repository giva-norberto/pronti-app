/**
 * @file userService.js
 * @description Módulo central para gerenciamento de usuários, empresas e sessões.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final-Com-Verificacao-De-Horario
 */

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

/**
 * ✅ NOVO: Sistema de Verificação de Horário.
 * Verifica se o relógio do cliente está sincronizado com a hora mundial.
 * Uma diferença significativa causa erros de permissão no Firebase.
 * @throws {Error} Se o relógio do cliente estiver dessincronizado.
 */
async function verificarSincroniaDoRelogio() {
    try {
        // Usa uma API pública confiável para obter a hora UTC atual.
        const response = await fetch('https://worldtimeapi.org/api/ip');
        if (!response.ok) {
            console.warn('Aviso: Não foi possível verificar a sincronia do relógio. A aplicação continuará, mas pode falhar se o horário estiver incorreto.');
            return;
        }

        const data = await response.json();
        const horaServidor = new Date(data.utc_datetime);
        const horaCliente = new Date();
        
        // Calcula a diferença em minutos.
        const diferencaEmMinutos = Math.abs(horaServidor.getTime() - horaCliente.getTime()) / 60000;

        // Se a diferença for maior que 5 minutos, é um erro crítico que impede a comunicação com o Firebase.
        if (diferencaEmMinutos > 5) {
            throw new Error(`O relógio do seu sistema está incorreto e precisa ser ajustado. Detectamos uma diferença de aproximadamente ${Math.round(diferencaEmMinutos)} minutos. Por favor, corrija a data e a hora do seu sistema para continuar.`);
        }
    } catch (error) {
        // Propaga o erro para que a função 'verificarAcesso' possa impedi-lo de continuar.
        throw error;
    }
}


/**
 * Garante que um documento para o usuário exista na coleção 'usuarios'.
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
 * Verifica o status do plano ou trial do usuário.
 */
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

        let trialDurationDays = 15;
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
 * Busca as empresas associadas a um usuário usando o 'mapaUsuarios'.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);

        if (!mapaSnap.exists() || !mapaSnap.data().empresas || mapaSnap.data().empresas.length === 0) {
            return [];
        }

        const idsDeEmpresas = mapaSnap.data().empresas;

        if (idsDeEmpresas.length === 0) {
            return [];
        }

        const q = query(collection(db, "empresarios"), where(documentId(), "in", idsDeEmpresas));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas pelo mapa:", e);
        return []; 
    }
}

/**
 * Função guarda principal: Valida a sessão, empresa ativa, plano e permissões.
 */
export async function verificarAcesso() {
    // ETAPA 1: VERIFICAÇÃO DE HORÁRIO (NOVA)
    try {
        await verificarSincroniaDoRelogio();
    } catch (error) {
        // Se o relógio estiver errado, impede a continuação e informa o erro exato.
        isProcessing = false;
        // A página que chamou (ex: index.html) deve pegar este erro e mostrar ao usuário.
        return Promise.reject(error);
    }

    // LÓGICA EXISTENTE (SÓ RODA SE O HORÁRIO ESTIVER CORRETO)
    if (cachedSessionProfile) return Promise.resolve(cachedSessionProfile);
    if (isProcessing) return Promise.reject(new Error("Redirecionando..."));
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

                if (isAdmin) {
                    papel = 'admin';
                } else if (isOwner) {
                    papel = 'dono';
                } else {
                    papel = 'funcionario';
                }

                if (papel === 'funcionario') {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.clear();
                        window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = { ...profSnap.data(), ehDono: false };
                } else {
                    perfilDetalhado = { ...empresaData, nome: user.displayName || user.email, ehDono: true, status: 'ativo', email: user.email };
                }
                
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
