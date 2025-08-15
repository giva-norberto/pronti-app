/**
 * agenda.js
 * Gerencia a exibição e manipulação de agendamentos para o empresário logado.
 * Inclui filtros por data e profissional, e ações de status.
 * Utiliza a estrutura de subcoleção: 'empresarios/{empresaId}/agendamentos'.
 * Firebase Modular v10+
 */

// Importações dos módulos Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, doc, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Elementos do DOM ---
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const inputDataEl = document.getElementById("data-agenda");
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

let empresaId = null;

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Exibe uma notificação toast na tela.
 * @param {string} texto - A mensagem a ser exibida.
 * @param {string} cor - A cor de fundo do toast.
 */
function mostrarToast(texto, cor = '#38bdf8') {
  if (typeof Toastify !== "undefined") {
    Toastify({
      text: texto,
      duration: 4000,
      gravity: "top",
      position: "center", // <-- ALTERAÇÃO AQUI
      style: { 
        background: cor, 
        color: "white",
        borderRadius: "8px" // Sugestão: adicione cantos arredondados
      }
    }).showToast();
  } else {
    alert(texto);
  }
}

/**
 * Exibe um modal de confirmação personalizado.
 * @param {string} mensagem - A pergunta de confirmação.
 * @returns {Promise<boolean>} - Resolve como true (confirmado) ou false (cancelado).
 */
function mostrarConfirmacao(mensagem) {
  if (!modal || !modalMensagem || !btnModalConfirmar || !btnModalCancelar) {
      return Promise.resolve(window.confirm(mensagem));
  }
  modalMensagem.textContent = mensagem;
  modal.classList.add("show");
  return new Promise((resolve) => {
    const fecharModal = (resultado) => {
      modal.classList.remove("show");
      btnModalConfirmar.onclick = null;
      btnModalCancelar.onclick = null;
      resolve(resultado);
    };
    btnModalConfirmar.onclick = () => fecharModal(true);
    btnModalCancelar.onclick = () => fecharModal(false);
  });
}

// --- LÓGICA PRINCIPAL DA PÁGINA ---

/**
 * Ponto de entrada: verifica a autenticação do usuário e inicia a página.
 */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      empresaId = await getEmpresaIdDoDono(user.uid);
      if (empresaId) {
        await inicializarPaginaAgenda();
      } else {
        exibirMensagemDeErro("Empresa não encontrada para este usuário.");
      }
    } catch (error) {
      console.error("Erro na inicialização:", error);
      exibirMensagemDeErro("Ocorreu um erro ao iniciar a página.");
    }
  } else {
    window.location.href = "login.html";
  }
});

/**
 * Busca o ID do documento da empresa com base no UID do dono.
 * @param {string} uid - O ID do usuário (dono).
 * @returns {Promise<string|null>} O ID do documento da empresa ou null.
 */
async function getEmpresaIdDoDono(uid) {
  const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].id;
}

/**
 * Configura os listeners de eventos e carrega os dados iniciais.
 */
async function inicializarPaginaAgenda() {
    if(inputDataEl) {
        inputDataEl.value = new Date().toISOString().split("T")[0];
    }
    await popularFiltroProfissionais();
    configurarListenersDeAcao();
    await carregarAgendamentos();
    if(inputDataEl) inputDataEl.addEventListener("change", carregarAgendamentos);
    if(filtroProfissionalEl) filtroProfissionalEl.addEventListener("change", carregarAgendamentos);
}

/**
 * Busca profissionais no Firestore e popula o <select> de filtro.
 */
async function popularFiltroProfissionais() {
    if (!filtroProfissionalEl) return;
    try {
        const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        snapshot.forEach(doc => {
            filtroProfissionalEl.appendChild(new Option(doc.data().nome, doc.id));
        });
    } catch (error) {
        console.error("Erro ao buscar profissionais:", error);
    }
}

/**
 * Carrega os agendamentos do Firestore e os renderiza na tela, com base nos filtros.
 */
