// ======================================================================
//        VITRINI-AUTH.JS - MÓDULO DE AUTENTICAÇÃO (VERSÃO CORRIGIDA E AUTOSSUFICIENTE)
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
// REMOVIDO: A importação que causava o erro foi removida.

// ======================================================================
//   FUNÇÃO DO MODAL (agora dentro deste arquivo para evitar erros)
// ======================================================================
/**
 * Abre um modal para pedir dados adicionais (nome, telefone) ao utilizador.
 * Retorna uma Promise que resolve com os dados preenchidos ou rejeita se o utilizador cancelar.
 * @param {object} dadosAtuais - Contém o nome e telefone que já temos para pré-preencher.
 * @returns {Promise<object>} - Uma promessa que resolve com { nome, telefone }.
 */
function pedirDadosAdicionaisModal(dadosAtuais = { nome: '', telefone: '' }) {
    return new Promise((resolve, reject) => {
        // --- Conecte estes IDs com os elementos do seu HTML ---
        const modal = document.getElementById('modal-auth-janela'); 
        const form = document.getElementById('modal-auth-form-cadastro'); 
        const nomeInput = document.getElementById('modal-auth-cadastro-nome');
        const telefoneInput = document.getElementById('modal-auth-cadastro-telefone');
        const btnSalvar = form.querySelector('button'); 
        const btnCancelar = document.getElementById('modal-auth-btn-to-login');

        // Mostra a secção correta do modal e exibe-o
        document.getElementById('modal-auth-login').style.display = 'none';
        document.getElementById('modal-auth-cadastro').style.display = 'block';
        modal.style.display = 'flex';
        
        // Altera os textos para "Completar Cadastro"
        modal.querySelector('#modal-auth-cadastro h2').textContent = 'Complete o seu Cadastro';
        btnSalvar.textContent = 'Salvar e Continuar';

        // Pré-preenche os campos
        nomeInput.value = dadosAtuais.nome || '';
        telefoneInput.value = dadosAtuais.telefone || '';
        
        if(nomeInput.value) { telefoneInput.focus(); } else { nomeInput.focus(); }

        const aoSubmeter = (e) => {
            e.preventDefault();
            const nome = nomeInput.value.trim();
            const telefoneLimpo = telefoneInput.value.replace(/\D/g, "");

            if (!nome) { alert("Por favor, preencha o seu nome."); return; }
            if (!/^\d{9,15}$/.test(telefoneLimpo)) { alert("Por favor, digite um telefone válido."); return; }

            limparEventos();
            modal.style.display = 'none';
            resolve({ nome, telefone: telefoneLimpo });
        };

        const aoCancelar = () => {
            limparEventos();
            modal.style.display = 'none';
            reject(new Error("O utilizador cancelou a operação."));
        };

        const limparEventos = () => {
            form.removeEventListener('submit', aoSubmeter);
            btnCancelar.removeEventListener('click', aoCancelar);
        };

        form.addEventListener('submit', aoSubmeter);
        btnCancelar.addEventListener('click', aoCancelar);
    });
}

// ======================================================================
//   LÓGICA PRINCIPAL DE AUTENTICAÇÃO
// ======================================================================

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
            // UI.toggleLoader(true, 'A finalizar o seu login...'); // Descomentar se tiver a função de loader
            await garantirDadosCompletos(result.user);
            // UI.toggleLoader(false);
        }
    }).catch(error => {
        console.error("Erro ao obter resultado do redirecionamento:", error);
        showAlert("Erro de Login", `Ocorreu um erro ao finalizar o login: ${error.message}`);
    });
}

export async function fazerLogin() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error("Erro ao iniciar o login com redirecionamento:", error);
        await showAlert("Erro no Login", "Não foi possível iniciar o processo de login.");
    }
}

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

        if (nomeFaltando || telefoneFaltando) {
            try {
                const dadosDoModal = await pedirDadosAdicionaisModal({ nome, telefone });
                nome = dadosDoModal.nome;
                telefone = dadosDoModal.telefone;
            } catch (error) {
                await showAlert("Cadastro incompleto", "É necessário preencher os seus dados para continuar.");
                await signOut(auth);
                return;
            }
        }
        
        if (nomeFaltando && nome) {
            await updateProfile(user, { displayName: nome });
        }
        
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

export async function cadastrarComEmailSenha(nome, email, senha, telefone) {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(result.user, { displayName: nome });

        const empresaId = getEmpresaIdFromUrl();
        const clienteDocRef = doc(db, `empresarios/${empresaId}/clientes/${result.user.uid}`);
        await setDoc(clienteDocRef, {
            nome, email, telefone, google: false, criadoEm: serverTimestamp()
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

export async function fazerLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro no logout:", error);
        await showAlert("Erro", "Ocorreu um erro ao tentar sair da conta.");
    }
}

function getEmpresaIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa');
}
