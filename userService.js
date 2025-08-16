// userTrial.ts (ou userService.js)

// Imports corrigidos com as URLs completas do Firebase
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc,
    DocumentSnapshot,
    DocumentData 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, User } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Lembre-se de verificar se o nome do seu arquivo de config é este
import { db, auth } from './vitrini-firebase.js';

// Define um tipo para a resposta, para clareza
type UserStatus = {
    hasActivePlan: boolean;
    isTrialActive: boolean;
};

/**
 * Função auxiliar para encontrar o documento da empresa associado ao usuário logado.
 * @returns {Promise<DocumentSnapshot<DocumentData> | null>}
 */
async function getEmpresaDoc(): Promise<DocumentSnapshot<DocumentData> | null> {
    const user: User | null = auth.currentUser;
    if (!user) return null;

    try {
        const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("Nenhum documento de empresa encontrado para o donoId:", user.uid);
            return null;
        }
        return querySnapshot.docs[0];

    } catch (error) {
        console.error("ERRO ao buscar documento da empresa:", error);
        return null;
    }
}

/**
 * REVISADO: Ativa o período de teste para o usuário.
 * Agora ele lê os dias customizáveis e salva a DATA FINAL do trial.
 * @returns {Promise<void>}
 */
export async function ensureTrialStart(): Promise<void> {
    const user: User | null = auth.currentUser;
    if (!user) {
        console.error("Tentativa de iniciar trial sem usuário logado.");
        return;
    }

    const empresaDoc = await getEmpresaDoc();
    if (!empresaDoc) {
        console.error("Não foi possível iniciar o trial: empresa não encontrada.");
        return;
    }

    const empresaData = empresaDoc.data();
    
    // Só executa se o trial ainda não foi iniciado
    if (empresaData && !empresaData.trialEndsAt) {
        // 1. Pega os dias de trial do documento (ou usa 15 como padrão)
        const trialDurationDays: number = empresaData.trialDays || 15;
        
        // 2. Calcula a data final do trial
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDurationDays);

        // 3. Salva a DATA FINAL no Firestore
        await updateDoc(empresaDoc.ref, {
            trialEndsAt: endDate.toISOString() // Novo campo! Mais eficiente.
        });
        console.log(`Trial ativado. Termina em: ${endDate.toLocaleDateString()}`);
    }
}

/**
 * REVISADO: Verifica o status do usuário.
 * Agora a verificação é muito mais simples e rápida.
 * @returns {Promise<UserStatus>}
 */
export async function checkUserStatus(): Promise<UserStatus> {
    const safeReturn: UserStatus = { hasActivePlan: false, isTrialActive: false };

    try {
        const user: User | null = auth.currentUser;
        if (!user) return safeReturn;

        const empresaDoc = await getEmpresaDoc();
        if (!empresaDoc) return safeReturn;

        const empresaData = empresaDoc.data();
        if (!empresaData) return safeReturn;

        const hasActivePlan = empresaData.isPremium === true;
        let isTrialActive = false;
      
        // LÓGICA REVISADA E MAIS SIMPLES
        if (empresaData.trialEndsAt) {
            const endDate = new Date(empresaData.trialEndsAt);
            // Verifica simplesmente se a data de término ainda não chegou
            if (endDate > new Date()) {
                isTrialActive = true;
            }
        }

        return { hasActivePlan, isTrialActive };

    } catch (error) {
        console.error("ERRO no checkUserStatus:", error);
        return safeReturn;
    }
}
