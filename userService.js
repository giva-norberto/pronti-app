// ======================================================================
//                      USERSERVICE.JS - VERSÃO BÁSICA DE TESTE
// ======================================================================

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js'; // Verifique se o nome do arquivo está correto

/**
 * ensureUserAndTrialDoc - Esta função não é necessária para o teste básico.
 * A lógica será incorporada diretamente na função principal.
 */

/**
 * verificarAcesso - VERSÃO SIMPLIFICADA
 * A única responsabilidade é verificar se o usuário existe no banco de dados.
 * Se não existir, assume "primeiro_acesso".
 */
export async function verificarAcesso( ) {
    console.log("Iniciando userService.js (versão BÁSICA)...");

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Executa apenas uma vez para evitar loops

            if (!user) {
                // Se não há usuário, o onAuthStateChanged no index.html já redireciona.
                // Rejeitar aqui é uma segurança extra.
                console.log("userService: Usuário não autenticado.");
                return reject(new Error("Não autenticado."));
            }

            console.log("userService: Usuário autenticado:", user.uid);
            console.log("userService: Tentando ler o documento do usuário no Firestore...");

            try {
                // Tenta ler APENAS o documento do próprio usuário.
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    // Se o documento do usuário existe, consideramos um sucesso por enquanto.
                    // Retornamos um perfil básico para o index.html poder carregar.
                    console.log("userService: Documento do usuário encontrado. Resolvendo como 'dono' para teste.");
                    resolve({
                        user: user,
                        perfil: userSnap.data(),
                        role: "dono" // Simula o papel de "dono" para a página carregar
                    });
                } else {
                    // Se o documento do usuário NÃO existe, é o primeiro acesso.
                    console.log("userService: Documento do usuário NÃO encontrado. Rejeitando como 'primeiro_acesso'.");
                    reject(new Error("primeiro_acesso"));
                }

            } catch (error) {
                // Se qualquer erro ocorrer durante a leitura do Firestore...
                console.error("userService: ERRO CRÍTICO ao tentar ler o Firestore!", error);
                reject(error); // Rejeita a promessa com o erro original.
            }
        });
    });
}
