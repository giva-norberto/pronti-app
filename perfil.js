// ======================================================================
// PERFIL.JS (COMPLETO E REVISADO - MULTIEMPRESAS, LOGOUT AUTOMÁTICO E SELEÇÃO)
// ======================================================================

import {
    getFirestore, doc, getDoc, setDoc, addDoc, collection, serverTimestamp, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";
import { verificarAcesso } from "./userService.js";

// Garante que os serviços do Firebase foram inicializados
if (!app || !db || !auth || !storage  ) {
    console.error("Firebase não foi inicializado corretamente. Verifique firebase-config.js");
    throw new Error("Firebase não inicializado.");
}

window.addEventListener('DOMContentLoaded', () => {
    // Mapeamento dos elementos do DOM
    const elements = {
        h1Titulo: document.getElementById('main-title'),
        form: document.getElementById('form-perfil'),
        nomeNegocioInput: document.getElementById('nomeNegocio'),
        descricaoInput: document.getElementById('descricao'),
        localizacaoInput: document.getElementById('localizacao'),
        horarioFuncionamentoInput: document.getElementById('horarioFuncionamento'),
        chavePixInput: document.getElementById('chavePix'),
        logoInput: document.getElementById('logoNegocio'),
        logoPreview: document.getElementById('logo-preview'),
        btnUploadLogo: document.getElementById('btn-upload-logo'),
        btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
        btnCopiarLink: document.getElementById('btn-copiar-link'),
        containerLinkVitrine: document.getElementById('container-link-vitrine'),
        urlVitrineEl: document.getElementById('url-vitrine-display'),
        btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
        btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
        btnLogout: document.getElementById('btn-logout'),
        msgCadastroSucesso: document.getElementById('mensagem-cadastro-sucesso'),
        btnCriarNovaEmpresa: document.getElementById('btn-criar-nova-empresa'),
        empresaSelectorGroup: document.getElementById('empresa-selector-group'),
        selectEmpresa: document.getElementById('selectEmpresa')
    };

    let empresaId = null;
    let currentUser;
    let empresasDoDono = [];

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await carregarEmpresasDoUsuario(user.uid);
            adicionarListenersDeEvento();
        } else {
            window.location.href = 'login.html';
        }
    });

    async function carregarEmpresasDoUsuario(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        empresasDoDono = snapshot.docs.map(doc => ({
            id: doc.id,
            nome: doc.data().nomeFantasia || doc.id,
            dados: doc.data()
        }));

        // Mostra dropdown se houver mais de uma empresa
        if (elements.empresaSelectorGroup && elements.selectEmpresa) {
            if (empresasDoDono.length > 1) {
                elements.empresaSelectorGroup.style.display = '';
                elements.selectEmpresa.innerHTML = '';
                empresasDoDono.forEach(empresa => {
                    const opt = document.createElement('option');
                    opt.value = empresa.id;
                    opt.textContent = empresa.nome;
                    elements.selectEmpresa.appendChild(opt);
                });
                empresaId = empresasDoDono[0].id;
                preencherFormulario(empresasDoDono[0].dados);
                mostrarCamposExtras();
                elements.selectEmpresa.onchange = function() {
                    empresaId = this.value;
                    const empresaSel = empresasDoDono.find(e => e.id === empresaId);
                    preencherFormulario(empresaSel.dados);
                    mostrarCamposExtras();
                };
            } else if (empresasDoDono.length === 1) {
                elements.empresaSelectorGroup.style.display = 'none';
                empresaId = empresasDoDono[0].id;
                preencherFormulario(empresasDoDono[0].dados);
                mostrarCamposExtras();
            } else {
                empresaId = null;
                atualizarTelaParaNovoPerfil();
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        elements.btnSalvar.disabled = true;
        elements.btnSalvar.textContent = 'A salvar...';
        try {
            const uid = currentUser?.uid;
            if (!uid) throw new Error("Utilizador não autenticado.");
            const nomeNegocio = elements.nomeNegocioInput.value.trim();
            if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");
            const timestampCliente = new Date();

            const dadosEmpresa = {
                nomeFantasia: nomeNegocio,
                descricao: elements.descricaoInput.value.trim(),
                localizacao: elements.localizacaoInput.value.trim(),
                horarioFuncionamento: elements.horarioFuncionamentoInput.value.trim(),
                chavePix: elements.chavePixInput.value.trim(),
                donoId: uid,
                plano: "free",
                status: "ativo",
                updatedAt: timestampCliente
            };

            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const storagePath = `logos/${uid}/${Date.now()}-${logoFile.name}`;
                const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
                dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
            }

            if (!empresaId) {
                // CRIANDO NOVA EMPRESA
                dadosEmpresa.createdAt = timestampCliente;
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                empresaId = novaEmpresaRef.id;
                await setDoc(doc(db, "mapaUsuarios", uid), { empresaId: empresaId });
                await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), {
                    uid: uid,
                    nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "",
                    ehDono: true,
                    criadoEm: timestampCliente,
                    status: "ativo"
                });
                alert("Negócio cadastrado! Você irá sair para logar novamente e selecionar sua empresa.");
                await signOut(auth);
                window.location.href = 'login.html';
                return; // Para aqui
            } else {
                // EDITANDO EMPRESA EXISTENTE
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                alert("Perfil atualizado com sucesso!");
            }
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Ocorreu um erro ao salvar: " + error.message);
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = 'Salvar Todas as Configurações';
        }
    }

    function handleCriarNovaEmpresa() {
        empresaId = null;
        if (elements.form) elements.form.reset();
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Negócio";
    }

    function adicionarListenersDeEvento() {
        if (elements.form) elements.form.addEventListener('submit', handleFormSubmit);
        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
        if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput.click());
        if (elements.logoInput) elements.logoInput.addEventListener('change', () => {
            const file = elements.logoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { if (elements.logoPreview) elements.logoPreview.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        });
        if (elements.btnCriarNovaEmpresa) {
            elements.btnCriarNovaEmpresa.addEventListener('click', function() {
                if (confirm("Você irá sair e precisará logar novamente para selecionar sua empresa. Deseja continuar?")) {
                    handleCriarNovaEmpresa();
                }
            });
        }
        if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
            try { 
                localStorage.removeItem('empresaAtivaId'); 
                await signOut(auth); 
                window.location.href = 'login.html'; 
            }
            catch (error) { console.error("Erro no logout:", error); }
        });
    }

    function atualizarTelaParaNovoPerfil() {
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Negócio";
        if (elements.form) elements.form.reset();
        empresaId = null;
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el ) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
        if (elements.btnCriarNovaEmpresa) elements.btnCriarNovaEmpresa.style.display = 'inline-flex';
        if (elements.empresaSelectorGroup) elements.empresaSelectorGroup.style.display = 'none';
    }

    function mostrarCamposExtras() {
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el) el.style.display = ''; });
        if (elements.btnCriarNovaEmpresa) elements.btnCriarNovaEmpresa.style.display = 'inline-flex';
    }

    function preencherFormulario(dadosEmpresa) {
        if (elements.nomeNegocioInput) elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
        if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
        if (elements.localizacaoInput) elements.localizacaoInput.value = dadosEmpresa.localizacao || '';
        if (elements.horarioFuncionamentoInput) elements.horarioFuncionamentoInput.value = dadosEmpresa.horarioFuncionamento || '';
        if (elements.chavePixInput) elements.chavePixInput.value = dadosEmpresa.chavePix || '';
        if (elements.logoPreview && dadosEmpresa.logoUrl) {
            elements.logoPreview.src = dadosEmpresa.logoUrl;
        }
        if (!empresaId) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
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
