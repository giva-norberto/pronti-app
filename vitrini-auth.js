// RESPONSABILIDADE: Interagir com o Firebase Authentication e
// notificar a aplicação sobre mudanças no estado de login.

import { auth, provider, db } from './vitrini-firebase.js';

import { 
    onAuthStateChanged, 
    signInWithPopup, 
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
    onAuthStateChanged(auth, (user) => {
        if (typeof callback === 'function') {
            callback(user);
        }
    });
}

/**
 * Inicia o processo de login com o popup do Google e garante a persistência.
 * Se faltar telefone ou nome, pede antes de prosseguir e salva no Firestore.
 * BLOQUEIA o login caso não informe telefone.
 */
export async function fazerLogin() {
    try {
        await setPersistence(auth, browserLocalPersistence);

        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Verifica se falta telefone (ou nome, se desejar)
        let telefoneFaltando = !user.phoneNumber;
        let nomeFaltando = !user.displayName;
        let telefone = '';
        let nome = '';

        // Busca no Firestore para complementar, caso o Firebase Auth não tenha telefone
        const empresaId = getEmpresaIdFromUrl();
        const clienteDocRef = doc(db, `empresarios/${empresaId}/clientes/${user.uid}`);
        const clienteDocSnap = await getDoc(clienteDocRef);
        if (clienteDocSnap.exists()) {
            const dados = clienteDocSnap.data();
            if (dados.telefone) telefoneFaltando = false;
            if (dados.nome) nomeFaltando = false;
        }

        // Se faltar telefone ou nome, pede via prompt (ou pode fazer modal customizado)
        if (telefoneFaltando || nomeFaltando) {
            // Prompt simples, pode trocar por modal customizado na UI
            if (nomeFaltando) {
                nome = prompt("Informe seu nome completo:");
                if (!nome) {
                    await showAlert("Nome obrigatório", "Seu nome é necessário para concluir o cadastro.");
                    // Se cancelar nome, faz logout e bloqueia login
                    await signOut(auth);
                    return;
                }
            } else {
                nome = user.displayName || (clienteDocSnap.exists() ? clienteDocSnap.data().nome : "");
            }

            if (telefoneFaltando) {
                // Loop até informar telefone válido ou cancelar (cancela faz logout!)
                while (true) {
                    telefone = prompt("Informe seu telefone (WhatsApp):");
                    if (telefone === null) {
                        await showAlert("Telefone obrigatório", "Você precisa informar um telefone para continuar.");
                        // Faz logout e bloqueia login
                        await signOut(auth);
                        return;
                    }
                    if (telefone && telefone.trim()) {
                        telefone = telefone.trim();
                        // Validação simples de telefone (apenas números, 9 a 15 dígitos)
                        if (/^\d{9,15}$/.test(telefone.replace(/\D/g, ""))) {
                            break;
                        } else {
                            await showAlert("Telefone inválido", "Digite apenas números. Exemplo: 11999998888");
                        }
                    } else {
                        await showAlert("Telefone obrigatório", "Você precisa informar um telefone para continuar.");
                    }
                }
            } else {
                telefone = user.phoneNumber || (clienteDocSnap.exists() ? clienteDocSnap.data().telefone : "");
            }

            // Atualiza no Firestore
            await setDoc(clienteDocRef, {
                nome: nome,
                email: user.email,
                telefone: telefone,
                google: true,
                atualizadoEm: serverTimestamp()
            }, { merge: true });

            // Opcional: Atualiza também o displayName no auth se desejar
            if (nomeFaltando) {
                await updateProfile(user, { displayName: nome });
            }
        } else {
            // Já tem tudo, só garante doc no Firestore (merge)
            await setDoc(clienteDocRef, {
                nome: user.displayName,
                email: user.email,
                telefone: user.phoneNumber || (clienteDocSnap.exists() ? clienteDocSnap.data().telefone : ""),
                google: true,
                atualizadoEm: serverTimestamp()
            }, { merge: true });
        }

    } catch (error) {
        console.error("Erro no login:", error.message);
        if (error.code !== 'auth/popup-closed-by-user') {
            await showAlert("Erro no Login", "Não foi possível fazer o login. Por favor, tente novamente.");
        }
    }
}

/**
 * Realiza login com email e senha.
 */
export async function loginComEmailSenha(email, senha) {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithEmailAndPassword(auth, email, senha);
        // O listener 'onAuthStateChanged' cuidará da UI
        return result.user;
    } catch (error) {
        console.error("Erro no login por email/senha:", error);
        await showAlert("Erro no Login", "Email ou senha inválidos, ou erro ao acessar sua conta.");
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

        // Salva dados no Firestore
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
        // O listener 'onAuthStateChanged' cuidará de atualizar a UI.
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
    return params.get('empresa') || "padrao";
}
