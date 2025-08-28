// ======================================================================
// PERFIL.JS (VERSÃO FINAL E ROBUSTA - COM CORREÇÃO DE SINTAXE)
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
if (!app || !db || !auth || !storage ) {
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
        msgCadastroSucesso: document.getElementById('mensagem-cadastro-sucesso')
    };

    let currentUser;
    let empresaId = null;

    // Listener principal de autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await carregarDadosDaPagina(user.uid);
            adicionarListenersDeEvento();
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- FUNÇÕES PRINCIPAIS ---

    async function carregarDadosDaPagina(uid) {
        try {
            const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                console.log("Nenhuma empresa encontrada. Preparando para novo cadastro.");
                empresaId = null;
                atualizarTelaParaNovoPerfil();
            } else {
                const empresaDoc = snapshot.docs[0];
                empresaId = empresaDoc.id;
                console.log("Empresa encontrada:", empresaId);
                const dadosEmpresa = empresaDoc.data();
                preencherFormulario(dadosEmpresa);
                mostrarCamposExtras();
                if (elements.h1Titulo) elements.h1Titulo.textContent = "Edite o Perfil do seu Negócio";
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            alert("Erro ao carregar dados do perfil: " + error.message);
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

            const dadosEmpresa = {
                nomeFantasia: nomeNegocio,
                descricao: elements.descricaoInput.value.trim(),
                localizacao: elements.localizacaoInput.value.trim(),
                horarioFuncionamento: elements.horarioFuncionamentoInput.value.trim(),
                chavePix: elements.chavePixInput.value.trim(),
                donoId: uid,
                plano: "free",
                status: "ativo",
                updatedAt: serverTimestamp()
            };

            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const storagePath = `logos/${uid}/${Date.now()}-${logoFile.name}`;
                const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
                dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
            }
            
            if (empresaId) {
                console.log("Editando empresa existente:", empresaId);
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                alert("Perfil atualizado com sucesso!");
            } else {
                dadosEmpresa.createdAt = serverTimestamp();
                console.log("Criando nova empresa com os dados:", dadosEmpresa);
                
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                empresaId = novaEmpresaRef.id;
                console.log("Nova empresa criada com sucesso! ID:", empresaId);

                const dadosProfissional = {
                    uid: uid,
                    nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "",
                    ehDono: true,
                    criadoEm: serverTimestamp(),
                    status: "ativo"
                };
                await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional);

                preencherFormulario(dadosEmpresa);
                mostrarCamposExtras();
                if (elements.h1Titulo) elements.h1Titulo.textContent = "Edite o Perfil do seu Negócio";

                if (elements.msgCadastroSucesso) {
                    elements.msgCadastroSucesso.innerHTML = "O seu negócio foi cadastrado com sucesso!  
Você ganhou <strong>15 dias grátis</strong>!";
                    elements.msgCadastroSucesso.style.display = "block";
                    setTimeout(() => {
                        elements.msgCadastroSucesso.style.display = "none";
                    }, 6000);
                }
                alert("Negócio cadastrado com sucesso!");
            }

        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Ocorreu um erro ao salvar: " + error.message);
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = 'Salvar Todas as Configurações';
        }
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
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        const camposExtras = [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline];
        camposExtras.forEach(el => { if (el ) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
    }

    function mostrarCamposExtras() {
        const camposExtras = [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline];
        camposExtras.forEach(el => { if (el) el.style.display = ''; });
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
        // CORREÇÃO APLICADA AQUI: Uso de crase (`) em vez de aspas (')
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
    }

    function copiarLink() {
        if (!empresaId) return;
        // CORREÇÃO APLICADA AQUI: Uso de crase (`) em vez de aspas (')
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }
});
