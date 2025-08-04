/**
 * perfil.js (VERSÃO FINAL E COMPLETA - COM TODAS AS FUNÇÕES E CORREÇÕES)
 *
 * Esta versão foi construída a partir do seu último código, preservando as
 * funcionalidades avançadas (onSnapshot, ehDono) e corrigindo os bugs críticos.
 *
 * CORREÇÕES:
 * - A função de salvar (handleFormSubmit) agora verifica corretamente se deve ATUALIZAR
 * uma empresa existente ou CRIAR uma nova, resolvendo o bug de duplicação.
 * - A lógica de upload de logo foi consolidada.
 * - A funcionalidade de adicionar novos funcionários está completa.
 * - Todo o código está envolto em DOMContentLoaded para garantir a estabilidade.
 */

import { db, auth } from "./firebase-config.js";
import { 
    doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Garanta que você tem o arquivo 'uploadService.js' no seu projeto
import { uploadFile } from "./uploadService.js";

document.addEventListener("DOMContentLoaded", () => {
    
    const elements = {
        h1Titulo: document.getElementById("main-title"),
        form: document.getElementById("form-perfil"),
        nomeNegocioInput: document.getElementById("nomeNegocio"),
        descricaoInput: document.getElementById("descricao"),
        logoInput: document.getElementById("logoNegocio"),
        logoPreview: document.getElementById("logo-preview"),
        btnUploadLogo: document.getElementById("btn-upload-logo"),
        btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
        containerLinkVitrine: document.getElementById("container-link-vitrine"),
        urlVitrineEl: document.getElementById('url-vitrine-display'),
        btnCopiarLink: document.getElementById('btn-copiar-link'),
        btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
        btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
        linkVitrineMenu: document.querySelector('.sidebar-links a[href="vitrine.html"]'),
        btnLogout: document.getElementById("btn-logout"),
        intervaloSelect: document.getElementById('intervalo-atendimento'),
        diasContainer: document.getElementById('dias-container'),
        listaProfissionaisPainel: document.getElementById("lista-profissionais-painel"),
        btnAddProfissional: document.getElementById("btn-add-profissional"),
        modalAddProfissional: document.getElementById('modal-add-profissional'),
        formAddProfissional: document.getElementById('form-add-profissional'),
        btnCancelarProfissional: document.getElementById('btn-cancelar-profissional')
    };

    const diasDaSemana = [ { id: "seg", nome: "Segunda-feira" }, { id: "ter", nome: "Terça-feira" }, { id: "qua", nome: "Quarta-feira" }, { id: "qui", nome: "Quinta-feira" }, { id: "sex", nome: "Sexta-feira" }, { id: "sab", nome: "Sábado" }, { id: "dom", nome: "Domingo" } ];

    let currentUser;
    let empresaId = null;
    let unsubProfissionais = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            verificarEcarregarDados(user.uid);
            adicionarListenersDeEvento();
            gerarEstruturaDosDias();
        } else {
            window.location.href = "login.html";
        }
    });

    async function verificarEcarregarDados(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        const secaoEquipe = elements.btnAddProfissional?.closest(".form-section");

        if (snapshot.empty) {
            if(elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
            if(elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = "none";
            if(secaoEquipe) secaoEquipe.style.display = "none";
            if(elements.linkVitrineMenu) elements.linkVitrineMenu.classList.add("disabled");
        } else {
            const empresaDoc = snapshot.docs[0];
            empresaId = empresaDoc.id; // ESSENCIAL: Armazena o ID da empresa existente
            const dadosEmpresa = empresaDoc.data();
            
            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            const profissionalSnap = await getDoc(profissionalRef);
            
            if(elements.h1Titulo) elements.h1Titulo.textContent = "Edite seu Perfil de Negócio";
            preencherFormulario(dadosEmpresa, profissionalSnap.exists() ? profissionalSnap.data() : {});

            const ehDono = profissionalSnap.exists() && profissionalSnap.data().ehDono === true;
            if (ehDono) {
                if(secaoEquipe) secaoEquipe.style.display = "block";
                iniciarListenerDeProfissionais(empresaId);
            } else {
                if(secaoEquipe) secaoEquipe.style.display = "none";
            }
        }
    }

    function iniciarListenerDeProfissionais(idDaEmpresa) {
        if (unsubProfissionais) unsubProfissionais();
        const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");
        unsubProfissionais = onSnapshot(profissionaisRef, (snapshot) => {
            const profissionais = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            renderizarListaProfissionais(profissionais);
        });
    }

    function renderizarListaProfissionais(profissionais) {
        if (!elements.listaProfissionaisPainel) return;
        elements.listaProfissionaisPainel.innerHTML = profissionais.length === 0
            ? `<p>Nenhum profissional na equipe ainda.</p>`
            : profissionais.map(p => `<div class="profissional-card">
                                          <img src="${p.fotoUrl || "https://placehold.co/40x40/eef2ff/4f46e5?text=P"}" alt="Foto de ${p.nome}">
                                          <span class="profissional-nome">${p.nome}</span>
                                      </div>`).join("");
    }
    
    function preencherFormulario(dadosEmpresa, dadosProfissional = {}) {
        elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || "";
        elements.descricaoInput.value = dadosEmpresa.descricao || "";
        if (dadosEmpresa.logoUrl) elements.logoPreview.src = dadosEmpresa.logoUrl;

        const horarios = dadosProfissional.horarios || {};
        elements.intervaloSelect.value = horarios.intervalo || "30";

        diasDaSemana.forEach(dia => {
            const diaData = horarios[dia.id];
            const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
            if (toggleAtivo) {
                toggleAtivo.checked = !!diaData?.ativo;
                const containerBlocos = document.getElementById(`blocos-${dia.id}`);
                if(containerBlocos) {
                    containerBlocos.innerHTML = "";
                    if (diaData?.ativo && diaData.blocos?.length > 0) {
                        diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
                    } else if (diaData?.ativo) {
                        adicionarBlocoDeHorario(dia.id);
                    }
                }
                toggleAtivo.dispatchEvent(new Event("change"));
            }
        });

        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        const linkDisplay = elements.urlVitrineEl || document.getElementById('url-vitrine-display');
        if(linkDisplay) linkDisplay.textContent = urlCompleta;
        if(elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        const btnAbrirInline = document.getElementById('btn-abrir-vitrine-inline');
        if(btnAbrirInline) btnAbrirInline.href = urlCompleta;
        if(elements.linkVitrineMenu) elements.linkVitrineMenu.href = urlCompleta;
        if(elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = "block";
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        elements.btnSalvar.disabled = true;
        elements.btnSalvar.textContent = "Salvando...";
        try {
            const uid = currentUser.uid;
            const nomeNegocio = elements.nomeNegocioInput.value.trim();
            if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

            const dadosEmpresa = {
                nomeFantasia: nomeNegocio,
                descricao: elements.descricaoInput.value.trim(),
                donoId: uid,
                logoUrl: elements.logoPreview.src
            };

            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const caminho = `logos/${uid}/${Date.now()}_${logoFile.name}`;
                dadosEmpresa.logoUrl = await uploadFile(logoFile, caminho);
            }

            const horariosColetados = coletarDadosDeHorarios();
            
            // =============================================================
            //  CORREÇÃO CRÍTICA: LÓGICA DE ATUALIZAR VS. CRIAR
            // =============================================================
            if (empresaId) {
                // SE empresaId já existe, ATUALIZA a empresa e o profissional dono.
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
                await setDoc(profissionalRef, { horarios: horariosColetados }, { merge: true });
                alert("Perfil atualizado com sucesso!");
            } else {
                // SE empresaId é nulo, CRIA uma nova empresa e o profissional dono.
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                empresaId = novaEmpresaRef.id; // Armazena o novo ID
                const dadosProfissionalNovo = {
                    nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "",
                    horarios: horariosColetados,
                    uid: uid,
                    servicos: [],
                    ehDono: true
                };
                await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissionalNovo);
                alert("Seu negócio foi cadastrado com sucesso!");
                window.location.reload();
            }
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Ocorreu um erro ao salvar: " + error.message);
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = "Salvar Todas as Configurações";
        }
    }
    
    function coletarDadosDeHorarios() {
        const horariosData = { intervalo: parseInt(elements.intervaloSelect.value, 10) };
        diasDaSemana.forEach(dia => {
            const estaAtivo = document.getElementById(`${dia.id}-ativo`).checked;
            const blocos = [];
            if (estaAtivo) {
                document.querySelectorAll(`#blocos-${dia.id} .bloco-horario`).forEach(blocoEl => {
                    const inputs = blocoEl.querySelectorAll("input[type=\"time\"]");
                    if (inputs[0].value && inputs[1].value) {
                        blocos.push({ inicio: inputs[0].value, fim: inputs[1].value });
                    }
                });
            }
            horariosData[dia.id] = { ativo: estaAtivo, blocos: blocos };
        });
        return horariosData;
    }

    function adicionarListenersDeEvento() {
        if(elements.form) elements.form.addEventListener("submit", handleFormSubmit);
        const btnCopiar = document.getElementById('btn-copiar-link');
        if (btnCopiar) btnCopiar.addEventListener("click", () => {
             const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
             navigator.clipboard.writeText(urlCompleta).then(() => alert("Link copiado!")).catch(() => alert("Falha ao copiar."));
        });
        if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener("click", () => elements.logoInput.click());
        if (elements.logoInput) elements.logoInput.addEventListener("change", () => {
            if (elements.logoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => { elements.logoPreview.src = e.target.result; };
                reader.readAsDataURL(elements.logoInput.files[0]);
            }
        });
        if (elements.btnLogout) elements.btnLogout.addEventListener("click", async () => {
            await signOut(auth);
            window.location.href = "login.html";
        });
        if(elements.btnAddProfissional) elements.btnAddProfissional.addEventListener("click", () => {
            if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'flex';
        });
        if(elements.btnCancelarProfissional) elements.btnCancelarProfissional.addEventListener("click", () => {
            if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
        });
        if(elements.formAddProfissional) elements.formAddProfissional.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = e.target.querySelector('button[type="submit"]');
            btnSubmit.disabled = true;
            try {
                const nome = document.getElementById('nome-profissional').value.trim();
                const fotoFile = document.getElementById('foto-profissional').files[0];
                if (!nome) throw new Error("O nome do profissional é obrigatório.");

                let fotoUrl = '';
                if(fotoFile){
                    const caminho = `fotos-profissionais/${empresaId}/${Date.now()}_${fotoFile.name}`;
                    fotoUrl = await uploadFile(fotoFile, caminho);
                }

                const novoProfissional = { nome, fotoUrl, servicos: [], horarios: {}, ehDono: false };
                await addDoc(collection(db, "empresarios", empresaId, "profissionais"), novoProfissional);
                alert("Profissional adicionado!");
                elements.formAddProfissional.reset();
                if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
            } catch (error) {
                alert(`Erro: ${error.message}`);
            } finally {
                btnSubmit.disabled = false;
            }
        });
    }

    function gerarEstruturaDosDias() {
        if (!elements.diasContainer) return;
        elements.diasContainer.innerHTML = "";
        diasDaSemana.forEach(dia => {
            const divDia = document.createElement("div");
            divDia.className = "dia-semana";
            divDia.innerHTML = `
                <div class="dia-info">
                    <span class="dia-nome">${dia.nome}</span>
                    <div class="toggle-container">
                        <label class="switch">
                            <input type="checkbox" id="${dia.id}-ativo" class="toggle-input">
                            <span class="slider"></span>
                        </label>
                        <span class="toggle-label">Fechado</span>
                    </div>
                </div>
                <div id="blocos-${dia.id}" class="horarios-blocos" style="display: none;"></div>
                <button type="button" class="btn-add-bloco" data-dia="${dia.id}" style="display: none;">+ Adicionar Horário</button>
            `;
            elements.diasContainer.appendChild(divDia);
            const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
            toggleAtivo.addEventListener("change", (e) => {
                const blocosContainer = document.getElementById(`blocos-${dia.id}`);
                const btnAddBloco = divDia.querySelector(`.btn-add-bloco`);
                const label = e.target.closest('.toggle-container').querySelector('.toggle-label');
                if (e.target.checked) {
                    blocosContainer.style.display = "block";
                    btnAddBloco.style.display = "inline-block";
                    label.textContent = 'Aberto';
                    if (blocosContainer.children.length === 0) adicionarBlocoDeHorario(dia.id);
                } else {
                    blocosContainer.style.display = "none";
                    btnAddBloco.style.display = "none";
                    label.textContent = 'Fechado';
                }
            });
            divDia.querySelector(`.btn-add-bloco`).addEventListener("click", () => adicionarBlocoDeHorario(dia.id));
        });
    }

    function adicionarBlocoDeHorario(diaId, inicio = "09:00", fim = "18:00") {
        const blocosContainer = document.getElementById(`blocos-${diaId}`);
        if (!blocosContainer) return;
        const blocoDiv = document.createElement("div");
        blocoDiv.className = "bloco-horario";
        blocoDiv.innerHTML = `
            <input type="time" value="${inicio}" required>
            <span>a</span>
            <input type="time" value="${fim}" required>
            <button type="button" class="btn-remove-bloco">Remover</button>
        `;
        blocoDiv.querySelector(".btn-remove-bloco").addEventListener("click", () => {
            if (blocosContainer.children.length > 1) {
                blocoDiv.remove();
            } else {
                alert("Para não atender neste dia, desative o botão.");
            }
        });
        blocosContainer.appendChild(blocoDiv);
    }
});
