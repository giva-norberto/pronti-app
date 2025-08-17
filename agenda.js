/**
 * agenda.js REVISADO
 * - Agenda Futura: mostra agendamentos ativos de hoje em diante.
 * - Histórico: mostra todos agendamentos (qualquer status) em um período customizado (por padrão, mês atual).
 * - Botões alternam a visão e mostram/escondem filtros de data.
 * - Filtro de profissional para dono.
 * - Firebase Modular v10+
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, doc, where, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const inputDataEl = document.getElementById("data-agenda");
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

const btnAgendaFutura = document.getElementById("btn-agenda-futura");
const btnHistorico = document.getElementById("btn-historico");
const filtrosHistoricoDiv = document.getElementById("filtros-historico");
const dataInicialEl = document.getElementById("data-inicial");
const dataFinalEl = document.getElementById("data-final");
const btnAplicarHistorico = document.getElementById("btn-aplicar-historico");
const btnMesAtual = document.getElementById("btn-mes-atual");

let empresaId = null;
let perfilUsuario = "dono"; // "dono" ou "funcionario"
let meuUid = null;
let modoAgenda = "futura"; // "futura" ou "historico"

// Utils
function mostrarToast(texto, cor = '#38bdf8') {
  if (typeof Toastify !== "undefined") {
    Toastify({
      text: texto,
      duration: 4000,
      gravity: "top",
      position: "center",
      style: { background: cor, color: "white", borderRadius: "8px" }
    }).showToast();
  } else {
    alert(texto);
  }
}

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

// ----------- AUTENTICAÇÃO E PERFIL -----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    meuUid = user.uid;
    try {
      empresaId = await getEmpresaIdDoDonoOuFuncionario(user.uid);
      if (empresaId) {
        perfilUsuario = await checarTipoUsuario(user.uid, empresaId);
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

async function getEmpresaIdDoDonoOuFuncionario(uid) {
  // Dono
  let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
  let snapshot = await getDocs(q);
  if (!snapshot.empty) return snapshot.docs[0].id;
  // Funcionário
  q = query(collection(db, "empresarios"));
  snapshot = await getDocs(q);
  for (const docEmp of snapshot.docs) {
    const profSnap = await getDocs(
      query(collection(db, "empresarios", docEmp.id, "profissionais"), where("__name__", "==", uid))
    );
    if (!profSnap.empty) return docEmp.id;
  }
  return null;
}

async function checarTipoUsuario(uid, empresaId) {
  const docEmp = await getDocs(
    query(collection(db, "empresarios"), where("donoId", "==", uid), where("__name__", "==", empresaId))
  );
  if (!docEmp.empty) return "dono";
  return "funcionario";
}

// ----------- INICIALIZAÇÃO E LISTENERS -----------
async function inicializarPaginaAgenda() {
  // Filtro profissional só para dono
  if (perfilUsuario === "dono") {
    await popularFiltroProfissionais();
    if (filtroProfissionalEl) filtroProfissionalEl.style.display = "";
    const filtroProfItem = document.getElementById("filtro-profissional-item");
    if (filtroProfItem) filtroProfItem.style.display = "";
  } else {
    if (filtroProfissionalEl) filtroProfissionalEl.style.display = "none";
    const filtroProfItem = document.getElementById("filtro-profissional-item");
    if (filtroProfItem) filtroProfItem.style.display = "none";
  }

  // Botões agenda futura e histórico
  if (btnAgendaFutura) btnAgendaFutura.addEventListener("click", () => ativarModoAgenda("futura"));
  if (btnHistorico) btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));

  // Listeners filtros
  if (filtroProfissionalEl) filtroProfissionalEl.addEventListener("change", carregarAgendamentos);
  if (inputDataEl) inputDataEl.addEventListener("change", carregarAgendamentos);
  if (btnAplicarHistorico) btnAplicarHistorico.addEventListener("click", carregarAgendamentos);
  if (btnMesAtual) btnMesAtual.addEventListener("click", () => {
    preencherCamposMesAtual();
    carregarAgendamentos();
  });

  configurarListenersDeAcao();

  // Inicializa visão padrão
  ativarModoAgenda("futura");
}

// ----------- MODO AGENDA (FUTURA/HISTÓRICO) -----------
function ativarModoAgenda(modo) {
  modoAgenda = modo;
  // Visual do botão
  if (btnAgendaFutura) btnAgendaFutura.classList.toggle("active", modo === "futura");
  if (btnHistorico) btnHistorico.classList.toggle("active", modo === "historico");
  // Filtros
  if (filtrosHistoricoDiv) filtrosHistoricoDiv.style.display = (modo === "historico") ? "" : "none";
  if (inputDataEl) inputDataEl.style.display = (modo === "futura") ? "" : "none";
  carregarAgendamentos();
  if (modo === "historico") preencherCamposMesAtual();
}

// ----------- FILTRO PROFISSIONAL -----------
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

// ----------- AGENDAMENTOS -----------
async function carregarAgendamentos() {
  if (!listaAgendamentosDiv) return;
  listaAgendamentosDiv.innerHTML = `<p>A carregar agendamentos...</p>`;

  let profissionalId = "todos";
  if (perfilUsuario === "dono") {
    profissionalId = filtroProfissionalEl ? filtroProfissionalEl.value : 'todos';
  } else {
    profissionalId = meuUid;
  }

  try {
    const ref = collection(db, "empresarios", empresaId, "agendamentos");
    let q, snapshot;
    const constraints = [];

    if (modoAgenda === "futura") {
      // Agenda Futura: ativos a partir de hoje
      const hoje = new Date();
      const dataHoje = hoje.toISOString().split("T")[0];
      constraints.push(where("data", ">=", dataHoje), where("status", "==", "ativo"));
    } else {
      // Histórico: entre data inicial e final, todos status
      const dataIni = dataInicialEl ? dataInicialEl.value : "";
      const dataFim = dataFinalEl ? dataFinalEl.value : "";
      if (!dataIni || !dataFim) {
        listaAgendamentosDiv.innerHTML = `<p>Selecione o período do histórico.</p>`;
        return;
      }
      constraints.push(where("data", ">=", dataIni), where("data", "<=", dataFim));
      // Não filtra status
    }
    if (profissionalId !== 'todos') {
      constraints.push(where("profissionalId", "==", profissionalId));
    }
    q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
    snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    agendamentos.forEach(ag => {
      const cardElement = document.createElement('div');
      cardElement.className = 'card card--agenda';
      cardElement.setAttribute('data-id', ag.id);

      // Cor/status label
      let statusLabel = "<span class='status-label status-ativo'>Ativo</span>";
      if (ag.status === "cancelado_pelo_gestor" || ag.status === "cancelado") statusLabel = "<span class='status-label status-cancelado'>Cancelado</span>";
      else if (ag.status === "nao_compareceu") statusLabel = "<span class='status-label status-falta'>Falta</span>";
      else if (ag.status === "realizado") statusLabel = "<span class='status-label status-realizado'>Realizado</span>";

      cardElement.innerHTML = `
        <div class="card-title">${ag.servicoNome || 'Serviço não informado'}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-user"></i> <strong>Cliente:</strong> ${ag.clienteNome || "Não informado"}</p>
          <p><i class="fa-solid fa-user-tie"></i> <strong>Profissional:</strong> ${ag.profissionalNome || "Não informado"}</p>
          <p><i class="fa-solid fa-clock"></i> <strong>Hora:</strong> ${ag.horario || "Não informada"}</p>
          <p><i class="fa-solid fa-info-circle"></i> <strong>Status:</strong> ${statusLabel}</p>
        </div>
        ${(
          perfilUsuario === "dono" || (ag.profissionalId === meuUid)
        ) && ag.status === "ativo" && modoAgenda === "futura"
          ? `<div class="card-actions">
              <button class="btn btn-nao-compareceu" data-id="${ag.id}"><i class="fa-solid fa-user-clock"></i> Não Compareceu</button>
              <button class="btn btn-cancelar" data-id="${ag.id}"><i class="fa-solid fa-ban"></i> Cancelar</button>
            </div>` : ""
        }
      `;
      listaAgendamentosDiv.appendChild(cardElement);
    });
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    exibirMensagemDeErro("Ocorreu um erro ao carregar a agenda.");
  }
}

// ----------- HISTÓRICO: CAMPOS DATA -----------
function preencherCamposMesAtual() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  if (dataInicialEl) dataInicialEl.value = primeiroDia.toISOString().split('T')[0];
  if (dataFinalEl) dataFinalEl.value = ultimoDia.toISOString().split('T')[0];
}

// ----------- AÇÕES (CANCELAR, NÃO COMPARECEU) -----------
async function atualizarStatusAgendamento(id, status, mensagemConfirmacao, mensagemSucesso, corToast) {
  const confirmado = await mostrarConfirmacao(mensagemConfirmacao);
  if (!confirmado) return;

  try {
    await updateDoc(doc(db, "empresarios", empresaId, "agendamentos", id), { status });
    mostrarToast(mensagemSucesso, corToast);
    carregarAgendamentos();
  } catch (error) {
    console.error(`Erro ao atualizar status para ${status}:`, error);
    mostrarToast(`Erro ao atualizar agendamento.`, "#ef4444");
  }
}

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

// ----------- ERRO -----------
function exibirMensagemDeErro(mensagem) {
  if (listaAgendamentosDiv) {
    listaAgendamentosDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
  }
}
