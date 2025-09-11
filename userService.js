// ======================================================================
//      USER-SERVICE.JS (VERSÃO ANTIGA REVISADA E CORRIGIDA)
// ======================================================================

// ✅ CORREÇÃO 1: Adicionado 'documentId' para a consulta que respeita as regras.
import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// "Memória" para evitar re-verificação desnecessária
let cachedSessionProfile = null;
let isProcessing = false; // Previne múltiplas execuções simultâneas

// --- Função: Garante doc do usuário e trial ---
export async function ensureUserAndTrialDoc( ) {
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
 * ⭐ FUNÇÃO ROBUSTA PARA BUSCAR EMPRESAS DO USUÁRIO (COM CORREÇÃO) ⭐
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();

    // 1. Busca direta por empresas onde o usuário é o dono (método seguro)
    try {
        const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            if (!empresasEncontradas.has(doc.id)) {
                empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas como dono:", e);
    }

    // ✅ CORREÇÃO 2: A busca pelo mapa agora usa uma consulta 'in' (operação de LISTA).
    // Isso respeita suas regras de segurança e evita o erro de permissão.
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
    } catch(e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas pelo mapa:", e);
    }
    
    return Array.from(empresasEncontradas.values());
}

// ======================================================================
// FUNÇÃO GUARDA PRINCIPAL (COM LÓGICA DE REDIRECIONAMENTO CORRIGIDA)
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
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'nova-empresa.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    isProcessing = false;
                    return reject(new Error("Utilizador não autenticado."));
                }

                await ensureUserAndTrialDoc();
                
                // ✅ CORREÇÃO 3: A lógica de verificação de empresas foi movida para o início
                // para garantir que a seleção seja forçada ANTES de tentar usar o localStorage.
                
                // 1. PRIMEIRO, busca as empresas.
                const empresas = await getEmpresasDoUsuario(user);

                // 2. Se tiver mais de uma, FORÇA a seleção.
                if (empresas.length > 1 && currentPage !== 'selecionar-empresa.html') {
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Múltiplas empresas, seleção necessária."));
                }

                // 3. Se tiver zero, vai para a criação.
                if (empresas.length === 0) {
                    if (currentPage !== 'nova-empresa.html') window.location.replace('nova-empresa.html');
                    return reject(new Error("Nenhuma empresa associada."));
                }

                // 4. Se chegou aqui, tem exatamente UMA empresa. Define-a como ativa.
                const empresaAtivaId = empresas[0].id;
                localStorage.setItem('empresaAtivaId', empresaAtivaId);
                
                // O resto da sua lógica original continua a partir daqui, agora com a certeza
                // de que a empresa ativa está correta.
                const empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));

                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                if (!empresaData) {
                    return reject(new Error("Dados da empresa inválidos."));
                }

                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);
                if (!hasActivePlan && !isTrialActive) {
                    if (currentPage !== 'assinatura.html') window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;
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
                
                cachedSessionProfile = { 
                    user, 
                    empresaId: empresaAtivaId, 
                    perfil: perfilDetalhado, 
                    isOwner: isOwner || isAdmin,
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

// Suas outras funções exportadas permanecem intactas
export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
}

export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
