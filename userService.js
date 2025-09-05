// ======================================================================
//             USER-SERVICE.JS (VERSÃO FINAL E RESILIENTE)
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

// --- Funções Auxiliares ---
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
            isPremium: false,
        });
    } else if (!userSnap.data().trialStart) {
        await updateDoc(userRef, {
            trialStart: serverTimestamp(),
        });
    }
}

async function checkUserStatus(user, empresaData) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true };
    const userData = userSnap.data();
    if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };
    if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true };
    let trialDurationDays = 15;
    if (empresaData && empresaData.freeEmDias !== undefined) {
        trialDurationDays = empresaData.freeEmDias;
    }
    const startDate = new Date(userData.trialStart.seconds * 1000);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + trialDurationDays);
    return { hasActivePlan: false, isTrialActive: endDate > new Date() };
}

// --- FUNÇÃO EXPORTADA (CORRIGIDA COM COMPATIBILIDADE) ---

/**
 * Busca todas as empresas associadas a um utilizador a partir do mapaUsuarios.
 * É compatível com o formato antigo (empresaId: string) e o novo (empresas: array).
 * @param {User} user O objeto do utilizador autenticado.
 * @returns {Promise<Array>} Uma lista de objetos de empresa aos quais o utilizador tem acesso.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];

    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);

        if (!mapaSnap.exists()) {
            console.warn("Documento não encontrado em mapaUsuarios para este utilizador.");
            return [];
        }

        const mapaData = mapaSnap.data();
        let empresaIds = [];

        // LÓGICA DE COMPATIBILIDADE PARA CORRIGIR O ERRO
        if (mapaData.empresas && Array.isArray(mapaData.empresas)) {
            // Se encontrar o novo formato (array), usa-o.
            console.log("Formato 'empresas' (array) encontrado no mapaUsuarios.");
            empresaIds = mapaData.empresas;
        } else if (mapaData.empresaId && typeof mapaData.empresaId === 'string') {
            // Se encontrar o formato antigo (string), trata-o como uma lista de uma empresa.
            console.warn("Formato antigo 'empresaId' (string) encontrado. A processar com compatibilidade.");
            empresaIds = [mapaData.empresaId];
        } else {
            // Se não encontrar nenhum dos formatos esperados.
            console.warn("Nenhum campo 'empresas' (array) ou 'empresaId' (string) encontrado no mapaUsuarios.");
            return [];
        }

        if (empresaIds.length === 0) {
            return [];
        }

        const promessasEmpresas = empresaIds.map(empresaId => getDoc(doc(db, "empresarios", empresaId)));
        const docsEmpresas = await Promise.all(promessasEmpresas);

        const empresasValidas = [];
        for (const empresaDoc of docsEmpresas) {
            if (empresaDoc.exists()) {
                empresasValidas.push({ id: empresaDoc.id, ...empresaDoc.data() });
            }
        }
        return empresasValidas;

    } catch (error) {
        console.error("Erro ao buscar empresas do utilizador:", error);
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

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            const currentPage = window.location.pathname.split('/').pop();
            const paginasPublicas = ['login.html', 'cadastro.html'];
            const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

            if (!user) {
                if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                return reject(new Error("Utilizador não autenticado."));
            }

            try {
                await ensureUserAndTrialDoc();

                // MODIFICAÇÃO: A verificação de admin agora é apenas uma flag, não interrompe o fluxo.
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;

                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let acessoVerificado = false;
                let empresaDocSnap;

                if (empresaAtivaId) {
                     const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                     if (empresaDoc.exists()) {
                        empresaDocSnap = empresaDoc;
                        acessoVerificado = true;
                     } else {
                        localStorage.removeItem('empresaAtivaId');
                     }
                }

                if (!acessoVerificado) {
                    const empresas = await getEmpresasDoUsuario(user);
                    if (empresas.length === 0) {
                        if (!paginasDeConfiguracao.includes(currentPage)) window.location.replace('perfil.html'); // Novo utilizador, sem empresas
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
                
                const empresaData = empresaDocSnap.data();
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);

                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }
                
                const isOwner = empresaData.donoId === user.uid;
                let perfilDetalhado = empresaData;
                let role = 'dono';

                if(!isOwner) {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if(!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = profSnap.data();
                    role = 'funcionario';
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
                return resolve(cachedSessionProfile);

            } catch (error) {
                console.error("[AuthGuard] Erro final:", error);
                if (error.message.includes("autenticado") || error.message.includes("revogado") || error.message.includes("expirada") || error.message.includes("seleção")) {
                    return reject(error);
                }
                window.location.replace('login.html');
                return reject(new Error("Erro inesperado no acesso."));
            }
        });
    });
}
