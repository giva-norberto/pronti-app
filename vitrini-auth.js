// ======================================================================
//        VITRINI-AUTH.JS - MÓDULO DE AUTENTICAÇÃO (CORRIGIDO)
//    Responsabilidade: Gerir o login, logout e o estado do
//                        utilizador na vitrine.
// ======================================================================

import { auth, provider, db } from './vitrini-firebase.js';

import { 
    onAuthStateChanged, 
    signInWithRedirect,
    getRedirectResult,
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
// NOVO: Importa a função que vai controlar o modal de dados do utilizador
import { pedirDadosAdicionaisModal } from './vitrine-auth-modal.js';

/**
 * Configura o listener que observa mudanças no estado de autenticação (login/logout).
 * @param {Function} callback - A função a ser executada quando o estado de auth mudar.
 */
export function setupAuthListener(callback) {
    if (typeof onAuthStateChanged !== "function") {
        console.error("Firebase Auth não carregado corretamente.");
        return;
    }
    
    onAuthStateChanged(auth, (user) => {
        if (typeof callback === 'function') {
            callback(user);
        }
    });

    getRedirectResult(auth).then(async (result) => {
        if (result && result.user) {
            UI.toggleLoader(true, 'A finalizar o seu login...'); // Mostra um loader
            await garantirDadosCompletos(result.user);
            UI.toggleLoader(false); // Esconde o loader
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
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error("Erro ao iniciar o login com redirecionamento:", error);
        await showAlert("Erro no Login", "Não foi possível iniciar o processo de login.");
    }
}

/**
 * Garante que o perfil do utilizador tenha nome e telefone, usando um MODAL em vez de 'prompt'.
 * @param {object} user - O objeto do utilizador do Firebase Auth.
 */
async function garantirDadosCompletos(user) {
    try {
        const empresaId = getEmpresaIdFromUrl();
        if (!empresaId) {
            await showAlert("Erro Crítico", "ID da empresa não encontrado. O seu perfil não foi salvo.");
            return;
        }
        
        const clienteDocRef = doc(db, `empresarios/${empresaId}/clientes/${user.uid}`);
        const clienteDocSnap = await getDoc(clienteDocRef);
        const dadosCliente = clienteDocSnap.exists() ? clienteDocSnap.data() : {};

        const nomeFaltando = !user.displayName && !dadosCliente.nome;
        const telefoneFaltando = !user.phoneNumber && !dadosCliente.telefone;

        let nome = user.displayName || dadosCliente.nome || '';
        let telefone = user.phoneNumber || dadosCliente.telefone || '';

        // Se os dados estiverem faltando, chama o modal para o utilizador preencher
        if (nomeFaltando || telefoneFaltando) {
            try {
                // Esta função (que você vai criar no passo 2) abre o modal e espera o resultado
                const dadosDoModal = await pedirDadosAdicionaisModal({ nome, telefone });
                nome = dadosDoModal.nome;
                telefone = dadosDoModal.telefone;
            } catch (error) {
                // O utilizador fechou o modal ou cancelou
                await showAlert("Cadastro incompleto", "É necessário preencher os seus dados para continuar.");
                await signOut(auth); // Desloga o utilizador para não o deixar num estado incompleto
                return;
            }
        }
        
        // Atualiza o perfil no Firebase Auth se o nome foi preenchido agora
        if (nomeFaltando && nome) {
            await updateProfile(user, { displayName: nome });
        }
        
        // Salva os dados completos no Firestore
        await setDoc(clienteDocRef, {
            nome: nome.trim(),
            email: user.email,
            telefone: telefone,
            google: true,
            criadoEm: dadosCliente.criadoEm || serverTimestamp(),
            ultimoLoginEm: serverTimestamp()
        }, { merge: true });
        
        await showAlert("Sucesso!", "Login realizado e perfil atualizado com sucesso.");

    } catch (error) {
        console.error("Erro ao garantir dados completos do utilizador:", error);
        await showAlert("Erro de Perfil", "Houve um problema ao salvar os dados do seu perfil.");
    }
}

// ======================================================================
//   AS FUNÇÕES ABAIXO FORAM MANTIDAS SEM ALTERAÇÕES
// ======================================================================

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
    return params.get('empresa');
}
