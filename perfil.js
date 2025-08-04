/* perfil.js (COMPLETO, CORRIGIDO E COM LAYOUT ORIGINAL) */

// CORREÇÃO DEFINITIVA: Importa os serviços já prontos do firebase-config.js
import { db, auth, storage } from "./firebase-config.js";

// Imports necessários do SDK do Firebase (sempre bom mantê-los para clareza)
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Não há mais reinicialização aqui, usamos os serviços importados diretamente.

window.addEventListener("DOMContentLoaded", () => {
    // A partir daqui, o código pode confiar que 'db', 'auth' e 'storage' são válidos.
    const elements = {
        h1Titulo: document.getElementById("main-title"),
        form: document.getElementById("form-perfil"),
        nomeNegocioInput: document.getElementById("nomeNegocio"),
        descricaoInput: document.getElementById("descricao"),
        logoInput: document.getElementById("logoNegocio"),
        logoPreview: document.getElementById("logo-preview"),
        btnUploadLogo: document.getElementById("btn-upload-logo"),
        btnSalvar: document.querySelector("#form-perfil button[type=\"submit\"]"),
        btnCopiarLink: document.getElementById("btn-copiar-link"),
        containerLinkVitrine: document.getElementById("container-link-vitrine"),
        urlVitrineEl: document.getElementById("url-vitrine-display"),
        intervaloSelect: document.getElementById("intervalo-atendimento"),
        diasContainer: document.getElementById("dias-container"),
        btnAbrirVitrine: document.getElementById("btn-abrir-vitrine"),
        btnAbrirVitrineInline: document.getElementById("btn-abrir-vitrine-inline"),
        linkVitrineMenu: document.querySelector(".sidebar-links a[href=\"vitrine.html\"]"),
        btnLogout: document.getElementById("btn-logout"),
        // RESTAURADO: Funcionalidade de Equipe/Profissionais
        listaProfissionaisPainel: document.getElementById("lista-profissionais-painel"),
        btnAddProfissional: document.getElementById("btn-add-profissional"),
    };

    const diasDaSemana = [
        { id: "seg", nome: "Segunda-feira" }, { id: "ter", nome: "Terça-feira" },
        { id: "qua", nome: "Quarta-feira" }, { id: "qui", nome: "Quinta-feira" },
        { id: "sex", nome: "Sexta-feira" }, { id: "sab", nome: "Sábado" },
        { id: "dom", nome: "Domingo" }
    ];

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
            elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
            elements.containerLinkVitrine.style.display = "none";
            if(secaoEquipe) secaoEquipe.style.display = "none";
            elements.linkVitrineMenu.classList.add("disabled");
        } else {
            const empresaDoc = snapshot.docs[0];
            empresaId = empresaDoc.id;
            const dadosEmpresa = empresaDoc.data();
            
            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            const profissionalSnap = await getDoc(profissionalRef);
            let ehDono = profissionalSnap.exists() && profissionalSnap.data().ehDono === true;

            elements.h1Titulo.textContent = "Edite seu Perfil de Negócio";
            preencherFormulario(dadosEmpresa, profissionalSnap.data());

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
            const profissionais = snapshot.docs.map(doc => doc.data());
            renderizarListaProfissionais(profissionais);
        });
    }

    function renderizarListaProfissionais(profissionais) {
        if (!elements.listaProfissionaisPainel) return;
        elements.listaProfissionaisPainel.innerHTML = profissionais.length === 0
            ? `<p>Nenhum profissional na equipe ainda.</p>`
            : profissionais.map(p => `<div class="profissional-card" style="border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px; background-color: white; margin-bottom: 8px;">
                                           <img src="${p.fotoUrl || "https://placehold.co/40x40/eef2ff/4f46e5?text=P"}" alt="Foto de ${p.nome}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                                           <span class="profissional-nome" style="font-weight: 500;">${p.nome}</span>
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
                toggleAtivo.checked = diaData ? diaData.ativo : false;
                const containerBlocos = document.getElementById(`blocos-${dia.id}`);
                containerBlocos.innerHTML = "";
                if (diaData?.ativo && diaData.blocos?.length > 0) {
                    diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
                } else if (diaData?.ativo) {
                    adicionarBlocoDeHorario(dia.id);
                }
                toggleAtivo.dispatchEvent(new Event("change"));
            }
        });

        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        elements.urlVitrineEl.textContent = urlCompleta;
        elements.btnAbrirVitrine.href = urlCompleta;
        elements.btnAbrirVitrineInline.href = urlCompleta;
        elements.linkVitrineMenu.href = urlCompleta;
        elements.linkVitrineMenu.classList.remove("disabled");
        elements.containerLinkVitrine.style.display = "block";
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
                donoId: uid
            };
            const dadosProfissional = {
                nome: currentUser.displayName || nomeNegocio,
                fotoUrl: currentUser.photoURL || "",
                horarios: coletarDadosDeHorarios(),
                uid: uid
            };
            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const storageRef = ref(storage, `logos/${uid}/logo`);
                dadosEmpresa.logoUrl = await getDownloadURL(await uploadBytes(storageRef, logoFile));
            }
            if (empresaId) {
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional, { merge: true });
                alert("Perfil atualizado com sucesso!");
            } else {
                dadosProfissional.servicos = [];
                dadosProfissional.ehDono = true;
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                await setDoc(doc(db, "empresarios", novaEmpresaRef.id, "profissionais", uid), dadosProfissional);
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
        elements.form.addEventListener("submit", handleFormSubmit);
        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener("click", () => {
             const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
             navigator.clipboard.writeText(urlCompleta).then(() => alert("Link copiado!"), () => alert("Falha ao copiar."));
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
             window.location.href = "equipe.html"; // Exemplo de como navegar para a página de equipe
        });
    }

    // RESTAURADO: Lógica original para gerar os dias e horários, para não afetar seu layout.
    function gerarEstruturaDosDias() {
        if (!elements.diasContainer) return;
        elements.diasContainer.innerHTML = "";
        diasDaSemana.forEach(dia => {
            const divDia = document.createElement("div");
            divDia.className = "dia-semana";
            divDia.innerHTML = `
                <div class="toggle-switch-container">
                    <label class="toggle-switch">
                        <input type="checkbox" id="${dia.id}-ativo" class="toggle-input">
                        <span class="toggle-slider round"></span>
                    </label>
                    <label for="${dia.id}-ativo" class="toggle-label">${dia.nome}</label>
                </div>
                <div id="blocos-${dia.id}" class="horarios-blocos"></div>
                <button type="button" class="btn-add-bloco" data-dia="${dia.id}">Adicionar Bloco</button>
            `;
            elements.diasContainer.appendChild(divDia);
            const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
            toggleAtivo.addEventListener("change", (e) => {
                const blocosContainer = document.getElementById(`blocos-${dia.id}`);
                const btnAddBloco = divDia.querySelector(`.btn-add-bloco`);
                if (e.target.checked) {
                    blocosContainer.style.display = "block";
                    btnAddBloco.style.display = "inline-block";
                    if (blocosContainer.children.length === 0) {
                        adicionarBlocoDeHorario(dia.id);
                    }
                } else {
                    blocosContainer.style.display = "none";
                    btnAddBloco.style.display = "none";
                }
            });
            divDia.querySelector(`.btn-add-bloco`).addEventListener("click", (e) => {
                adicionarBlocoDeHorario(e.target.dataset.dia);
            });
        });
    }

    // RESTAURADO: Lógica original para adicionar blocos de horário.
    function adicionarBlocoDeHorario(diaId, inicio = "", fim = "") {
        const container = document.getElementById(`blocos-${diaId}`);
        if (!container) return;
        const blocoDiv = document.createElement("div");
        blocoDiv.className = "bloco-horario";
        blocoDiv.innerHTML = `
            <input type="time" value="${inicio}">
            <span>-</span>
            <input type="time" value="${fim}">
            <button type="button" class="btn-remover-bloco">Remover</button>
        `;
        container.appendChild(blocoDiv);
        blocoDiv.querySelector(`.btn-remover-bloco`).addEventListener("click", (e) => {
            e.target.closest(".bloco-horario").remove();
        });
    }
});
