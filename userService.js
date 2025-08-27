// ======================================================================
//              USERSERVICE.JS - VERSÃO FINAL COM PAUSA CORRETIVA
// ======================================================================

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

/**
 * verificarAcesso - VERSÃO FINAL
 * A única responsabilidade é verificar se o usuário existe no banco de dados.
 * Contém a pausa de segurança para garantir que a conexão esteja estável.
 */
export async function verificarAcesso( ) {
    console.log("Iniciando userService.js (VERSÃO FINAL)...");

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); 

            if (!user) {
                console.log("userService: Usuário não autenticado.");
                return reject(new Error("Não autenticado."));
            }

            console.log("userService: Usuário autenticado:", user.uid);

            // ===================================================================
            //                      A CORREÇÃO FINAL ESTÁ AQUI
            // ===================================================================
            // A pausa foi movida para DENTRO do userService, ANTES da leitura.
            setTimeout(async () => {
                console.log("userService: Pausa terminada. Tentando ler o Firestore...");
                try {
                    const userRef = doc(db, "usuarios", user.uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        console.log("userService: Documento encontrado. Sucesso!");
                        resolve({
                            user: user,
                            perfil: userSnap.data(),
                            role: "dono" 
                        });
                    } else {
                        console.log("userService: Documento NÃO encontrado. Primeiro acesso.");
                        reject(new Error("primeiro_acesso"));
                    }

                } catch (error) {
                    console.error("userService: ERRO CRÍTICO ao ler o Firestore!", error);
                    reject(error); 
                }
            }, 500); // Pausa de 500ms para máxima segurança
            // ===================================================================
        });
    });
}
