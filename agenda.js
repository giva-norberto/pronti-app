/**
 * agenda.js - Revisado (Pronti)
 * - Exibe agenda da semana (exibe data e hora em cada card)
 * - Botões de modo alinhados e visuais conforme padrão Pronti
 * - Campo de semana sempre mostra segunda desta semana por padrão
 * - Histórico funciona normalmente
 * - Filtros de profissional só para dono
 * - Mensagens de erro amigáveis
 * - Compatível com Firebase Modular v10+
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
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

const btnAgendaSemana = document.getElementById("btn-agenda-semana");
const btnHistorico = document.getElementById("btn-historico");
const filtrosHistoricoDiv = document.getElementById("filtros-historico");
const dataInicialEl = document.getElementById("data-inicial");
const dataFinalEl = document.getElementById("data-final");
const btnAplicarHistorico = document.getElementById("btn-aplicar-historico");
const btnMesAtual = document.getElementById("btn-mes-atual");
const filtroSemanaDiv = document.getElementById("filtro-semana");
const inputSemana = document.getElementById("data-semana");
const semanaInicioEl = document.getElementById("semana-inicio");
const semanaFimEl = document.getElementById("semana-fim");
const btnSemanaProxima = document.getElementById('btn-semana-proxima');

let empresaId = null;
let perfilUsuario = "dono";
let meuUid = null;
let modoAgenda = "semana"; // "semana" ou "historico"

// Utilitários
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
      exibirMensagemDeErro("Ocorreu um erro ao iniciar a página.");
      console.error("Erro na inicialização:", error);
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

  // Sempre mostra o campo de semana (segunda da semana atual por padrão)
  if (inputSemana && !inputSemana.value) {
    const hoje = new Date();
    const day = hoje.getDay() || 7;
    hoje.setDate(hoje.getDate() - day + 1);
    inputSemana.value = hoje.toISOString().split('T')[0];
  }
  atualizarLegendaSemana();

  ativarModoAgenda("semana");

  // Listeners padrão
  if (btnAgendaSemana) btnAgendaSemana.addEventListener("click", () => ativarModoAgenda("semana"));
  if (btnHistorico) btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));
  if (filtroProfissionalEl) filtroProfissionalEl.addEventListener("change", carregarAgendamentos);
  if (inputSemana) inputSemana.addEventListener("change", () => {
    atualizarLegendaSemana();
    carregarAgendamentos();
  });
  if (btnAplicarHistorico) btnAplicarHistorico.addEventListener("click", carregarAgendamentos);
  if (btnMesAtual) btnMesAtual.addEventListener("click", () => {
    preencherCamposMesAtual();
    carregarAgendamentos();
  });

  // Seta só para próxima semana
  if (btnSemanaProxima) btnSemanaProxima.addEventListener("click", () => mudarSemana(1));

  configurarListenersDeAcao();
}

// ----------- MODO AGENDA (SEMANA/HISTÓRICO) -----------
function ativarModoAgenda(modo) {
  modoAgenda = modo;
  if (btnAgendaSemana) btnAgendaSemana.classList.toggle("active", modo === "semana");
  if (btnHistorico) btnHistorico.classList.toggle("active", modo === "historico");
  if (filtrosHistoricoDiv) filtrosHistoricoDiv.style.display = (modo === "historico") ? "" : "none";
  if (filtroSemanaDiv) filtroSemanaDiv.style.display = (modo === "semana") ? "" : "none";
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
    mostrarToast("Erro ao buscar profissionais.", "#ef4444");
    console.error("Erro ao buscar profissionais:", error);
  }
}

// ----------- AGENDA DA SEMANA -----------
function getWeekRange(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
  return { monday, sunday, inicio: fmt(monday), fim: fmt(sunday), inicioISO: monday.toISOString().split('T')[0], fimISO: sunday.toISOString().split('T')[0] };
}
function atualizarLegendaSemana() {
  if (inputSemana && inputSemana.value) {
    const { inicio, fim } = getWeekRange(inputSemana.value);
    if (semanaInicioEl) semanaInicioEl.textContent = inicio;
    if (semanaFimEl) semanaFimEl.textContent = fim;
  } else {
    if (semanaInicioEl) semanaInicioEl.textContent = '';
    if (semanaFimEl) semanaFimEl.textContent = '';
  }
}
function mudarSemana(delta) {
  if (!inputSemana.value) return;
  const dataAtual = new Date(inputSemana.value);
  dataAtual.setDate(dataAtual.getDate() + (delta * 7));
  inputSemana.value = dataAtual.toISOString().split('T')[0];
  atualizarLegendaSemana();
  carregarAgendamentos();
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

    if (modoAgenda === "semana") {
      // Agenda da Semana: pega todos os agendamentos de segunda a domingo
      const { inicioISO, fimISO } = getWeekRange(inputSemana.value);
      constraints.push(where("data", ">=", inicioISO), where("data", "<=", fimISO));
      if (profissionalId !== 'todos') constraints.push(where("profissionalId", "==", profissionalId));
      q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
    } else {
      // Histórico: entre data inicial/final, todos status
      const dataIni = dataInicialEl ? dataInicialEl.value : "";
      const dataFim = dataFinalEl ? dataFinalEl.value : "";
      if (!dataIni || !dataFim) {
        listaAgendamentosDiv.innerHTML = `<p>Selecione o período do histórico.</p>`;
        return;
      }
      constraints.push(where("data", ">=", dataIni), where("data", "<=", dataFim));
      if (profissionalId !== 'todos') constraints.push(where("profissionalId", "==", profissionalId));
      q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
    }
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

      // Data formatada DD/MM/AAAA
      let dataFormatada = ag.data;
      if (ag.data && ag.data.length === 10) {
        const [ano, mes, dia] = ag.data.split("-");
        dataFormatada = `${dia}/${mes}/${ano}`;
      }

      cardElement.innerHTML = `
        <div class="card-title">${ag.servicoNome || 'Serviço não informado'}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-user"></i> <strong>Cliente:</strong> ${ag.clienteNome || "Não informado"}</p>
          <p><i class="fa-solid fa-user-tie"></i> <strong>Profissional:</strong> ${ag.profissionalNome || "Não informado"}</p>
          <p>
            <i class="fa-solid fa-calendar-day"></i>
            <span class="card-agenda-dia">${dataFormatada}</span>
            <i class="fa-solid fa-clock"></i>
            <span class="card-agenda-hora">${ag.horario || "Não informada"}</span>
          </p>
          <p><i class="fa-solid fa-info-circle"></i> <strong>Status:</strong> ${statusLabel}</p>
        </div>
        ${
          (perfilUsuario === "dono" || (ag.profissionalId === meuUid)) && ag.status === "ativo" && modoAgenda === "semana"
            ? `<div class="card-actions">
                <button class="btn btn-nao-compareceu" data-id="${ag.id}">
                  <i class="fa-solid fa-user-xmark"></i> Não Compareceu
                </button>
                <button class="btn btn-cancelar" data-id="${ag.id}">
                  <i class="fa-solid fa-ban"></i> Cancelar
                </button>
              </div>`
            : ""
        }
      `;
      listaAgendamentosDiv.appendChild(cardElement);
    });
  } catch (error) {
    let mensagemExtra = "";
    if (error.code && error.code === "failed-precondition" && error.message && error.message.includes("index")) {
      mensagemExtra = "<br>É necessário criar um índice composto no Firestore. Veja o console para detalhes.";
    }
    exibirMensagemDeErro("Ocorreu um erro ao carregar a agenda." + mensagemExtra);
    console.error("Erro ao carregar agendamentos:", error);
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
    mostrarToast(`Erro ao atualizar agendamento.`, "#ef4444");
    console.error(`Erro ao atualizar status para ${status}:`, error);
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
