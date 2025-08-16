// userService.js

// AQUI ESTÁ A CORREÇÃO: Usando a URL completa do Firestore
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "firebase/auth";

// ATENÇÃO: Verifique se o nome do seu arquivo de configuração é 'vitrini-firebase.js'.
import { db, auth } from './vitrini-firebase.js'; 

/**
 * Encontra o documento da empresa associado ao usuário logado.
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
        console.error("ERRO CRÍTICO ao buscar documento da empresa:", error);
        return null;
    }
}

/**
 * Garante que o usuário tenha o trial iniciado.
 */
export async function ensureTrialStart() {
    const user = auth.currentUser;
    if (!user) {
        console.error("Tentativa de iniciar trial sem usuário logado.");
        return;
    }

    const empresaDoc = await getEmpresaDoc();

    if (empresaDoc && !empresaDoc.data().trialStart) {
        await updateDoc(empresaDoc.ref, {
            trialStart: new Date().toISOString()
        });
        console.log("Trial iniciado para a empresa:", empresaDoc.id);
    } else if (!empresaDoc) {
        console.error("Não foi possível iniciar o trial pois não há uma empresa associada a este usuário.");
    }
}

/**
 * Verifica o status de assinatura e trial do usuário logado.
 */
export async function checkUserStatus() {
    try {
        const user = auth.currentUser;
        if (!user) {
            return { hasActivePlan: false, isTrialActive: false };
        }

        const empresaDoc = await getEmpresaDoc();

        if (!empresaDoc) {
            return { hasActivePlan: false, isTrialActive: false };
        }

        const empresaData = empresaDoc.data();
        const hasActivePlan = empresaData.isPremium === true;
        let isTrialActive = false;
      
        if (empresaData.trialStart) {
            const startDate = new Date(empresaData.trialStart);
            const today = new Date(); // Hoje, 15 de agosto de 2025
            const diffTime = today.getTime() - startDate.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            if (diffDays <= 15) {
                isTrialActive = true;
            }
        }

        return { hasActivePlan, isTrialActive };

    } catch (error) {
        console.error("ERRO CRÍTICO no checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: false };
    }
}
