// userService.js

// Imports do Firebase (já corrigidos)
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Verifique o nome do seu arquivo de configuração
import { db, auth } from './vitrini-firebase.js';

/**
 * Função auxiliar para encontrar o documento da empresa associado ao usuário logado.
 */
async function getEmpresaDoc() {
    const user = auth.currentUser;
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
 * Ativa o período de teste para o usuário.
 */
export async function ensureTrialStart() {
    const user = auth.currentUser;
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
    
    if (empresaData && !empresaData.trialEndsAt) {
        const trialDurationDays = empresaData.trialDays || 15;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDurationDays);

        await updateDoc(empresaDoc.ref, {
            trialEndsAt: endDate.toISOString()
        });
        console.log(`Trial ativado. Termina em: ${endDate.toLocaleDateString()}`);
    }
}

/**
 * Verifica o status de assinatura e trial do usuário logado.
 */
export async function checkUserStatus() {
    const safeReturn = { hasActivePlan: false, isTrialActive: false };

    try {
        const user = auth.currentUser;
        if (!user) return safeReturn;

        const empresaDoc = await getEmpresaDoc();
        if (!empresaDoc) return safeReturn;

        const empresaData = empresaDoc.data();
        if (!empresaData) return safeReturn;

        const hasActivePlan = empresaData.isPremium === true;
        let isTrialActive = false;
      
        if (empresaData.trialEndsAt) {
            const endDate = new Date(empresaData.trialEndsAt);
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
