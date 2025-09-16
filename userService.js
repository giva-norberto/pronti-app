// ======================================================================
//        USER-SERVICE.JS (VERSÃO FINAL COM LÓGICA DE ACESSO REVISADA)
// ======================================================================

// Suas importações estão corretas e foram mantidas.
import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// Variáveis de controle de sessão (sua lógica original mantida ).
let cachedSessionProfile = null;
let isProcessing = false;

// ======================================================================
// SUAS FUNÇÕES ORIGINAIS (PRESERVADAS 100%)
// Não há necessidade de alterar estas funções, elas já fazem o trabalho certo.
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
        } else if (!userSnap.data().trialStart) {
            await updateDoc(userRef, {
                trialStart: serverTimestamp(),
            });
        }
    } catch (error) {
        console.error("❌ Erro em ensureUserAndTrialDoc:", error);
    }
}

async function checkUserStatus(user, empresaData) {
    // ... (Seu código original aqui, sem alterações)
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
        console.error("❌ Erro em checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: true };
    }
}

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
    } catch (e) { console.error("❌ Erro ao buscar empresas (dono):", e); }
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && mapaSnap.data().empresas && mapaSnap.data().empresas.length > 0) {
            const idsDeEmpresas = mapaSnap.data().empresas;
            if (idsDeEmpresas.length === 0) return Array.from(empresasEncontradas.values());
            const empresasRef = collection(db, "empresarios");
            const q = query(empresasRef, where(documentId(), "in", idsDeEmpresas));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                if (!empresasEncontradas.has(doc.id)) {
                    empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
        }
    } catch(e) { console.error("❌ Erro ao buscar empresas (mapa):", e); }
    return Array.from(empresasEncontradas.values());
}

// ======================================================================
// ✅ FUNÇÃO PRINCIPAL 'verificarAcesso' (REVISADA E ORGANIZADA)
// Esta função agora segue uma ordem lógica rigorosa para evitar conflitos.
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) return cachedSessionProfile;
    if (isProcessing) return Promise.reject(new Error("Processamento de acesso já em andamento."));
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Executa apenas uma vez para evitar loops
            
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];

                // ORDEM LÓGICA CORRETA:
                
                // 1. O usuário está logado? Se não, mande para o login.
                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) {
                        window.location.replace('login.html');
                    }
                    return reject(new Error("Usuário não autenticado. Redirecionando..."));
                }

                // A partir daqui, TEMOS um usuário logado.
                await ensureUserAndTrialDoc(user);
                
                // 2. Quantas empresas este usuário possui?
                const empresas = await getEmpresasDoUsuario(user);

                // 3. Se ele não tem NENHUMA empresa, o lugar dele é na tela de seleção.
                if (empresas.length === 0) {
                    if (currentPage !== 'selecionar-empresa.html') {
                        window.location.replace('selecionar-empresa.html');
                    }
                    // Para o script aqui para deixar a tela de seleção carregar.
                    return reject(new Error("Novo usuário. Exibindo tela de boas-vindas."));
                }

                // 4. Se ele tem MAIS DE UMA empresa, ele também precisa ir para a tela de seleção.
                if (empresas.length > 1) {
                    if (currentPage !== 'selecionar-empresa.html') {
                        window.location.replace('selecionar-empresa.html');
                    }
                    return reject(new Error("Múltiplas empresas. Seleção necessária."));
                }

                // 5. Se chegamos aqui, ele tem EXATAMENTE UMA empresa.
                const empresaAtivaId = empresas[0].id;
                localStorage.setItem('empresaAtivaId', empresaAtivaId);
                
                // Se por acaso ele estava na tela de seleção, agora mandamos para o início.
                if (currentPage === 'selecionar-empresa.html') {
                    window.location.replace('index.html');
                    return reject(new Error("Usuário com uma empresa. Redirecionando..."));
                }

                const empresaDocRef = doc(db, "empresarios", empresaAtivaId);
                const empresaDocSnap = await getDoc(empresaDocRef);

                if (!empresaDocSnap.exists()) {
                    localStorage.removeItem('empresaAtivaId');
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Empresa ativa não encontrada."));
                }
                
                const empresaData = empresaDocSnap.data();
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaData);

                // 6. Verificação de assinatura (sua lógica mantida).
                if (!hasActivePlan && !isTrialActive) {
                    if (currentPage !== 'assinatura.html') {
                        window.location.replace('assinatura.html');
                    }
                    return reject(new Error("Assinatura expirada."));
                }

                // 7. Finalmente, monta o perfil da sessão e libera o acesso.
                const isAdmin = user.uid === "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isOwner = empresaData.donoId === user.uid;
                let perfilDetalhado = empresaData;
                let papel = 'dono';

                if (!isOwner && !isAdmin) {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado."));
                    }
                    perfilDetalhado = profSnap.data();
                    papel = 'funcionario';
                }
                
                cachedSessionProfile = { 
                    user, 
                    empresaId: empresaAtivaId, 
                    perfil: perfilDetalhado, 
                    isOwner: isOwner || isAdmin,
                    isAdmin: isAdmin, 
                    papel
                };
                resolve(cachedSessionProfile);

            } catch (error) {
                // Não redireciona se o erro for um dos esperados (ex: "Novo usuário")
                if (!error.message.includes("Redirecionando") && !error.message.includes("boas-vindas") && !error.message.includes("Seleção necessária")) {
                    console.error("❌ Erro final em verificarAcesso:", error);
                }
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
