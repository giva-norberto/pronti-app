// ======================================================================
//             USER-SERVICE.JS (VERSÃO FINAL E RESILIENTE - CORRIGIDA)
// - Lógica de busca de empresas compatível com estruturas de dados antigas e novas.
// - Lógica de verificação inteligente e auto-corretiva.
// - Corrigido o fluxo para utilizadores que também são administradores.
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
        if (!user) {
            console.warn("❌ [ensureUserAndTrialDoc] Usuário não autenticado");
            return;
        }

        console.log("🔍 [ensureUserAndTrialDoc] Verificando documento do usuário:", user.uid);
        
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            console.log("📝 [ensureUserAndTrialDoc] Criando documento do usuário");
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário',
                email: user.email || '',
                trialStart: serverTimestamp(),
                isPremium: false,
            });
        } else if (!userSnap.data().trialStart) {
            console.log("📝 [ensureUserAndTrialDoc] Atualizando trialStart");
            await updateDoc(userRef, {
                trialStart: serverTimestamp(),
            });
        }
    } catch (error) {
        console.error("❌ [ensureUserAndTrialDoc] Erro:", error);
        // Não propaga o erro para não quebrar o fluxo principal
    }
}

async function checkUserStatus(user, empresaData) {
    try {
        if (!user) {
            console.warn("❌ [checkUserStatus] Usuário não fornecido");
            return { hasActivePlan: false, isTrialActive: true };
        }

        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            console.log("⚠️ [checkUserStatus] Documento do usuário não existe");
            return { hasActivePlan: false, isTrialActive: true };
        }
        
        const userData = userSnap.data();
        if (!userData) {
            console.warn("❌ [checkUserStatus] Dados do usuário inválidos");
            return { hasActivePlan: false, isTrialActive: true };
        }

        if (userData.isPremium === true) {
            return { hasActivePlan: true, isTrialActive: false };
        }
        
        if (!userData.trialStart?.seconds) {
            return { hasActivePlan: false, isTrialActive: true };
        }
        
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

// --- FUNÇÃO EXPORTADA (CORRIGIDA COM COMPATIBILIDADE) ---

/**
 * Busca todas as empresas associadas a um utilizador a partir do mapaUsuarios.
 * É compatível com o formato antigo (empresaId: string) e o novo (empresas: array).
 * @param {User} user O objeto do utilizador autenticado.
 * @returns {Promise<Array>} Uma lista de objetos de empresa aos quais o utilizador tem acesso.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) {
        console.warn("❌ [getEmpresasDoUsuario] Usuário não fornecido");
        return [];
    }

    try {
        console.log("🔍 [getEmpresasDoUsuario] Buscando empresas para:", user.uid);
        
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);

        if (!mapaSnap.exists()) {
            console.warn("⚠️ [getEmpresasDoUsuario] Documento não encontrado em mapaUsuarios para este utilizador.");
            return [];
        }

        const mapaData = mapaSnap.data();
        if (!mapaData) {
            console.warn("❌ [getEmpresasDoUsuario] Dados do mapa inválidos");
            return [];
        }

        let empresaIds = [];

        // LÓGICA DE COMPATIBILIDADE PARA CORRIGIR O ERRO
        if (mapaData.empresas && Array.isArray(mapaData.empresas)) {
            // Se encontrar o novo formato (array), usa-o.
            console.log("✅ [getEmpresasDoUsuario] Formato 'empresas' (array) encontrado no mapaUsuarios.");
            empresaIds = mapaData.empresas.filter(id => id && typeof id === 'string');
        } else if (mapaData.empresaId && typeof mapaData.empresaId === 'string') {
            // Se encontrar o formato antigo (string), trata-o como uma lista de uma empresa.
            console.warn("⚠️ [getEmpresasDoUsuario] Formato antigo 'empresaId' (string) encontrado. A processar com compatibilidade.");
            empresaIds = [mapaData.empresaId];
        } else {
            // Se não encontrar nenhum dos formatos esperados.
            console.warn("❌ [getEmpresasDoUsuario] Nenhum campo 'empresas' (array) ou 'empresaId' (string) encontrado no mapaUsuarios.");
            return [];
        }

        if (empresaIds.length === 0) {
            console.log("⚠️ [getEmpresasDoUsuario] Nenhuma empresa encontrada");
            return [];
        }

        console.log("🔍 [getEmpresasDoUsuario] Buscando dados das empresas:", empresaIds);

        const promessasEmpresas = empresaIds.map(empresaId => {
            try {
                return getDoc(doc(db, "empresarios", empresaId));
            } catch (error) {
                console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresa:", empresaId, error);
                return Promise.resolve(null);
            }
        });

        const docsEmpresas = await Promise.all(promessasEmpresas);

        const empresasValidas = [];
        for (let i = 0; i < docsEmpresas.length; i++) {
            const empresaDoc = docsEmpresas[i];
            if (empresaDoc && empresaDoc.exists()) {
                const empresaData = empresaDoc.data();
                if (empresaData) {
                    empresasValidas.push({ 
                        id: empresaDoc.id, 
                        ...empresaData,
                        nome: empresaData.nome || 'Empresa sem nome'
                    });
                }
            } else {
                console.warn("⚠️ [getEmpresasDoUsuario] Empresa não encontrada:", empresaIds[i]);
            }
        }

        console.log("✅ [getEmpresasDoUsuario] Empresas válidas encontradas:", empresasValidas.length);
        return empresasValidas;

    } catch (error) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas do utilizador:", error);
        return [];
    }
}

// ======================================================================
// FUNÇÃO GUARDA PRINCIPAL (REESCRITA COM LÓGICA RESILIENTE)
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        console.log("✅ [verificarAcesso] Usando perfil em cache");
        return Promise.resolve(cachedSessionProfile);
    }

    if (isProcessing) {
        console.log("⚠️ [verificarAcesso] Verificação já em andamento, aguardando...");
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (!isProcessing) {
                    clearInterval(checkInterval);
                    if (cachedSessionProfile) {
                        resolve(cachedSessionProfile);
                    } else {
                        reject(new Error("Verificação falhou"));
                    }
                }
            }, 100);
        });
    }

    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                unsubscribe();

                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];
                const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

                console.log("🔍 [verificarAcesso] Página atual:", currentPage);

                if (!user) {
                    console.log("❌ [verificarAcesso] Usuário não autenticado");
                    if (!paginasPublicas.includes(currentPage)) {
                        window.location.replace('login.html');
                    }
                    isProcessing = false;
                    return reject(new Error("Utilizador não autenticado."));
                }

                console.log("✅ [verificarAcesso] Usuário autenticado:", user.uid);

                await ensureUserAndTrialDoc();

                // MODIFICAÇÃO: A verificação de admin agora é apenas uma flag, não interrompe o fluxo.
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;

                let empresaAtivaId = null;
                try {
                    empresaAtivaId = localStorage.getItem('empresaAtivaId');
                } catch (error) {
                    console.error("❌ [verificarAcesso] Erro ao acessar localStorage:", error);
                }

                let acessoVerificado = false;
                let empresaDocSnap = null;

                if (empresaAtivaId) {
                    console.log("🔍 [verificarAcesso] Verificando empresa salva:", empresaAtivaId);
                    try {
                        const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                        if (empresaDoc.exists()) {
                            empresaDocSnap = empresaDoc;
                            acessoVerificado = true;
                            console.log("✅ [verificarAcesso] Empresa salva válida");
                        } else {
                            console.log("❌ [verificarAcesso] Empresa salva não existe mais");
                            try {
                                localStorage.removeItem('empresaAtivaId');
                            } catch (error) {
                                console.error("❌ [verificarAcesso] Erro ao remover do localStorage:", error);
                            }
                        }
                    } catch (error) {
                        console.error("❌ [verificarAcesso] Erro ao verificar empresa salva:", error);
                        try {
                            localStorage.removeItem('empresaAtivaId');
                        } catch (e) {
                            console.error("❌ [verificarAcesso] Erro ao remover do localStorage:", e);
                        }
                    }
                }

                if (!acessoVerificado) {
                    console.log("🔍 [verificarAcesso] Buscando empresas do usuário");
                    const empresas = await getEmpresasDoUsuario(user);
                    
                    if (empresas.length === 0) {
                        console.log("❌ [verificarAcesso] Nenhuma empresa associada");
                        if (!paginasDeConfiguracao.includes(currentPage)) {
                            window.location.replace('perfil.html');
                        }
                        isProcessing = false;
                        return reject(new Error("Nenhuma empresa associada."));
                    } else if (empresas.length === 1) {
                        console.log("✅ [verificarAcesso] Uma empresa encontrada, selecionando automaticamente");
                        empresaAtivaId = empresas[0].id;
                        try {
                            localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        } catch (error) {
                            console.error("❌ [verificarAcesso] Erro ao salvar no localStorage:", error);
                        }
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    } else {
                        console.log("🔄 [verificarAcesso] Múltiplas empresas, redirecionando para seleção");
                        if (currentPage !== 'selecionar-empresa.html') {
                            window.location.replace('selecionar-empresa.html');
                        }
                        isProcessing = false;
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    }
                }
                
                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    console.error("❌ [verificarAcesso] Documento da empresa não encontrado");
                    isProcessing = false;
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                if (!empresaData) {
                    console.error("❌ [verificarAcesso] Dados da empresa inválidos");
                    isProcessing = false;
                    return reject(new Error("Dados da empresa inválidos."));
                }

                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);

                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("❌ [verificarAcesso] Assinatura expirada, redirecionando");
                    window.location.replace('assinatura.html');
                    isProcessing = false;
                    return reject(new Error("Assinatura expirada."));
                }
                
                const isOwner = empresaData.donoId === user.uid;
                let perfilDetalhado = empresaData;
                let role = 'dono';

                if (!isOwner) {
                    console.log("🔍 [verificarAcesso] Verificando perfil de profissional");
                    try {
                        const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                        if (!profSnap.exists()) {
                            console.log("❌ [verificarAcesso] Profissional não encontrado");
                            try {
                                localStorage.removeItem('empresaAtivaId');
                            } catch (error) {
                                console.error("❌ [verificarAcesso] Erro ao remover do localStorage:", error);
                            }
                            window.location.replace('login.html');
                            isProcessing = false;
                            return reject(new Error("Acesso de profissional não encontrado."));
                        }

                        const profData = profSnap.data();
                        if (!profData || profData.status !== 'ativo') {
                            console.log("❌ [verificarAcesso] Profissional inativo ou dados inválidos");
                            try {
                                localStorage.removeItem('empresaAtivaId');
                            } catch (error) {
                                console.error("❌ [verificarAcesso] Erro ao remover do localStorage:", error);
                            }
                            window.location.replace('login.html');
                            isProcessing = false;
                            return reject(new Error("Acesso de profissional revogado ou pendente."));
                        }

                        perfilDetalhado = profData;
                        role = 'funcionario';
                    } catch (error) {
                        console.error("❌ [verificarAcesso] Erro ao verificar profissional:", error);
                        isProcessing = false;
                        return reject(new Error("Erro ao verificar acesso de profissional."));
                    }
                }

                // MODIFICAÇÃO: A flag 'isAdmin' é adicionada ao perfil final.
                cachedSessionProfile = { 
                    user, 
                    empresaId: empresaAtivaId, 
                    perfil: perfilDetalhado, 
                    isOwner, 
                    isAdmin: isAdmin, 
                    role 
                };

                console.log("✅ [verificarAcesso] Verificação concluída com sucesso");
                isProcessing = false;
                return resolve(cachedSessionProfile);

            } catch (error) {
                console.error("❌ [verificarAcesso] Erro final:", error);
                isProcessing = false;
                
                if (error.message.includes("autenticado") || 
                    error.message.includes("revogado") || 
                    error.message.includes("expirada") || 
                    error.message.includes("seleção") ||
                    error.message.includes("associada")) {
                    return reject(error);
                }
                
                window.location.replace('login.html');
                return reject(new Error("Erro inesperado no acesso."));
            }
        }, (error) => {
            console.error("❌ [verificarAcesso] Erro no onAuthStateChanged:", error);
            isProcessing = false;
            reject(new Error("Erro de autenticação."));
        });
    });
}

// Função para limpar cache (útil para debug)
export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
    console.log("🗑️ [clearCache] Cache limpo");
}
