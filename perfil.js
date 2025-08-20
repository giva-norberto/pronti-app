import {
    getFirestore, doc, getDoc, setDoc, addDoc, collection,
    query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
    getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";
import { verificarAcesso } from "./userService.js";

// Garante que os serviços do Firebase foram inicializados
if (!app || !db || !auth || !storage) {
    console.error("Firebase não foi inicializado corretamente. Verifique firebase-config.js");
    throw new Error("Firebase não inicializado.");
}

window.addEventListener('DOMContentLoaded', () => {
    // Mapeamento dos elementos do DOM para fácil acesso
    const elements = {
        h1Titulo: document.getElementById('main-title'),
        form: document.getElementById('form-perfil'),
        nomeNegocioInput: document.getElementById('nomeNegocio'),
        descricaoInput: document.getElementById('descricao'),
        logoInput: document.getElementById('logoNegocio'),
        logoPreview: document.getElementById('logo-preview'),
        btnUploadLogo: document.getElementById('btn-upload-logo'),
        btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
        btnCopiarLink: document.getElementById('btn-copiar-link'),
        containerLinkVitrine: document.getElementById('container-link-vitrine'),
        urlVitrineEl: document.getElementById('url-vitrine-display'),
        btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
        btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
        linkVitrineMenu: document.querySelector('.sidebar-links a[href="vitrine.html"]'),
        btnLogout: document.getElementById('btn-logout'),
        msgFree: document.getElementById('mensagem-free')
    };

    let currentUser;
    let empresaId = null;

    // Listener principal de autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Verifica se o utilizador tem permissão para estar nesta página
            try {
                const acesso = await verificarAcesso();
                if (acesso.role && acesso.role !== "dono") {
                    window.location.href = "perfil-funcionario.html";
                    return;
                }
            } catch (e) {
                // Se for o primeiro acesso, permite continuar para criar a empresa
                if (e.message !== 'primeiro_acesso') {
                    window.location.href = 'login.html';
                    return;
                }
            }
            await carregarDadosDaPagina(user.uid);
            adicionarListenersDeEvento();
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- FUNÇÕES PRINCIPAIS ---

    async function carregarDadosDaPagina(uid) {
        try {
            const empresariosRef = collection(db, "empresarios");
            const q = query(empresariosRef, where("donoId", "==", uid));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Cenário: Novo utilizador, ainda não tem empresa
                empresaId = null;
                atualizarTelaParaNovoPerfil();
            } else {
                // Cenário: Utilizador existente, carrega dados da empresa
                const empresaDoc = snapshot.docs[0];
                empresaId = empresaDoc.id;
                const dadosEmpresa = empresaDoc.data();
                preencherFormulario(dadosEmpresa);
                mostrarCamposExtras();
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            alert("Erro ao carregar dados do perfil: " + error.message);
        }
    }
    
    async function handleFormSubmit(event) {
        event.preventDefault();
        if (elements.btnSalvar) {
            elements.btnSalvar.disabled = true;
            elements.btnSalvar.textContent = 'A salvar...';
        }
        try {
            const uid = currentUser?.uid;
            if (!uid) throw new Error("Utilizador não autenticado.");

            const nomeNegocio = elements.nomeNegocioInput?.value.trim();
            if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

            const dadosEmpresa = {
                nomeFantasia: nomeNegocio,
                descricao: elements.descricaoInput?.value.trim() || '',
                donoId: uid
            };

            if (empresaId) {
                // --- LÓGICA DE EDIÇÃO ---
                const logoFile = elements.logoInput?.files[0];
                if (logoFile) {
                    console.log("A tentar fazer o upload da logo...");
                    const storagePath = `logos/${uid}/logo`;
                    const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
                    try {
                        dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
                        console.log("Upload bem-sucedido:", dadosEmpresa.logoUrl);
                    } catch (uploadError) {
                        console.error("ERRO NO UPLOAD:", uploadError);
                        alert(`Falha no upload da logo. Isto é geralmente um problema de permissão (CORS ou Chave de API). Verifique o guia no Canvas e as configurações no Google Cloud. Erro: ${uploadError.message}`);
                        throw uploadError; // Pára a execução para não salvar dados inconsistentes
                    }
                }
                
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                alert("Perfil atualizado com sucesso!");

            } else {
                // --- LÓGICA DE NOVO CADASTRO ---
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                empresaId = novaEmpresaRef.id;
                
                const dadosProfissional = {
                    uid: uid,
                    nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "",
                    ehDono: true
                };
                await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional);

                // CORREÇÃO: Lógica do card de uso gratuito restaurada
                if (elements.msgFree) {
                    elements.msgFree.textContent = "Seu negócio foi cadastrado com sucesso! Você ganhou 15 dias grátis!";
                    elements.msgFree.style.display = "block";
                } else {
                    alert("Seu negócio foi cadastrado com sucesso! Você ganhou 15 dias grátis!");
                }
                
                // Recarrega os dados na página para refletir o novo estado
                await carregarDadosDaPagina(uid);
            }

        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            if (!error.message.includes("Falha no upload")) {
                alert("Ocorreu um erro ao salvar: " + error.message);
            }
        } finally {
            if (elements.btnSalvar) {
                elements.btnSalvar.disabled = false;
                elements.btnSalvar.textContent = 'Salvar Configurações';
            }
        }
    }

    // --- FUNÇÕES DE UI E EVENTOS ---

    function adicionarListenersDeEvento() {
        if (elements.form) elements.form.addEventListener('submit', handleFormSubmit);
        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
        if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput?.click());
        if (elements.logoInput) elements.logoInput.addEventListener('change', () => {
            const file = elements.logoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { if (elements.logoPreview) elements.logoPreview.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        });
        if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
            try { await signOut(auth); window.location.href = 'login.html'; }
            catch (error) { console.error("Erro no logout:", error); }
        });
    }

    function atualizarTelaParaNovoPerfil() {
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
        const camposExtras = [elements.containerLinkVitrine, elements.btnAbrirVitrine, document.getElementById('logo-section')];
        camposExtras.forEach(el => { if(el) el.style.display = 'none'; });
    }

    function mostrarCamposExtras() {
        const camposExtras = [elements.containerLinkVitrine, elements.btnAbrirVitrine, document.getElementById('logo-section')];
        camposExtras.forEach(el => { if(el) el.style.display = ''; });
    }

    function preencherFormulario(dadosEmpresa) {
        if (elements.nomeNegocioInput) elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
        if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
        if (elements.logoPreview && dadosEmpresa.logoUrl) {
            elements.logoPreview.src = dadosEmpresa.logoUrl;
        }

        if (!empresaId) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
        if (elements.linkVitrineMenu) elements.linkVitrineMenu.href = urlCompleta;
    }

    function copiarLink() {
        if (!empresaId) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }
});
