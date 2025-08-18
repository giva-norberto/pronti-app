/**
 * agenda.js - Pronti
 * - Ao abrir: mostra apenas agendamentos do dia atual (sem cancelados de hoje/futuro).
 * - Ao clicar em "Agenda da Semana": mostra semana, mas só exibe cancelados se forem de datas passadas.
 * - Histórico: mostra tudo, inclusive cancelados.
 * - Datas da semana sempre corretas (segunda a domingo).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const btnAgendaSemana = document.getElementById("btn-agenda-semana");
const btnHistorico = document.getElementById("btn-historico");
const filtroSemanaDiv = document.getElementById("filtro-semana");
const inputSemana = document.getElementById("data-semana");
const semanaInicioEl = document.getElementById("semana-inicio");
const semanaFimEl = document.getElementById("semana-fim");
const btnSemanaProxima = document.getElementById('btn-semana-proxima');
const filtrosHistoricoDiv = document.getElementById("filtros-historico");
const dataInicialEl = document.getElementById("data-inicial");
const dataFinalEl = document.getElementById("data-final");
const btnAplicarHistorico = document.getElementById("btn-aplicar-historico");
const btnMesAtual = document.getElementById("btn-mes-atual");

let empresaId = null;
let perfilUsuario = "dono";
let meuUid = null;
let modoAgenda = "dia"; // "dia", "semana" ou "historico"

// ----------- UTILITÁRIOS -----------
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

// ----------- SEMANA -----------
function getWeekRange(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
  return { inicio: fmt(monday), fim: fmt(sunday), inicioISO: monday.toISOString().split('T')[0], fimISO: sunday.toISOString().split('T')[0] };
}
function atualizarLegendaSemana() {
  if (inputSemana && inputSemana.value && semanaInicioEl && semanaFimEl) {
    const { inicio, fim } = getWeekRange(inputSemana.value);
    semanaInicioEl.textContent = inicio;
    semanaFimEl.textContent = fim;
  } else if (semanaInicioEl && semanaFimEl) {
    semanaInicioEl.textContent = '';
    semanaFimEl.textContent = '';
  }
}

// ----------- AUTENTICAÇÃO E PERFIL -----------
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";
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
});

async function getEmpresaIdDoDonoOuFuncionario(uid) {
  let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
  let snapshot = await getDocs(q);
  if (!snapshot.empty) return snapshot.docs[0].id;
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

// ----------- INICIALIZAÇÃO -----------
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

  // Sempre mostra o campo de data com o dia de hoje por padrão
  if (inputSemana) {
    const hoje = new Date();
    inputSemana.value = hoje.toISOString().split('T')[0];
  }

  ativarModoAgenda("dia");

  // Listeners
  if (btnAgendaSemana) btnAgendaSemana.addEventListener("click", () => ativarModoAgenda("semana"));
  if (btnHistorico) btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));
  if (filtroProfissionalEl) filtroProfissionalEl.addEventListener("change", () => {
    if (modoAgenda === "dia") carregarAgendamentosDia();
    if (modoAgenda === "semana") carregarAgendamentosSemana();
  });
  if (inputSemana) inputSemana.addEventListener("change", () => {
    if (modoAgenda === "dia") carregarAgendamentosDia();
    if (modoAgenda === "semana") {
      atualizarLegendaSemana();
      carregarAgendamentosSemana();
    }
  });
  if (btnSemanaProxima) btnSemanaProxima.addEventListener("click", () => {
    const dataAtual = new Date(inputSemana.value);
    dataAtual.setDate(dataAtual.getDate() + 7);
    inputSemana.value = dataAtual.toISOString().split('T')[0];
    atualizarLegendaSemana();
    if (modoAgenda === "semana") carregarAgendamentosSemana();
  });
  if (btnAplicarHistorico) btnAplicarHistorico.addEventListener("click", carregarAgendamentosHistorico);
  if (btnMesAtual) btnMesAtual.addEventListener("click", () => {
    preencherCamposMesAtual();
    carregarAgendamentosHistorico();
  });

  configurarListenersDeAcao();

  // Ao abrir, já carrega agendamentos do dia
  carregarAgendamentosDia();
}

function ativarModoAgenda(modo) {
  modoAgenda = modo;
  if (btnAgendaSemana) btnAgendaSemana.classList.toggle("active", modo === "semana");
  if (btnHistorico) btnHistorico.classList.toggle("active", modo === "historico");
  if (filtroSemanaDiv) filtroSemanaDiv.style.display = (modo === "semana" || modo === "dia") ? "" : "none";
  if (filtrosHistoricoDiv) filtrosHistoricoDiv.style.display = (modo === "historico") ? "" : "none";
  if (modo === "dia") {
    carregarAgendamentosDia();
  } else if (modo === "semana") {
    atualizarLegendaSemana();
    carregarAgendamentosSemana();
  }
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

// ----------- AGENDAMENTOS DIA -----------
async function carregarAgendamentosDia() {
  if (!listaAgendamentosDiv) return;
  listaAgendamentosDiv.innerHTML = `<p>A carregar agendamentos do dia...</p>`;

  let profissionalId = "todos";
  if (perfilUsuario === "dono") {
    profissionalId = filtroProfissionalEl ? filtroProfissionalEl.value : 'todos';
  } else {
    profissionalId = meuUid;
  }

  const hojeISO = inputSemana.value; // yyyy-mm-dd
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  try {
    const ref = collection(db, "empresarios", empresaId, "agendamentos");
    const constraints = [where("data", "==", hojeISO)];
    if (profissionalId !== 'todos') constraints.push(where("profissionalId", "==", profissionalId));
    const q = query(ref, ...constraints, orderBy("horario"));
    const snapshot = await getDocs(q);

    const ags = [];
    snapshot.forEach(doc => {
      const ag = doc.data();
      // Não mostra cancelados se a data for hoje ou futura
      if (
        (ag.status === "cancelado" || ag.status === "cancelado_pelo_gestor")
      ) {
        const [ano, mes, dia] = ag.data.split("-");
        const dataAg = new Date(`${ano}-${mes}-${dia}T00:00:00`);
        if (dataAg >= hoje) return;
      }
      ags.push(ag);
    });

    if (ags.length === 0) {
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para hoje.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    ags.forEach(ag => {
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
      const cardElement = document.createElement('div');
      cardElement.className = 'card card--agenda';
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
      `;
      listaAgendamentosDiv.appendChild(cardElement);
    });
  } catch (error) {
    exibirMensagemDeErro("Ocorreu um erro ao carregar os agendamentos do dia.");
    console.error(error);
  }
}

// ----------- AGENDAMENTOS SEMANA -----------
async function carregarAgendamentosSemana() {
  if (!listaAgendamentosDiv) return;
  listaAgendamentosDiv.innerHTML = `<p>A carregar agendamentos da semana...</p>`;

  let profissionalId = "todos";
  if (perfilUsuario === "dono") {
    profissionalId = filtroProfissionalEl ? filtroProfissionalEl.value : 'todos';
  } else {
    profissionalId = meuUid;
  }

  const { inicioISO, fimISO } = getWeekRange(inputSemana.value);
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  try {
    const ref = collection(db, "empresarios", empresaId, "agendamentos");
    const constraints = [
      where("data", ">=", inicioISO),
      where("data", "<=", fimISO)
    ];
    if (profissionalId !== 'todos') constraints.push(where("profissionalId", "==", profissionalId));
    const q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
    const snapshot = await getDocs(q);

    const ags = [];
    snapshot.forEach(doc => {
      const ag = doc.data();
      const [ano, mes, dia] = ag.data.split("-");
      const dataAg = new Date(`${ano}-${mes}-${dia}T00:00:00`);
      // Não mostra cancelados se a data for hoje ou futura
      if (
        (ag.status === "cancelado" || ag.status === "cancelado_pelo_gestor") &&
        dataAg >= hoje
      ) {
        return;
      }
      ags.push(ag);
    });

    if (ags.length === 0) {
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para esta semana.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    ags.forEach(ag => {
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
      const cardElement = document.createElement('div');
      cardElement.className = 'card card--agenda';
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
      `;
      listaAgendamentosDiv.appendChild(cardElement);
    });
  } catch (error) {
    exibirMensagemDeErro("Ocorreu um erro ao carregar os agendamentos da semana.");
    console.error(error);
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
async function carregarAgendamentosHistorico() {
  if (!listaAgendamentosDiv) return;
  listaAgendamentosDiv.innerHTML = `<p>A carregar histórico...</p>`;

  let profissionalId = "todos";
  if (perfilUsuario === "dono") {
    profissionalId = filtroProfissionalEl ? filtroProfissionalEl.value : 'todos';
  } else {
    profissionalId = meuUid;
  }

  const dataIni = dataInicialEl ? dataInicialEl.value : "";
  const dataFim = dataFinalEl ? dataFinalEl.value : "";
  if (!dataIni || !dataFim) {
    listaAgendamentosDiv.innerHTML = `<p>Selecione o período do histórico.</p>`;
    return;
  }
  try {
    const ref = collection(db, "empresarios", empresaId, "agendamentos");
    const constraints = [
      where("data", ">=", dataIni),
      where("data", "<=", dataFim)
    ];
    if (profissionalId !== 'todos') constraints.push(where("profissionalId", "==", profissionalId));
    const q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado no histórico.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    snapshot.forEach(doc => {
      const ag = doc.data();
      let statusLabel = "<span class='status-label status-ativo'>Ativo</span>";
      if (ag.status === "cancelado_pelo_gestor" || ag.status === "cancelado") statusLabel = "<span class='status-label status-cancelado'>Cancelado</span>";
      else if (ag.status === "nao_compareceu") statusLabel = "<span class='status-label status-falta'>Falta</span>";
      else if (ag.status === "realizado") statusLabel = "<span class='status-label status-realizado'>Realizado</span>";
      let dataFormatada = ag.data;
      if (ag.data && ag.data.length === 10) {
        const [ano, mes, dia] = ag.data.split("-");
        dataFormatada = `${dia}/${mes}/${ano}`;
      }
      const cardElement = document.createElement('div');
      cardElement.className = 'card card--agenda';
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
      `;
      listaAgendamentosDiv.appendChild(cardElement);
    });
  } catch (error) {
    exibirMensagemDeErro("Ocorreu um erro ao carregar o histórico.");
    console.error(error);
  }
}

// ----------- AÇÕES (CANCELAR, NÃO COMPARECEU) -----------
function configurarListenersDeAcao() {
  // Implemente igual ao padrão anterior caso queira permitir ações nos cards
}

// ----------- ERRO -----------
function exibirMensagemDeErro(mensagem) {
  if (listaAgendamentosDiv) {
    listaAgendamentosDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
  }
}
