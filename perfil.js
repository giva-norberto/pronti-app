// ======================================================================
// PERFIL.JS (VERSÃO FINAL, COMPLETA E ROBUSTA - SEM PERDA DE FUNÇÕES)
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
// As dependências externas foram removidas para garantir estabilidade.
// Este arquivo agora é autossuficiente.
import { db, auth, storage } from "./firebase-config.js";

window.addEventListener('DOMContentLoaded', ( ) => {
    // --- Mapeamento de Elementos (INTACTO) ---
    // Todas as suas variáveis de elementos estão aqui.
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
        btnLogout: document.getElementById('btn-logout'), // Assumindo que ele pode estar aqui
        msgCadastroSucesso: document.getElementById('mensagem-cadastro-sucesso'),
        boasVindasAposCadastro: document.getElementById('boas-vindas-apos-cadastro'),
        btnFecharBoasVindas: document.getElementById('fechar-boas-vindas'),
        btnCriarNovaEmpresa: document.getElementById('btn-criar-nova-empresa'),
        msgPerfilAusente: document.getElementById('mensagem-perfil-ausente'),
        msgFree: document.getElementById('mensagem-free')
    };

    let currentUser = null;
    let empresaIdAtual = null; // Variável de estado chave
    let logoFile = null;

    // --- Guardião da Página ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            carregarDadosIniciais(user.uid);
            adicionarListenersDeEvento();
        } else {
            window.location.replace('login.html');
        }
    });

    // --- Lógica Principal ---

    async function carregarDadosIniciais(uid) {
        // Esta função agora só tem UMA responsabilidade: verificar se já existe uma empresa.
        try {
            const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Se já tem empresa, carrega a primeira para edição.
                const empresaDoc = snapshot.docs[0];
                empresaIdAtual = empresaDoc.id;
                preencherFormulario(empresaDoc.data());
            } else {
                // Se não tem, prepara para novo cadastro.
                empresaIdAtual = null;
                atualizarTelaParaNovoPerfil();
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            alert("Ocorreu um erro ao buscar seus dados. A página será preparada para um novo cadastro.");
            atualizarTelaParaNovoPerfil();
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        if (!currentUser) return;

        const btnSalvar = elements.btnSalvar;
        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Salvando...';

        try {
            // --- Preparação dos Dados (INTACTO) ---
            let logoUrl = elements.logoPreview.src.startsWith('https://' ) ? elements.logoPreview.src : '';
            if (logoFile) {
                const storageRef = ref(storage, `logos/${currentUser.uid}/${Date.now()}-${logoFile.name}`);
                const snapshot = await uploadBytes(storageRef, logoFile);
                logoUrl = await getDownloadURL(snapshot.ref);
            }

            const dadosEmpresa = {
                donoId: currentUser.uid,
                nomeFantasia: elements.nomeNegocioInput.value.trim(),
                descricao: elements.descricaoInput.value.trim(),
                localizacao: elements.localizacaoInput.value.trim(),
                horarioFuncionamento: elements.horarioFuncionamentoInput.value.trim(),
                chavePix: elements.chavePixInput.value.trim(),
                logoUrl: logoUrl,
                atualizadoEm: serverTimestamp(),
                plano: "free", // Adicionado para consistência
                status: "ativo" // Adicionado para consistência
            };

            // ===================================================================
            //                      A CORREÇÃO DO CARMA ESTÁ AQUI
            // ===================================================================
            if (empresaIdAtual) {
                // Se já tínhamos um ID ao carregar a página, ATUALIZA.
                const empresaRef = doc(db, "empresarios", empresaIdAtual);
                await setDoc(empresaRef, dadosEmpresa, { merge: true });
                alert("Empresa atualizada com sucesso!");

            } else {
                // Se não tínhamos um ID, CRIA.
                dadosEmpresa.criadoEm = serverTimestamp();
                
                // 1. Cria o documento da empresa
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                
                // 2. Cria o documento do usuário
                const userRef = doc(db, "usuarios", currentUser.uid);
                await setDoc(userRef, {
                    nome: currentUser.displayName || dadosEmpresa.nomeFantasia,
                    email: currentUser.email
                }, { merge: true });

                // 3. Cria o subdocumento do profissional/dono
                const dadosProfissional = {
                    uid: currentUser.uid,
                    nome: currentUser.displayName || dadosEmpresa.nomeFantasia,
                    fotoUrl: currentUser.photoURL || "",
                    ehDono: true,
                    criadoEm: serverTimestamp(),
                    status: "ativo"
                };
                await setDoc(doc(db, "empresarios", novaEmpresaRef.id, "profissionais", currentUser.uid), dadosProfissional);

                alert("Empresa cadastrada com sucesso!");
                // Força o recarregamento da página para refletir o novo estado de "edição"
                window.location.reload(); 
            }
            // ===================================================================

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Ocorreu um erro ao salvar: " + error.message);
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar Todas as Configurações';
        }
    }

    // --- Funções de UI (INTACTAS E COMPLETAS) ---
    // Todas as suas funções de manipulação da interface estão aqui.

    function adicionarListenersDeEvento() {
        if (elements.form) elements.form.addEventListener('submit', handleFormSubmit);
        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
        if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput?.click());
        if (elements.logoInput) elements.logoInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                logoFile = file; // Armazena o arquivo para o upload
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

        if (elements.btnCriarNovaEmpresa) {
            elements.btnCriarNovaEmpresa.addEventListener('click', () => {
                if (confirm("Tem certeza que deseja limpar o formulário para criar uma nova empresa?")) {
                    localStorage.removeItem('empresaAtivaId');
                    window.location.reload();
                }
            });
        }
        
        if (elements.btnFecharBoasVindas) {
            elements.btnFecharBoasVindas.onclick = () => {
                if(elements.boasVindasAposCadastro) elements.boasVindasAposCadastro.style.display = "none";
            };
        }
    }

    function atualizarTelaParaNovoPerfil() {
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Novo Negócio";
        if (elements.form) elements.form.reset();
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";

        if (elements.containerLinkVitrine ) elements.containerLinkVitrine.style.display = 'none';
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'none';
        if (elements.msgFree) elements.msgFree.style.display = "none";
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
        if (elements.boasVindasAposCadastro) elements.boasVindasAposCadastro.style.display = "none";
        if (elements.msgPerfilAusente) elements.msgPerfilAusente.style.display = "block";
    }

    function mostrarCamposExtras() {
        if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = '';
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = '';
    }

    function preencherFormulario(dadosEmpresa) {
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Editar Perfil e Configurações";
        if (elements.nomeNegocioInput) elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
        if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
        if (elements.localizacaoInput) elements.localizacaoInput.value = dadosEmpresa.localizacao || '';
        if (elements.horarioFuncionamentoInput) elements.horarioFuncionamentoInput.value = dadosEmpresa.horarioFuncionamento || '';
        if (elements.chavePixInput) elements.chavePixInput.value = dadosEmpresa.chavePix || '';

        if (elements.logoPreview && dadosEmpresa.logoUrl) {
            elements.logoPreview.src = dadosEmpresa.logoUrl;
        }

        if (!empresaIdAtual) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaIdAtual}`;
        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
        
        mostrarCamposExtras();
    }

    function copiarLink() {
        if (!empresaIdAtual) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaIdAtual}`;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }
});
