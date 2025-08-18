// ======================================================================
//                       USERSERVICE.JS
//      Arquivo central para toda a lógica de usuário:
//      - Verificação de acesso (Porteiro)
//      - Gerenciamento de Trial
//      - Verificação de Status (Premium/Trial)
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
    serverTimestamp // Importa o timestamp do servidor
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Verifique o nome do seu arquivo de configuração
import { db, auth } from './firebase-config.js'; // Ajuste o caminho se necessário

// --- Funções Auxiliares (internas do módulo) ---

/**
 * Função auxiliar para encontrar o documento da empresa associado a um dono.
 */
async function getEmpresaDocPorDono(uid) {
    if (!uid) return null;
    try {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log("Nenhum documento de empresa encontrado para o donoId:", uid);
            return null;
        }
        return querySnapshot.docs[0];
    } catch (error) {
        console.error("ERRO ao buscar documento da empresa:", error);
        return null;
    }
}

// --- Funções Exportadas (para serem usadas em outras partes do app) ---

/**
 * Garante que um documento para o usuário exista na coleção 'usuarios' e que
 * seu período de trial tenha sido iniciado. Usa a data do servidor para segurança.
 */
export async function ensureUserAndTrialDoc() {
    const user = auth.currentUser;
    if (!user) return; // Se não houver usuário, não faz nada

    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        // Primeiro acesso do usuário: cria o documento dele já com o trialStart
        await setDoc(userRef, {
            nome: user.displayName || user.email,
            email: user.email,
            trialStart: serverTimestamp(), // USA A DATA DO SERVIDOR (MAIS SEGURO)
            isPremium: false
        });
        console.log("Documento de usuário e trial criados.");
    } else if (!userSnap.data().trialStart) {
        // Usuário já existia, mas não tinha o trial: adiciona o campo
        await updateDoc(userRef, {
            trialStart: serverTimestamp() // USA A DATA DO SERVIDOR (MAIS SEGURO)
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
            const trialDurationDays = 15; // Defina a duração do seu trial aqui
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);
            
            trialEndDate = endDate; // Armazena a data final

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
                // Não está logado -> vai para o login
                window.location.href = 'login.html';
                return reject(new Error("Usuário não autenticado."));
            }

            try {
                // Checa se é o DONO
                const empresaDoc = await getEmpresaDocPorDono(user.uid);
                if (empresaDoc) {
                    // É O DONO! Acesso permitido.
                    return resolve({ user, empresaId: empresaDoc.id, perfil: empresaDoc.data(), isOwner: true });
                }

                // Se não é o dono, checa se é um FUNCIONÁRIO
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);

                if (!mapaSnap.exists()) {
                    // Não é dono e não está no mapa -> vai para a tela de criar empresa (onboarding)
                    window.location.href = 'perfil.html'; // Ou 'criar-empresa.html'
                    return reject(new Error("Usuário novo, precisa criar empresa."));
                }
                
                const empresaId = mapaSnap.data().empresaId;
                const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                const profissionalSnap = await getDoc(profissionalRef);

                if (!profissionalSnap.exists() || profissionalSnap.data().status !== 'ativo') {
                    // O perfil não existe ou o status não é 'ativo' -> vai para a sala de espera
                    window.location.href = 'aguardando.html';
                    return reject(new Error("Acesso pendente de aprovação."));
                }

                // Tudo certo! É um funcionário ATIVO. Acesso permitido.
                return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false });

            } catch (error) {
                console.error("Erro ao verificar acesso:", error);
                window.location.href = 'login.html'; // Segurança
                return reject(error);
            }
        });
    });
}
