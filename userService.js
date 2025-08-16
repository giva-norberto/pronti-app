// userService.js

import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ATENÇÃO: Confirme se 'vitrini-firebase.js' é o nome correto do seu arquivo de configuração.
// Se for 'firebase-config.js', troque o nome nesta linha.
import { db, auth } from './vitrini-firebase.js'; 

/**
 * Encontra o documento da empresa associado ao usuário logado.
 * Esta é uma função interna para evitar repetição de código.
 * @returns {Promise<DocumentSnapshot|null>}
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
        
        // Retorna o primeiro documento encontrado (deve ser apenas um)
        return querySnapshot.docs[0];

    } catch (error) {
        console.error("ERRO CRÍTICO ao buscar documento da empresa:", error);
        // Isso pode ser um problema com as regras de segurança (permissions) do Firestore!
        return null; // Retorna nulo para não travar o aplicativo
    }
}

/**
 * Garante que o usuário tenha o trial iniciado, atualizando o documento da empresa.
 * Esta função é chamada quando o usuário clica no botão "Ativar Trial".
 */
export async function ensureTrialStart() {
    const user = auth.currentUser;
    if (!user) {
        console.error("Tentativa de iniciar trial sem usuário logado.");
        return;
    }

    const empresaDoc = await getEmpresaDoc();

    // Se o documento da empresa existe, mas não tem o campo trialStart, adiciona o campo.
    if (empresaDoc && !empresaDoc.data().trialStart) {
        await updateDoc(empresaDoc.ref, {
            trialStart: new Date().toISOString()
        });
        console.log("Trial iniciado para a empresa:", empresaDoc.id);
    } else if (!empresaDoc) {
        // Este caso indica um problema no fluxo: o usuário está logado mas não tem uma empresa associada.
        console.error("Não foi possível iniciar o trial pois não há uma empresa associada a este usuário.");
    }
}

/**
 * Verifica o status de assinatura e trial do usuário logado.
 * Esta é a função "segurança" que o dashboard chama.
 * @returns {Promise<{hasActivePlan: boolean, isTrialActive: boolean}>}
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
        
        // Verifica se o usuário tem um plano premium ativo.
        const hasActivePlan = empresaData.isPremium === true;

        let isTrialActive = false;
      
        // Lógica principal: calcula se o trial ainda é válido.
        if (empresaData.trialStart) {
            const startDate = new Date(empresaData.trialStart);
            const today = new Date(); // Hoje, 15 de agosto de 2025
            const diffTime = today.getTime() - startDate.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            // Se a diferença for menor ou igual a 15 dias, o trial está ativo
            if (diffDays <= 15) {
                isTrialActive = true;
            }
        }

        return { hasActivePlan, isTrialActive };

    } catch (error) {
        console.error("ERRO CRÍTICO no checkUserStatus:", error);
        // Em caso de erro, nega o acesso por segurança
        return { hasActivePlan: false, isTrialActive: false };
    }
}
