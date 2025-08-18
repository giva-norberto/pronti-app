// ======================================================================
//                       USERSERVICE.JS
//      Versão com mais LOGS para diagnosticar o problema de permissão
// ======================================================================

// Imports do Firebase
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Verifique o nome do seu arquivo de configuração
import { db, auth } from './firebase-config.js'; // Ajuste o caminho se necessário

// --- Funções Auxiliares (internas do módulo) ---

/**
 * Função auxiliar para encontrar o documento da empresa associado a um dono.
 */
async function getEmpresaDocPorDono(uid) {
    if (!uid) {
        console.log("Debug (getEmpresaDocPorDono): Função chamada sem UID.");
        return null;
    }
    console.log(`Debug (getEmpresaDocPorDono): Procurando empresa com donoId = ${uid}`);
    try {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log("Debug (getEmpresaDocPorDono): A busca por empresa do dono não encontrou resultados.");
            return null;
        }
        console.log("Debug (getEmpresaDocPorDono): Empresa do dono encontrada!");
        return querySnapshot.docs[0];
    } catch (error) {
        console.error("Debug (getEmpresaDocPorDono): ERRO na busca por empresa do dono:", error);
        // Lança o erro para que a função que chamou (verificarAcesso) saiba que falhou.
        throw error;
    }
}

// --- Funções Exportadas (para serem usadas em outras partes do app) ---

/**
 * Garante que um documento para o usuário exista na coleção 'usuarios' e que
 * seu período de trial tenha sido iniciado. Usa a data do servidor para segurança.
 */
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
            isPremium: false
        });
        console.log("Documento de usuário e trial criados.");
    } else if (!userSnap.data().trialStart) {
        await updateDoc(userRef, {
            trialStart: serverTimestamp()
        });
        console.log("Campo trialStart adicionado ao usuário existente.");
    }
}


/**
 * Verifica o status de assinatura e trial do usuário logado.
 * Retorna um objeto com { hasActivePlan, isTrialActive, trialEndDate }
 */
export async function checkUserStatus() {
    const safeReturn = { hasActivePlan: false, isTrialActive: false, trialEndDate: null };
    const user = auth.currentUser;
    if (!user) return safeReturn;

    try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return safeReturn;

        const userData = userSnap.data();
        const hasActivePlan = userData.isPremium === true;
        let isTrialActive = false;
        let trialEndDate = null;

        if (userData.trialStart && userData.trialStart.seconds) {
            const trialDurationDays = 15;
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);
            
            trialEndDate = endDate;

            if (endDate > new Date()) {
                isTrialActive = true;
            }
        }
        return { hasActivePlan, isTrialActive, trialEndDate };

    } catch (error) {
        console.error("ERRO no checkUserStatus:", error);
        return safeReturn;
    }
}

/**
 * Função "Porteiro": A função mais importante. Verifica o acesso a páginas protegidas.
 * Redireciona usuários não autorizados.
 * Se o acesso for permitido, retorna os dados do usuário/empresa.
 */
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Executa o listener apenas uma vez

            if (!user) {
                window.location.href = 'login.html';
                return reject(new Error("Usuário não autenticado."));
            }

            console.log(`Debug (verificarAcesso): Iniciado para o usuário UID: ${user.uid}`);

            try {
                // Checa se é o DONO
                const empresaDoc = await getEmpresaDocPorDono(user.uid);
                if (empresaDoc) {
                    console.log("Debug (verificarAcesso): Usuário identificado como DONO. Acesso permitido.");
                    return resolve({ user, empresaId: empresaDoc.id, perfil: empresaDoc.data(), isOwner: true });
                }

                // Se não é o dono, checa se é um FUNCIONÁRIO
                console.log("Debug (verificarAcesso): Usuário não é dono. Verificando mapaUsuarios...");
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                if (!mapaSnap.exists()) {
                    console.log("Debug (verificarAcesso): Usuário não encontrado no mapaUsuarios. Redirecionando para perfil/onboarding.");
                    window.location.href = 'perfil.html'; // Ou 'criar-empresa.html'
                    return reject(new Error("Usuário novo, precisa criar empresa."));
                }
                
                const empresaId = mapaSnap.data().empresaId;
                console.log(`Debug (verificarAcesso): Usuário mapeado para empresaId: ${empresaId}. Verificando status...`);
                const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                const profissionalSnap = await getDoc(profissionalRef);

                if (!profissionalSnap.exists() || profissionalSnap.data().status !== 'ativo') {
                    console.log("Debug (verificarAcesso): Funcionário pendente ou não encontrado. Redirecionando para aguardando.");
                    window.location.href = 'aguardando.html';
                    return reject(new Error("Acesso pendente de aprovação."));
                }

                console.log("Debug (verificarAcesso): Usuário identificado como FUNCIONÁRIO ATIVO. Acesso permitido.");
                return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false });

            } catch (error) {
                console.error("Debug (verificarAcesso): Erro final no bloco try/catch:", error);
                // Não redireciona aqui para podermos ver o erro no console sem causar um loop
                return reject(error);
            }
        });
    });
}
