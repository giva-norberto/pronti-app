// ======================================================================
//          VITRINI-AUTH.JS - MÓDULO DE AUTENTICAÇÃO
//      Responsabilidade: Gerir o login, logout e o estado do
//                      utilizador na vitrine.
// ======================================================================

import { auth, provider, db } from './vitrini-firebase.js';

import { 
    onAuthStateChanged, 
    signInWithRedirect, // <-- CORRETO para compatibilidade com telemóveis
    getRedirectResult,  // <-- CORRETO para processar o login após o redirecionamento
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
    
    // Este listener continua a ser o principal para atualizar a UI em tempo real
    onAuthStateChanged(auth, (user) => {
        if (typeof callback === 'function') {
            callback(user);
        }
    });

    // ======================================================================
    //     LÓGICA PARA PROCESSAR O LOGIN APÓS O REDIRECIONAMENTO
    // ======================================================================
    // Isto é executado uma vez quando a página recarrega após o utilizador voltar do Google.
    getRedirectResult(auth).then(async (result) => {
        if (result && result.user) {
            // Se o login foi bem-sucedido, garantimos que os dados do perfil estão completos.
            await garantirDadosCompletos(result.user);
        }
    }).catch(error => {
        console.error("Erro ao obter resultado do redirecionamento:", error);
        showAlert("Erro de Login", `Ocorreu um erro ao finalizar o login: ${error.message}`);
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
 * Garante que o perfil do utilizador (tanto no Auth quanto no Firestore) tenha nome e telefone.
 * Pede ao utilizador para completar os dados se necessário.
 * @param {object} user - O objeto do utilizador do Firebase Auth.
 */
async function garantirDadosCompletos(user) {
    try {
        const empresaId = getEmpresaIdFromUrl();
        if (!empresaId) {
            console.error("ID da empresa não encontrado na URL para salvar dados do cliente.");
            await showAlert("Erro Crítico", "Não foi possível identificar a empresa. O seu perfil pode não ter sido salvo corretamente.");
            return;
        }
        
        const clienteDocRef = doc(db, `empresarios/${empresaId}/clientes/${user.uid}`);
        const clienteDocSnap = await getDoc(clienteDocRef);

        let dadosCliente = clienteDocSnap.exists() ? clienteDocSnap.data() : {};

        let nomeFaltando = !user.displayName && !dadosCliente.nome;
        let telefoneFaltando = !user.phoneNumber && !dadosCliente.telefone;

        if (!nomeFaltando && !telefoneFaltando) {
            // Se os dados já estão completos, apenas garante que o registro existe no Firestore.
            await setDoc(clienteDocRef, {
                nome: user.displayName || dadosCliente.nome,
                email: user.email,
                telefone: user.phoneNumber || dadosCliente.telefone,
                google: true,
                ultimoLoginEm: serverTimestamp()
            }, { merge: true });
            return; // Dados completos, não faz mais nada.
        }

        let nome = user.displayName || dadosCliente.nome || '';
        let telefone = user.phoneNumber || dadosCliente.telefone || '';

        if (nomeFaltando) {
            nome = prompt("Para continuar, por favor, informe o seu nome completo:");
            if (!nome || !nome.trim()) {
                await showAlert("Nome obrigatório", "O seu nome é necessário para concluir o cadastro. O login será cancelado.");
                await signOut(auth);
                return;
            }
        }

        if (telefoneFaltando) {
            while (true) {
                telefone = prompt("Ótimo! Agora, por favor, informe o seu melhor telefone (WhatsApp):");
                if (telefone === null) { // Utilizador clicou em "Cancelar"
                    await showAlert("Telefone obrigatório", "O telefone é necessário. O login será cancelado.");
                    await signOut(auth);
                    return;
                }
                const telefoneLimpo = telefone.replace(/\D/g, "");
                if (/^\d{9,15}$/.test(telefoneLimpo)) {
                    telefone = telefoneLimpo; // Salva apenas os números
                    break;
                } else {
                    await showAlert("Telefone inválido", "Por favor, digite um telefone válido, apenas com números (Ex: 11999998888).");
                }
            }
        }
        
        // Atualiza o perfil no Firebase Auth (se necessário)
        if (nomeFaltando) {
            await updateProfile(user, { displayName: nome });
        }
        
        // Salva os dados completos no Firestore
        await setDoc(clienteDocRef, {
            nome: nome.trim(),
            email: user.email,
            telefone: telefone,
            google: true,
            criadoEm: dadosCliente.criadoEm || serverTimestamp(), // Mantém a data de criação original
            ultimoLoginEm: serverTimestamp()
        }, { merge: true });
        
        await showAlert("Sucesso!", "Seu cadastro foi concluído com sucesso.");

    } catch (error) {
        console.error("Erro ao garantir dados completos do utilizador:", error);
        await showAlert("Erro de Perfil", "Houve um problema ao salvar os dados do seu perfil.");
    }
}


/**
 * Realiza login com email e senha.
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
 * Realiza cadastro com email, senha, nome e telefone.
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
 * Inicia o processo de logout do usuário.
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
 * Utilitário: busca empresaId da URL (?empresa=xxxx)
 */
function getEmpresaIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa'); // Removido "|| 'padrao'" para evitar salvar clientes em uma empresa padrão.
}
