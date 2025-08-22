// ======================================================================
//          VITRINI-AUTH.JS - MÓDULO DE AUTENTICAÇÃO
//      Responsabilidade: Gerir o login, logout e o estado do
//                      utilizador na vitrine.
// ======================================================================

import { auth, provider, db } from './vitrini-firebase.js';

import { 
    onAuthStateChanged, 
    signInWithRedirect, // <-- ALTERADO para ser compatível com telemóveis
    getRedirectResult,  // <-- NOVO para processar o login após o redirecionamento
    signOut,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { showAlert } from './vitrini-utils.js';

/**
 * Configura o listener que observa mudanças no estado de autenticação (login/logout).
 * @param {Function} callback - A função a ser executada quando o estado de auth mudar.
 */
export function setupAuthListener(callback) {
    if (typeof onAuthStateChanged !== "function") {
        console.error("Firebase Auth não carregado corretamente.");
        return;
    }
    
    // Este listener continua a ser o principal para atualizar a UI
    onAuthStateChanged(auth, (user) => {
        if (typeof callback === 'function') {
            callback(user);
        }
    });

    // ======================================================================
    //   NOVO: LÓGICA PARA PROCESSAR O LOGIN APÓS O REDIRECIONAMENTO
    // ======================================================================
    // Isto é executado quando a página recarrega após o utilizador voltar do Google.
    getRedirectResult(auth).then(async (result) => {
        if (result && result.user) {
            // Se o login foi bem-sucedido, executamos a sua lógica de verificação de dados aqui.
            await garantirDadosCompletos(result.user);
        }
    }).catch(error => {
        console.error("Erro ao obter resultado do redirecionamento:", error);
    });
}

/**
 * Inicia o processo de login com o Google usando o método de redirecionamento.
 */
export async function fazerLogin() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        // Apenas inicia o redirecionamento. O resto da lógica acontece no 'getRedirectResult'.
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error("Erro ao iniciar o login com redirecionamento:", error);
        await showAlert("Erro no Login", "Não foi possível iniciar o processo de login.");
    }
}

/**
 * Função extraída da sua lógica original para verificar e completar os dados do utilizador.
 * @param {object} user - O objeto do utilizador do Firebase Auth.
 */
async function garantirDadosCompletos(user) {
    try {
        let telefoneFaltando = !user.phoneNumber;
        let nomeFaltando = !user.displayName;
        let telefone = '';
        let nome = '';

        const empresaId = getEmpresaIdFromUrl();
        const clienteDocRef = doc(db, `empresarios/${empresaId}/clientes/${user.uid}`);
        const clienteDocSnap = await getDoc(clienteDocRef);
        if (clienteDocSnap.exists()) {
            const dados = clienteDocSnap.data();
            if (dados.telefone) telefoneFaltando = false;
            if (dados.nome) nomeFaltando = false;
        }

        if (telefoneFaltando || nomeFaltando) {
            if (nomeFaltando) {
                nome = prompt("Informe o seu nome completo:");
                if (!nome) {
                    await showAlert("Nome obrigatório", "O seu nome é necessário para concluir o cadastro.");
                    await signOut(auth);
                    return;
                }
            } else {
                nome = user.displayName || (clienteDocSnap.exists() ? clienteDocSnap.data().nome : "");
            }

            if (telefoneFaltando) {
                while (true) {
                    telefone = prompt("Informe o seu telefone (WhatsApp):");
                    if (telefone === null) {
                        await showAlert("Telefone obrigatório", "Você precisa de informar um telefone para continuar.");
                        await signOut(auth);
                        return;
                    }
                    if (telefone && telefone.trim()) {
                        telefone = telefone.trim();
                        if (/^\d{9,15}$/.test(telefone.replace(/\D/g, ""))) {
                            break;
                        } else {
                            await showAlert("Telefone inválido", "Digite apenas números. Exemplo: 11999998888");
                        }
                    } else {
                        await showAlert("Telefone obrigatório", "Você precisa de informar um telefone para continuar.");
                    }
                }
            } else {
                telefone = user.phoneNumber || (clienteDocSnap.exists() ? clienteDocSnap.data().telefone : "");
            }

            await setDoc(clienteDocRef, {
                nome: nome,
                email: user.email,
                telefone: telefone,
                google: true,
                atualizadoEm: serverTimestamp()
            }, { merge: true });

            if (nomeFaltando) {
                await updateProfile(user, { displayName: nome });
            }
        } else {
            await setDoc(clienteDocRef, {
                nome: user.displayName,
                email: user.email,
                telefone: user.phoneNumber || (clienteDocSnap.exists() ? clienteDocSnap.data().telefone : ""),
                google: true,
                atualizadoEm: serverTimestamp()
            }, { merge: true });
        }
    } catch (error) {
        console.error("Erro ao garantir dados completos do utilizador:", error);
    }
}


/**
 * Realiza login com email e senha. (FUNÇÃO ORIGINAL MANTIDA)
 */
export async function loginComEmailSenha(email, senha) {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithEmailAndPassword(auth, email, senha);
        return result.user;
    } catch (error) {
        console.error("Erro no login por email/senha:", error);
        await showAlert("Erro no Login", "Email ou senha inválidos, ou erro ao aceder à sua conta.");
        throw error;
    }
}

/**
 * Realiza cadastro com email, senha, nome e telefone. (FUNÇÃO ORIGINAL MANTIDA)
 */
export async function cadastrarComEmailSenha(nome, email, senha, telefone) {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(result.user, { displayName: nome });

        const empresaId = getEmpresaIdFromUrl();
        const clienteDocRef = doc(db, `empresarios/${empresaId}/clientes/${result.user.uid}`);
        await setDoc(clienteDocRef, {
            nome,
            email,
            telefone,
            google: false,
            criadoEm: serverTimestamp()
        }, { merge: true });

        return result.user;
    } catch (error) {
        console.error("Erro no cadastro:", error);
        let mensagem = "Não foi possível concluir o cadastro.";
        if (error.code === "auth/email-already-in-use") mensagem = "Este email já está cadastrado.";
        await showAlert("Erro no Cadastro", mensagem);
        throw error;
    }
}

/**
 * Inicia o processo de logout do usuário. (FUNÇÃO ORIGINAL MANTIDA)
 */
export async function fazerLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro no logout:", error);
        await showAlert("Erro", "Ocorreu um erro ao tentar sair da conta.");
    }
}

/**
 * Utilitário: busca empresaId da URL (?empresa=xxxx) (FUNÇÃO ORIGINAL MANTIDA)
 */
function getEmpresaIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa') || "padrao";
}
