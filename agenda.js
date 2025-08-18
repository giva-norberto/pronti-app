/**
 * agenda.js - Pronti (Revisado e Corrigido)
 * - Foco exclusivo nos filtros e na correção do erro reportado.
 * - Ao abrir: Mostra agendamentos do dia atual.
 * - Botão "Hoje": Filtra pelo dia atual.
 * - Botão "Agenda da Semana": Mostra da data selecionada até o próximo sábado.
 * - Botão "Histórico": Abre os filtros de período.
 * - Sem lógicas de agenda adicionais, respeitando o sistema existente.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase
const app = initializeApp(firebaseConfig );
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const btnHoje = document.getElementById("btn-hoje");
const btnAgendaSemana = document.getElementById("btn-agenda-semana");
const btnHistorico = document.getElementById("btn-historico");
const filtroDataContainer = document.getElementById("filtro-data-container");
const inputData = document.getElementById("data-filtro"); // ID corrigido
const legendaPeriodoEl = document.getElementById("legenda-periodo");
const filtrosHistoricoDiv = document.getElementById("filtros-historico");
const dataInicialEl = document.getElementById("data-inicial");
const dataFinalEl = document.getElementById("data-final");
const btnAplicarHistorico = document.getElementById("btn-aplicar-historico");
const btnMesAtual = document.getElementById("btn-mes-atual");

let empresaId = null;
let perfilUsuario = "dono";
let meuUid = null;
let modoAgenda = "dia";

// ----------- UTILITÁRIOS -----------
function mostrarToast(texto, cor = '#38bdf8') {
    if (typeof Toastify !== "undefined") {
        Toastify({ text: texto, duration: 4000, gravity: "top", position: "center", style: { background: cor, color: "white", borderRadius: "8px" } }).showToast();
    } else {
        alert(texto);
    }
}
function formatarDataISO(data) { return data.toISOString().split('T')[0]; }
function formatarDataBrasileira(dataISO) {
    if (!dataISO || dataISO.length !== 10) return dataISO;
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

// ----------- LÓGICA DE DATAS (Semana até Sábado) -----------
function getSemanaAteSabado(dataBase) {
    const inicio = new Date(dataBase);
    inicio.setUTCHours(0, 0, 0, 0);

    const fim = new Date(inicio);
    const diaDaSemana = inicio.getUTCDay(); // 0 (Domingo) a 6 (Sábado)
    const diasAteSabado = 6 - diaDaSemana;
    fim.setUTCDate(inicio.getUTCDate() + (diasAteSabado >= 0 ? diasAteSabado : 6)); // Se for domingo, vai até o próximo sábado

    return {
        inicioISO: formatarDataISO(inicio),
        fimISO: formatarDataISO(fim)
    };
}

function atualizarLegendaPeriodo() {
    if (!legendaPeriodoEl || !inputData.value) return;
    const dataBase = new Date(inputData.value + 'T00:00:00Z');

    if (modoAgenda === 'dia') {
        legendaPeriodoEl.textContent = `Mostrando agendamentos para ${formatarDataBrasileira(inputData.value)}`;
    } else if (modoAgenda === 'semana') {
        const { inicioISO, fimISO } = getSemanaAteSabado(dataBase);
        legendaPeriodoEl.textContent = `Mostrando de ${formatarDataBrasileira(inicioISO)} até ${formatarDataBrasileira(fimISO)}`;
    } else {
        legendaPeriodoEl.textContent = '';
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
        const profSnap = await getDocs(query(collection(db, "empresarios", docEmp.id, "profissionais"), where("__name__", "==", uid)));
        if (!profSnap.empty) return docEmp.id;
    }
    return null;
}

async function checarTipoUsuario(uid, empresaId) {
    const docEmp = await getDocs(query(collection(db, "empresarios"), where("donoId", "==", uid), where("__name__", "==", empresaId)));
    return docEmp.empty ? "funcionario" : "dono";
}

// ----------- INICIALIZAÇÃO DA PÁGINA -----------
async function inicializarPaginaAgenda() {
    if (perfilUsuario === "dono") {
        await popularFiltroProfissionais();
        document.getElementById("filtro-profissional-item").style.display = "";
    } else {
        document.getElementById("filtro-profissional-item").style.display = "none";
    }

    // Garante que o elemento existe antes de definir o valor
    if (inputData) {
        inputData.value = formatarDataISO(new Date());
    }

    configurarListeners();
    ativarModoAgenda("dia");
}

function configurarListeners() {
    btnHoje.addEventListener("click", () => {
        if (inputData) inputData.value = formatarDataISO(new Date());
        ativarModoAgenda("dia");
    });
    btnAgendaSemana.addEventListener("click", () => ativarModoAgenda("semana"));
    btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));
    filtroProfissionalEl.addEventListener("change", carregarAgendamentosConformeModo);
    if (inputData) inputData.addEventListener("change", carregarAgendamentosConformeModo);
    btnAplicarHistorico.addEventListener("click", carregarAgendamentosHistorico);
    btnMesAtual.addEventListener("click", () => {
        preencherCamposMesAtual();
        carregarAgendamentosHistorico();
    });
}

function carregarAgendamentosConformeModo() {
    if (modoAgenda === 'dia') carregarAgendamentosDia();
    else if (modoAgenda === 'semana') carregarAgendamentosSemana();
}

function ativarModoAgenda(modo) {
    modoAgenda = modo;
    filtroDataContainer.style.display = (modo === 'dia' || modo === 'semana') ? 'flex' : 'none';
    filtrosHistoricoDiv.style.display = modo === 'historico' ? 'flex' : 'none';
    btnHoje.classList.toggle("active", modo === "dia");
    btnAgendaSemana.classList.toggle("active", modo === "semana");
    btnHistorico.classList.toggle("active", modo === "historico");

    if (modo === 'dia') carregarAgendamentosDia();
    else if (modo === 'semana') carregarAgendamentosSemana();
    else if (modo === 'historico') {
        preencherCamposMesAtual();
        listaAgendamentosDiv.innerHTML = `<p>Selecione um período e clique em "Aplicar" para ver o histórico.</p>`;
        if(legendaPeriodoEl) legendaPeriodoEl.textContent = '';
    }
}

// ----------- FILTRO PROFISSIONAL -----------
async function popularFiltroProfissionais() {
    try {
        const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        snapshot.forEach(doc => {
            filtroProfissionalEl.appendChild(new Option(doc.data().nome, doc.id));
        });
    } catch (error) {
        mostrarToast("Erro ao buscar profissionais.", "#ef4444");
    }
}

// ----------- CARREGAMENTO DE AGENDAMENTOS -----------
async function buscarEExibirAgendamentos(constraints, mensagemVazio) {
    listaAgendamentosDiv.innerHTML = `<p>Carregando agendamentos...</p>`;
    try {
        const ref = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            listaAgendamentosDiv.innerHTML = `<p>${mensagemVazio}</p>`;
            return;
        }
        exibirCardsAgendamento(snapshot.docs);
    } catch (error) {
        exibirMensagemDeErro("Ocorreu um erro ao carregar os agendamentos.");
        console.error(error);
    }
}

function exibirCardsAgendamento(docs) {
    listaAgendamentosDiv.innerHTML = '';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    docs.forEach(doc => {
        const ag = { id: doc.id, ...doc.data() };
        const dataAg = new Date(ag.data + 'T00:00:00Z');
        if ((ag.status === "cancelado" || ag.status === "cancelado_pelo_gestor") && dataAg >= hoje) {
            return;
        }
        let statusLabel = "<span class='status-label status-ativo'>Ativo</span>";
        if (ag.status === "cancelado_pelo_gestor" || ag.status === "cancelado") statusLabel = "<span class='status-label status-cancelado'>Cancelado</span>";
        else if (ag.status === "nao_compareceu") statusLabel = "<span class='status-label status-falta'>Falta</span>";
        else if (ag.status === "realizado") statusLabel = "<span class='status-label status-realizado'>Realizado</span>";
        const cardElement = document.createElement('div');
        cardElement.className = 'card card--agenda';
        cardElement.innerHTML = `
            <div class="card-title">${ag.servicoNome || 'Serviço não informado'}</div>
            <div class="card-info">
                <p><i class="fa-solid fa-user"></i> <strong>Cliente:</strong> ${ag.clienteNome || "Não informado"}</p>
                <p><i class="fa-solid fa-user-tie"></i> <strong>Profissional:</strong> ${ag.profissionalNome || "Não informado"}</p>
                <p>
                    <i class="fa-solid fa-calendar-day"></i> <span class="card-agenda-dia">${formatarDataBrasileira(ag.data)}</span>
                    <i class="fa-solid fa-clock"></i> <span class="card-agenda-hora">${ag.horario || "Não informada"}</span>
                </p>
                <p><i class="fa-solid fa-info-circle"></i> <strong>Status:</strong> ${statusLabel}</p>
            </div>`;
        listaAgendamentosDiv.appendChild(cardElement);
    });
    if (listaAgendamentosDiv.childElementCount === 0) {
        listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para os critérios selecionados.</p>`;
    }
}

function carregarAgendamentosDia() {
    atualizarLegendaPeriodo();
    const dataSelecionada = inputData.value;
    const constraints = [where("data", "==", dataSelecionada)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, `Nenhum agendamento para ${formatarDataBrasileira(dataSelecionada)}.`);
}

function carregarAgendamentosSemana() {
    atualizarLegendaPeriodo();
    const dataBase = new Date(inputData.value + 'T00:00:00Z');
    const { inicioISO, fimISO } = getSemanaAteSabado(dataBase);
    const constraints = [where("data", ">=", inicioISO), where("data", "<=", fimISO)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento encontrado para esta semana.");
}

function carregarAgendamentosHistorico() {
    const dataIni = dataInicialEl.value;
    const dataFim = dataFinalEl.value;
    if (!dataIni || !dataFim) {
        mostrarToast("Por favor, selecione as datas de início e fim.", "#ef4444");
        return;
    }
    const constraints = [where("data", ">=", dataIni), where("data", "<=", dataFim)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento encontrado no histórico para este período.");
}

// ----------- FUNÇÕES AUXILIARES -----------
function preencherCamposMesAtual() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    if(dataInicialEl) dataInicialEl.value = formatarDataISO(primeiroDia);
    if(dataFinalEl) dataFinalEl.value = formatarDataISO(ultimoDia);
}

function exibirMensagemDeErro(mensagem) {
    if (listaAgendamentosDiv) {
        listaAgendamentosDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
    }
}
