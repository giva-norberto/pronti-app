// ======================================================================
//      USER-SERVICE.JS (VERSÃO ATUAL CORRIGIDA PARA O LOOP)
// ======================================================================

// Suas importações estão corretas e foram mantidas.
import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// Suas variáveis de cache e controle, preservadas.
let cachedSessionProfile = null;
let isProcessing = false;

// --- Sua função ensureUserAndTrialDoc, 100% preservada ---
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

// --- Sua função checkUserStatus, 100% preservada ---
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

// --- Sua função getEmpresasDoUsuario, 100% preservada (já está correta) ---
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
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas como dono:", e);
    }
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
// FUNÇÃO GUARDA PRINCIPAL (COM A ORDEM DA LÓGICA CORRIGIDA PARA QUEBRAR O LOOP)
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
                // Adicionado 'selecionar-empresa.html' às páginas públicas para evitar que o guarda atue nela.
                const paginasPublicas = ['login.html', 'cadastro.html', 'selecionar-empresa.html'];
                const paginasDeConfig = ['perfil.html', 'assinatura.html', 'nova-empresa.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    return reject(new Error("Utilizador não autenticado."));
                }

                await ensureUserAndTrialDoc();

                // ✅ CORREÇÃO CIRÚRGICA: A ordem da verificação foi ajustada.
                
                // 1. PRIMEIRO, tentamos validar a empresa que já está no localStorage.
                // Isso respeita a escolha feita na tela de seleção.
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;

                if (empresaAtivaId) {
                    const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (empresaDoc.exists()) {
                        empresaDocSnap = empresaDoc; // Empresa válida encontrada! O guarda pode liberar.
                    } else {
                        localStorage.removeItem('empresaAtivaId'); // Limpa ID inválido do localStorage.
                        empresaAtivaId = null;
                    }
                }

                // 2. SÓ SE NÃO houver uma empresa válida no localStorage, o guarda age.
                if (!empresaDocSnap) {
                    const empresas = await getEmpresasDoUsuario(user);

                    if (empresas.length === 0) {
                        if (!paginasDeConfig.includes(currentPage)) window.location.replace('nova-empresa.html');
                        return reject(new Error("Nenhuma empresa associada."));
                    }
                    
                    if (empresas.length > 1) {
                        // Manda para a seleção e pára a execução.
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    }

                    if (empresas.length === 1) {
                        // Caso de usuário com 1 empresa, define e continua.
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    }
                }

                // 3. Verificação final de segurança.
                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    // Se mesmo assim não houver empresa, algo está errado. Volta para a seleção.
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Falha ao determinar empresa ativa."));
                }

                // O resto da sua lógica original continua daqui, 100% preservada.
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
