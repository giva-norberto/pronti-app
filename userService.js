// ======================================================================
//              USERSERVICE.JS - VERSÃO ESTÁVEL DE VERIFICAÇÃO
// ======================================================================
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

export async function verificarAcesso( ) {
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
