// ======================================================================
//              USERSERVICE.JS - VERSÃO ESTÁVEL DE VERIFICAÇÃO
// ======================================================================
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

/**
 * Garante que o documento do usuário e o trial (avaliação) existem no Firestore.
 * Cria documentos básicos caso não existam.
 */
export async function ensureUserAndTrialDoc() {
    const user = auth.currentUser || getAuth().currentUser;
    if (!user) throw new Error("Não autenticado.");

    // Documento de usuário empresário
    const userRef = doc(db, "empresarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            nome: user.displayName || "",
            email: user.email || "",
            criadoEm: new Date(),
            // outros campos padrão, se necessário
        });
    }

    // Documento de trial (período de avaliação) - ajuste se sua estrutura usar outro nome/coleção
    const trialRef = doc(db, "trials", user.uid);
    const trialSnap = await getDoc(trialRef);
    if (!trialSnap.exists()) {
        await setDoc(trialRef, {
            inicio: new Date(),
            // outros campos padrão, se necessário
        });
    }
}

export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); 
            if (!user) {
                return reject(new Error("Não autenticado."));
            }
            try {
                // Tenta ler o documento da empresa. O ID é o mesmo do usuário.
                const empresaRef = doc(db, "empresarios", user.uid);
                const empresaSnap = await getDoc(empresaRef);
                if (empresaSnap.exists()) {
                    // SUCESSO! O usuário já tem uma empresa cadastrada.
                    resolve({
                        user: user,
                        perfil: empresaSnap.data(),
                        role: "dono" 
                    });
                } else {
                    // Se não encontrou a empresa, é o primeiro acesso.
                    reject(new Error("primeiro_acesso"));
                }
            } catch (error) {
                console.error("Erro crítico no userService:", error);
                reject(error); 
            }
        });
    });
}