async function carregarAgendamentos() {
  if (!listaAgendamentosDiv) return;
  
  const dataSelecionada = inputDataEl ? inputDataEl.value : new Date().toISOString().split("T")[0];
  const profissionalId = filtroProfissionalEl ? filtroProfissionalEl.value : 'todos';
  listaAgendamentosDiv.innerHTML = `<p>A carregar agendamentos...</p>`;
  
  try {
    const ref = collection(db, "empresarios", empresaId, "agendamentos");
    const constraints = [where("data", "==", dataSelecionada), where("status", "==", "ativo")];
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    const q = query(ref, ...constraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const dataFormatada = new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString('pt-BR');
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para ${dataFormatada}.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    agendamentos.sort((a, b) => (a.horario || "00:00").localeCompare(b.horario || "00:00"));

    agendamentos.forEach(ag => {
      const cardElement = document.createElement('div');
      // Adiciona a classe 'card--agenda' para o estilo colorido
      cardElement.className = 'card card--agenda';
      cardElement.setAttribute('data-id', ag.id);
      
      cardElement.innerHTML = `
        <div class="card-title">${ag.servicoNome || 'Serviço não informado'}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-user"></i> <strong>Cliente:</strong> ${ag.clienteNome || "Não informado"}</p>
          <p><i class="fa-solid fa-user-tie"></i> <strong>Profissional:</strong> ${ag.profissionalNome || "Não informado"}</p>
          <p><i class="fa-solid fa-clock"></i> <strong>Hora:</strong> ${ag.horario || "Não informada"}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-nao-compareceu" data-id="${ag.id}"><i class="fa-solid fa-user-clock"></i> Não Compareceu</button>
          <button class="btn btn-cancelar" data-id="${ag.id}"><i class="fa-solid fa-ban"></i> Cancelar</button>
        </div>
      `;
      listaAgendamentosDiv.appendChild(cardElement);
    });
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    exibirMensagemDeErro("Ocorreu um erro ao carregar a agenda.");
  }
}

/**
 * Função genérica para atualizar o status de um agendamento.
 * @param {string} id - O ID do agendamento.
 * @param {string} status - O novo status ('cancelado_pelo_gestor' ou 'nao_compareceu').
 * @param {string} mensagemConfirmacao - A mensagem para o modal.
 * @param {string} mensagemSucesso - A mensagem para o toast de sucesso.
 * @param {string} corToast - A cor para o toast de sucesso.
 */
async function atualizarStatusAgendamento(id, status, mensagemConfirmacao, mensagemSucesso, corToast) {
    const confirmado = await mostrarConfirmacao(mensagemConfirmacao);
    if (!confirmado) return;

    try {
        await updateDoc(doc(db, "empresarios", empresaId, "agendamentos", id), { status });
        mostrarToast(mensagemSucesso, corToast);
        carregarAgendamentos(); // Recarrega a lista para refletir a mudança
    } catch(error) {
        console.error(`Erro ao atualizar status para ${status}:`, error);
        mostrarToast(`Erro ao atualizar agendamento.`, "#ef4444");
    }
}

/**
 * Configura um único listener de eventos na lista para lidar com cliques de ação.
 */
function configurarListenersDeAcao() {
  if (!listaAgendamentosDiv) return;
  listaAgendamentosDiv.addEventListener("click", async (event) => {
    const target = event.target;
    const btnCancelar = target.closest(".btn-cancelar");
    const btnNaoCompareceu = target.closest(".btn-nao-compareceu");

    if (btnCancelar) {
      await atualizarStatusAgendamento(
        btnCancelar.dataset.id, 
        'cancelado_pelo_gestor', 
        'Tem a certeza de que deseja CANCELAR este agendamento?',
        'Agendamento cancelado.', 
        '#f59e42'
      );
    }
    if (btnNaoCompareceu) {
      await atualizarStatusAgendamento(
        btnNaoCompareceu.dataset.id, 
        'nao_compareceu', 
        'Marcar FALTA para este agendamento? A ação não pode ser desfeita.',
        'Falta marcada para o agendamento.', 
        '#6b7280'
      );
    }
  });
}

/**
 * Exibe uma mensagem de erro central na área de conteúdo.
 * @param {string} mensagem 
 */
function exibirMensagemDeErro(mensagem) {
    if (listaAgendamentosDiv) {
        listaAgendamentosDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
    }
}
