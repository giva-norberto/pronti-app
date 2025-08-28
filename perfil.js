// ======================================================================
// PERFIL.JS (VERSÃO REVISADA, ROBUSTA E COMPATÍVEL COM FIREBASE V10.13.2)
// ======================================================================

import {
    doc, getDoc, setDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";
import { verificarAcesso } from "./userService.js";

// Garante que os serviços do Firebase foram inicializados
if (!app || !db || !auth || !storage) {
    console.error("Firebase não foi inicializado corretamente. Verifique firebase-config.js");
    throw new Error("Firebase não inicializado.");
}

window.addEventListener('DOMContentLoaded', () => {
    // Delay para garantir sincronização de sessão/userService.js
    setTimeout(() => {
        // Mapeamento dos elementos do DOM para fácil acesso
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
            linkVitrineMenu: document.querySelector('.sidebar-links a[href="vitrine.html"]'),
            btnLogout: document.getElementById('btn-logout'),
            msgFree: document.getElementById('mensagem-free'),
            msgCadastroSucesso: document.getElementById('mensagem-cadastro-sucesso'),
            boasVindasAposCadastro: document.getElementById('boas-vindas-apos-cadastro'),
            btnFecharBoasVindas: document.getElementById('fechar-boas-vindas'),
            btnCriarNovaEmpresa: document.getElementById('btn-criar-nova-empresa'),
          msgPerfilAusente: document.getElementById('mensagem-perfil-ausente')
        };

        let currentUser;
        let empresaId = null;

        // Listener principal de autenticação
        onAuthStateChanged(auth, async (user) => {
            console.log("onAuthStateChanged disparou. user:", user);
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
                    if (
                        e.message !== 'primeiro_acesso' &&
                        e.message !== 'perfil_ausente'
                    ) {
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
                empresaId = localStorage.getItem('empresaAtivaId');

                if (!empresaId) {
                    atualizarTelaParaNovoPerfil();
                    if (elements.msgFree) {
                        elements.msgFree.style.display = "none";
                    }
                    if (elements.msgPerfilAusente) {
                        elements.msgPerfilAusente.style.display = "block";
                        elements.msgPerfilAusente.textContent = "Seu perfil de empresa ainda não está cadastrado. Complete o cadastro para ativar todas as funções!";
                    }
                } else {
                    const empresaRef = doc(db, "empresarios", empresaId);
                    const empresaDoc = await getDoc(empresaRef);
                    if (empresaDoc.exists()) {
                        const dadosEmpresa = empresaDoc.data();
                        preencherFormulario(dadosEmpresa);
                        mostrarCamposExtras();
                        if (elements.msgPerfilAusente) {
                            elements.msgPerfilAusente.style.display = "none";
                        }
                        if (dadosEmpresa.plano === "free" && elements.msgFree) {
                            elements.msgFree.innerHTML = 'Plano atual: <strong>FREE</strong>. Você está em período de teste gratuito!';
                            elements.msgFree.style.display = "block";
                        } else if (elements.msgFree) {
                            elements.msgFree.style.display = "none";
                        }
                    } else {
                        // Se o ID no localStorage for inválido, limpa e recarrega
                        localStorage.removeItem('empresaAtivaId');
                        atualizarTelaParaNovoPerfil();
                        if (elements.msgPerfilAusente) {
                            elements.msgPerfilAusente.style.display = "block";
                            elements.msgPerfilAusente.textContent = "O perfil da empresa não foi encontrado. Por favor, cadastre novamente.";
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                alert("Erro ao carregar dados do perfil: " + error.message);
            }
        }

        async function handleFormSubmit(event) {
            event.preventDefault();
            console.log('Formulário foi enviado!');
            if (elements.btnSalvar) {
                elements.btnSalvar.disabled = true;
                elements.btnSalvar.textContent = 'A salvar...';
            }
            try {
                const uid = currentUser?.uid;
                if (!uid) throw new Error("Utilizador não autenticado.");

                const nomeNegocio = elements.nomeNegocioInput?.value.trim();
                if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

                // MELHORIA: Adicione campos automáticos e essenciais
                const dadosEmpresa = {
                    nomeFantasia: nomeNegocio,
                    descricao: elements.descricaoInput?.value.trim() || '',
                    localizacao: elements.localizacaoInput?.value.trim() || '',
                    horarioFuncionamento: elements.horarioFuncionamentoInput?.value.trim() || '',
                    chavePix: elements.chavePixInput?.value.trim() || '',
                    donoId: uid,
                    plano: "free",
                    status: "ativo", // automático
                    updatedAt: serverTimestamp()
                };

                // Só criar createdAt na criação
                if (!empresaId) {
                    dadosEmpresa.createdAt = serverTimestamp();
                }

                const logoFile = elements.logoInput?.files[0];
                if (logoFile) {
                    console.log("A tentar fazer o upload da logo...");
                    const storagePath = `logos/${uid}/${Date.now()}-${logoFile.name}`;
                    const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
                    try {
                        dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
                        console.log("Upload bem-sucedido:", dadosEmpresa.logoUrl);
                    } catch (uploadError) {
                        console.error("ERRO NO UPLOAD:", uploadError);
                        alert(`Falha no upload da logo. Erro: ${uploadError.message}`);
                        return;
                    }
                }

                if (empresaId) {
                    // --- LÓGICA DE EDIÇÃO ---
                    await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                    alert("Perfil atualizado com sucesso!");
                } else {
                    // --- LÓGICA DE NOVO CADASTRO ---
                    const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                    empresaId = novaEmpresaRef.id;

                    // MELHORIA: Cria automaticamente o dono como profissional
                    const dadosProfissional = {
                        uid: uid,
                        nome: currentUser.displayName || nomeNegocio,
                        fotoUrl: currentUser.photoURL || "",
                        ehDono: true,
                        criadoEm: serverTimestamp(),
                        status: "ativo"
                    };
                    await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional);

                    // Lógica do card de boas-vindas
                    if (elements.boasVindasAposCadastro) {
                        elements.boasVindasAposCadastro.style.display = "block";
                        if (elements.btnFecharBoasVindas) {
                            elements.btnFecharBoasVindas.onclick = () => {
                                elements.boasVindasAposCadastro.style.display = "none";
                            };
                        }
                        setTimeout(() => {
                            elements.boasVindasAposCadastro.style.display = "none";
                        }, 7000);
                    }

                    if (elements.msgCadastroSucesso) {
                        elements.msgCadastroSucesso.innerHTML = "O seu negócio foi cadastrado com sucesso!<br>Você ganhou <strong>15 dias grátis</strong>!";
                        elements.msgCadastroSucesso.style.display = "block";
                        setTimeout(() => {
                            elements.msgCadastroSucesso.style.display = "none";
                        }, 6000);
                    }

                    // Após criar, guarda o ID da nova empresa como ativa e recarrega
                    localStorage.setItem('empresaAtivaId', empresaId);
                    await carregarDadosDaPagina(uid);
                }
            } catch (error) {
                console.error("Erro ao salvar perfil:", error);
                alert("Ocorreu um erro ao salvar: " + error.message);
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
                try {
                    localStorage.removeItem('empresaAtivaId');
                    await signOut(auth);
                    window.location.href = 'login.html';
                }
                catch (error) { console.error("Erro no logout:", error); }
            });

            if (elements.btnCriarNovaEmpresa) {
                elements.btnCriarNovaEmpresa.addEventListener('click', () => {
                    localStorage.removeItem('empresaAtivaId');
                    empresaId = null;
                    atualizarTelaParaNovoPerfil();
                    if (elements.msgPerfilAusente) {
                        elements.msgPerfilAusente.style.display = "block";
                        elements.msgPerfilAusente.textContent = "Seu perfil de empresa ainda não está cadastrado. Complete o cadastro para ativar todas as funções!";
                    }
                });
            }
        }

        function atualizarTelaParaNovoPerfil() {
            if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Novo Negócio";
            if (elements.form) elements.form.reset();
            if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";

            const camposExtras = [elements.containerLinkVitrine, elements.btnAbrirVitrine];
            camposExtras.forEach(el => { if (el) el.style.display = 'none'; });

            if (elements.msgFree) elements.msgFree.style.display = "none";
            if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
            if (elements.boasVindasAposCadastro) elements.boasVindasAposCadastro.style.display = "none";
        }

        function mostrarCamposExtras() {
            const camposExtras = [elements.containerLinkVitrine, elements.btnAbrirVitrine];
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

    }, 100); // Delay para garantir leitura da sessão/localStorage/userService.js
});
