/**
 * agenda.js
 * Gerencia a exibição e manipulação de agendamentos para o empresário logado.
 * Inclui filtros por data e profissional, e ações de status.
 * Utiliza a estrutura de subcoleção: 'empresarios/{empresaId}/agendamentos'.
 * Firebase Modular v10+
 */

// Importações dos módulos Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Elementos do DOM ---
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const placeholder = document.getElementById("agendamentos-placeholder");
const inputDataEl = document.getElementById("data-agenda"); // Assumindo que você tem um <input type="date" id="data-agenda"> no seu HTML
const filtroProfissionalEl = document.getElementById("filtro-profissional"); // Assumindo que você tem um <select id="filtro-profissional">

const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

let empresaId = null; // Armazena o ID da empresa do usuário logado

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
      position: "right",
      style: { background: cor, color: "white" }
    }).showToast();
  } else {
    alert(texto);
  }
}

/**
 * Exibe um modal de confirmação.
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
      document.removeEventListener("keydown", handleEsc);
      resolve(resultado);
    };

    const handleConfirm = () => fecharModal(true);
    const handleCancel = () => fecharModal(false);
    
    const handleEsc = (e) => {
      if (e.key === "Escape") handleCancel();
    };

    btnModalConfirmar.onclick = handleConfirm;
    btnModalCancelar.onclick = handleCancel;
    document.addEventListener("keydown", handleEsc);
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
        exibirMensagemDeErro("Não foi possível encontrar uma empresa associada a este usuário.");
      }
    } catch (error) {
      console.error("Erro ao verificar empresa:", error);
      exibirMensagemDeErro("Ocorreu um erro ao verificar os dados da sua empresa.");
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
  if (snapshot.empty) {
    console.warn("Nenhum documento de empresário encontrado para o UID:", uid);
    return null;
  }
  return snapshot.docs[0].id;
}

/**
 * Configura os listeners de eventos e carrega os dados iniciais.
 */
async function inicializarPaginaAgenda() {
    // Define a data de hoje no input de data
    if(inputDataEl) {
        inputDataEl.value = new Date().toISOString().split("T")[0];
    }
    
    await popularFiltroProfissionais();
    configurarListenersDeAcao();
    await carregarAgendamentos(); // Carrega a agenda do dia atual

    // Adiciona listeners para os filtros mudarem o conteúdo
    if(inputDataEl) inputDataEl.addEventListener("change", carregarAgendamentos);
    if(filtroProfissionalEl) filtroProfissionalEl.addEventListener("change", carregarAgendamentos);
}

/**
 * Busca profissionais no Firestore e popula o <select> de filtro.
 */
async function popularFiltroProfissionais() {
    if (!filtroProfissionalEl) return;
    try {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const snapshot = await getDocs(profissionaisRef);
        
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        snapshot.forEach(doc => {
            const profissional = doc.data();
            const option = new Option(profissional.nome, doc.id);
            filtroProfissionalEl.appendChild(option);
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
    const agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");
    
    // Constrói a query com base nos filtros
    let q;
    if (profissionalId === 'todos') {
        q = query(agendamentosRef, where("data", "==", dataSelecionada), where("status", "==", "ativo"));
    } else {
        q = query(agendamentosRef, where("data", "==", dataSelecionada), where("profissionalId", "==", profissionalId), where("status", "==", "ativo"));
    }
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const dataFormatada = new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString('pt-BR');
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para ${dataFormatada}.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = ''; // Limpa a lista
    const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Ordena por horário
    agendamentos.sort((a, b) => (a.horario || "00:00").localeCompare(b.horario || "00:00"));

    agendamentos.forEach(agendamento => {
      const agendamentoId = agendamento.id;

      const cardElement = document.createElement('div');
      cardElement.className = 'card';
      cardElement.setAttribute('data-id', agendamentoId);
      
      cardElement.innerHTML = `
        <div class="card-title">${agendamento.servicoNome || 'Serviço não informado'}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-user"></i> <strong>Cliente:</strong> ${agendamento.clienteNome || "Não informado"}</p>
          <p><i class="fa-solid fa-user-tie"></i> <strong>Profissional:</strong> ${agendamento.profissionalNome || "Não informado"}</p>
          <p><i class="fa-solid fa-clock"></i> <strong>Hora:</strong> ${agendamento.horario || "Não informada"}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-nao-compareceu" data-id="${agendamentoId}"><i class="fa-solid fa-user-clock"></i> Não Compareceu</button>
          <button class="btn btn-cancelar" data-id="${agendamentoId}"><i class="fa-solid fa-ban"></i> Cancelar</button>
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
 * Atualiza o status de um agendamento para 'cancelado_pelo_gestor'.
 * @param {string} id - O ID do agendamento a ser cancelado.
 */
async function cancelarAgendamento(id) {
    const confirmado = await mostrarConfirmacao("Tem a certeza de que deseja CANCELAR este agendamento?");
    if (!confirmado) return;

    try {
        const agRef = doc(db, "empresarios", empresaId, "agendamentos", id);
        await updateDoc(agRef, { status: "cancelado_pelo_gestor" });
        mostrarToast("Agendamento cancelado.", "#f59e42");
        carregarAgendamentos(); // Recarrega a lista para remover o card
    } catch(error) {
        console.error("Erro ao cancelar agendamento:", error);
        mostrarToast("Erro ao cancelar o agendamento.", "#ef4444");
    }
}

/**
 * Atualiza o status de um agendamento para 'nao_compareceu'.
 * @param {string} id - O ID do agendamento.
 */
async function marcarNaoCompareceu(id) {
    const confirmado = await mostrarConfirmacao("Marcar FALTA para este agendamento? A ação não pode ser desfeita.");
    if (!confirmado) return;

    try {
        const agRef = doc(db, "empresarios", empresaId, "agendamentos", id);
        await updateDoc(agRef, { status: "nao_compareceu" });
        mostrarToast("Falta marcada para o agendamento.", "#ef4444");
        carregarAgendamentos(); // Recarrega a lista para remover o card
    } catch(error) {
        console.error("Erro ao marcar falta:", error);
        mostrarToast("Erro ao marcar falta.", "#ef4444");
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
      const agendamentoId = btnCancelar.dataset.id;
      if (agendamentoId) await cancelarAgendamento(agendamentoId);
    }
    
    if (btnNaoCompareceu) {
      const agendamentoId = btnNaoCompareceu.dataset.id;
      if (agendamentoId) await marcarNaoCompareceu(agendamentoId);
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
