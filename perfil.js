/* perfil.js (VERSÃO SIMPLIFICADA E CORRIGIDA) */
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

// --- CORREÇÃO PRINCIPAL ---
// Inicializa os serviços do Firebase no topo do script.
// Isso garante que 'db', 'auth' e 'storage' estejam sempre disponíveis para todas as funções.
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// O restante do código só roda quando o HTML estiver pronto.
window.addEventListener("DOMContentLoaded", () => {

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
        listaProfissionaisPainel: document.getElementById("lista-profissionais-painel"),
        btnAddProfissional: document.getElementById("btn-add-profissional"),
        modalAddProfissional: document.getElementById("modal-add-profissional"),
        formAddProfissional: document.getElementById("form-add-profissional"),
        btnCancelarProfissional: document.getElementById("btn-cancelar-profissional")
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

    // Ponto de entrada principal da aplicação
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            verificarEcarregarDados(user.uid);
            adicionarListenersDeEvento(); // Adiciona os listeners uma vez que o usuário está logado
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
            // Cenário: Novo usuário, precisa criar a empresa
            if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
            if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = "none";
            if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = "none";
            if (secaoEquipe) secaoEquipe.style.display = "none";
            if (elements.linkVitrineMenu) {
                elements.linkVitrineMenu.classList.add("disabled");
                elements.linkVitrineMenu.href = "#";
            }
        } else {
            // Cenário: Usuário existente, carrega dados da empresa
            const empresaDoc = snapshot.docs[0];
            empresaId = empresaDoc.id;
            const dadosEmpresa = empresaDoc.data();

            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            const profissionalSnap = await getDoc(profissionalRef);
            
            if (elements.h1Titulo) elements.h1Titulo.textContent = "Edite seu Perfil de Negócio";
            preencherFormulario(dadosEmpresa, profissionalSnap.data());

            if (profissionalSnap.exists() && profissionalSnap.data().ehDono === true) {
                if (secaoEquipe) secaoEquipe.style.display = "block";
                // A chamada do listener está aqui, e agora `db` está garantido de existir
                iniciarListenerDeProfissionais(empresaId);
            } else {
                if (secaoEquipe) secaoEquipe.style.display = "none";
            }
        }
    }

    function iniciarListenerDeProfissionais(idDaEmpresa) {
        if (unsubProfissionais) unsubProfissionais();
        
        const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");
        unsubProfissionais = onSnapshot(profissionaisRef, (snapshot) => {
            const profissionais = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarListaProfissionais(profissionais);
        });
    }

    function renderizarListaProfissionais(profissionais) {
        if (!elements.listaProfissionaisPainel) return;
        elements.listaProfissionaisPainel.innerHTML = profissionais.length === 0 
            ? `<p>Nenhum profissional na equipe ainda.</p>`
            : profissionais.map(p => `
                <div class="profissional-card">
                    <img src="${p.fotoUrl || 'https://placehold.co/40x40'}" alt="Foto de ${p.nome}">
                    <span>${p.nome}</span>
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
                }
                toggleAtivo.dispatchEvent(new Event("change"));
            }
        });

        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        elements.urlVitrineEl.textContent = urlCompleta;
        elements.btnAbrirVitrine.href = urlCompleta;
        elements.btnAbrirVitrine.style.display = "inline-flex";
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
                // ATUALIZAR empresa
                const empresaRef = doc(db, "empresarios", empresaId);
                await setDoc(empresaRef, dadosEmpresa, { merge: true });

                const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
                await setDoc(profissionalRef, dadosProfissional, { merge: true });
                alert("Perfil atualizado com sucesso!");
            } else {
                // CRIAR empresa
                dadosProfissional.servicos = [];
                dadosProfissional.ehDono = true;

                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                await setDoc(doc(db, "empresarios", novaEmpresaRef.id, "profissionais", uid), dadosProfissional);
                
                alert("Seu negócio foi cadastrado com sucesso!");
                // VOLTAMOS AO RELOAD PELA ESTABILIDADE.
                // Após o cadastro, a página recarrega e já carrega os dados corretamente.
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
        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener("click", copiarLink);
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
        // Listeners para o modal de adicionar profissional (se existirem)
        if (elements.btnAddProfissional) {
            elements.btnAddProfissional.addEventListener("click", () => {
                if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = "flex";
            });
        }
        if (elements.btnCancelarProfissional) {
            elements.btnCancelarProfissional.addEventListener("click", () => {
                if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = "none";
            });
        }
    }

    function copiarLink() {
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        navigator.clipboard.writeText(urlCompleta).then(() => alert("Link da vitrine copiado!"), () => alert("Falha ao copiar o link."));
    }

    function gerarEstruturaDosDias() {
        if (!elements.diasContainer) return;
        elements.diasContainer.innerHTML = diasDaSemana.map(dia => `
            <div class="dia-semana">
                <div class="toggle-switch-container">
                    <label class="toggle-switch">
                        <input type="checkbox" id="${dia.id}-ativo" class="toggle-input">
                        <span class="toggle-slider round"></span>
                    </label>
                    <label for="${dia.id}-ativo" class="toggle-label">${dia.nome}</label>
                </div>
                <div id="blocos-${dia.id}" class="horarios-blocos" style="display: none;"></div>
                <button type="button" class="btn-add-bloco" data-dia="${dia.id}" style="display: none;">Adicionar Bloco</button>
            </div>`).join('');
        
        diasDaSemana.forEach(dia => {
            const toggle = document.getElementById(`${dia.id}-ativo`);
            const blocosContainer = document.getElementById(`blocos-${dia.id}`);
            const btnAddBloco = document.querySelector(`.btn-add-bloco[data-dia="${dia.id}"]`);
            
            toggle.addEventListener("change", (e) => {
                const mostrar = e.target.checked;
                blocosContainer.style.display = mostrar ? "block" : "none";
                btnAddBloco.style.display = mostrar ? "inline-block" : "none";
                if (mostrar && blocosContainer.children.length === 0) {
                    adicionarBlocoDeHorario(dia.id);
                }
            });
            btnAddBloco.addEventListener("click", () => adicionarBlocoDeHorario(dia.id));
        });
    }

    function adicionarBlocoDeHorario(diaId, inicio = "", fim = "") {
        const container = document.getElementById(`blocos-${diaId}`);
        const blocoDiv = document.createElement("div");
        blocoDiv.className = "bloco-horario";
        blocoDiv.innerHTML = `
            <input type="time" value="${inicio}">
            <span>-</span>
            <input type="time" value="${fim}">
            <button type="button" class="btn-remover-bloco">Remover</button>`;
        blocoDiv.querySelector('.btn-remover-bloco').addEventListener('click', () => blocoDiv.remove());
        container.appendChild(blocoDiv);
    }
});
