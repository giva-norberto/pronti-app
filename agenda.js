/**
 * agenda.js - Pronti (Versão Nota 10)
 * - Filtra APENAS agendamentos com status 'ativo' para a data atual e futuras.
 * - O modo Histórico continua mostrando todos os status.
 * - Lógica adaptada para funcionar com o novo layout de filtros.
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
const btnAgendaSemana = document.getElementById("btn-agenda-semana");
const btnHistorico = document.getElementById("btn-historico");
const inputDataSemana = document.getElementById("data-semana");
const btnSemanaProxima = document.getElementById('btn-semana-proxima');
const legendaSemana = document.getElementById("legenda-semana");
const filtrosHistoricoDiv = document.getElementById("filtros-historico");
const dataInicialEl = document.getElementById("data-inicial");
const dataFinalEl = document.getElementById("data-final");
const btnAplicarHistorico = document.getElementById("btn-aplicar-historico");
const btnMesAtual = document.getElementById("btn-mes-atual");

let empresaId = null;
let perfilUsuario = "dono";
let meuUid = null;
let modoAgenda = "semana";

// ----------- UTILITÁRIOS -----------
function mostrarToast(texto, cor = '#38bdf8') {
    if (typeof Toastify !== "undefined") {
        Toastify({ text: texto, duration: 4000, gravity: "top", position: "center", style: { background: cor, color: "white", borderRadius: "8px" } }).showToast();
    } else {
        alert(texto);
    }
}
function formatarDataISO(data) { 
    // Sempre no fuso local!
    const off = data.getTimezoneOffset();
    const dataLocal = new Date(data.getTime() - (off*60*1000));
    return dataLocal.toISOString().split('T')[0];
}
function formatarDataBrasileira(dataISO) {
    if (!dataISO || dataISO.length !== 10) return dataISO;
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

// ----------- LÓGICA DE DATAS -----------
function getPeriodoSemana(dataBaseStr) {
    // Calcula segunda a domingo no fuso local
    const [ano, mes, dia] = dataBaseStr.split('-').map(Number);
    const inicio = new Date(ano, mes - 1, dia);
    const fim = new Date(inicio);
    const diaDaSemana = inicio.getDay(); // 0=domingo, 1=segunda,...
    // Volta para segunda-feira
    inicio.setDate(inicio.getDate() - ((diaDaSemana + 6) % 7));
    // Avança até domingo
    fim.setDate(inicio.getDate() + 6);
    return { 
        inicioISO: formatarDataISO(inicio), 
        fimISO: formatarDataISO(fim) 
    };
}

function atualizarLegendaSemana() {
    if (legendaSemana && inputDataSemana.value) {
        const { inicioISO, fimISO } = getPeriodoSemana(inputDataSemana.value);
        legendaSemana.innerHTML = `Mostrando de <strong>${formatarDataBrasileira(inicioISO)}</strong> a <strong>${formatarDataBrasileira(fimISO)}</strong>`;
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
            exibirMensagemDeErro("Empresa não encontrada.");
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
    } else {
        document.getElementById("filtro-profissional-item").style.display = "none";
    }
    // Sempre inicializa com o dia de hoje no fuso local
    inputDataSemana.value = formatarDataISO(new Date());
    configurarListeners();
    ativarModoAgenda('semana');
}

function configurarListeners() {
    btnAgendaSemana.addEventListener("click", () => ativarModoAgenda("semana"));
    btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));
    filtroProfissionalEl.addEventListener("change", carregarAgendamentosConformeModo);
    inputDataSemana.addEventListener("change", carregarAgendamentosConformeModo);
    btnSemanaProxima.addEventListener("click", () => {
        const [ano, mes, dia] = inputDataSemana.value.split('-').map(Number);
        const dataAtual = new Date(ano, mes - 1, dia);
        dataAtual.setDate(dataAtual.getDate() + 7);
        inputDataSemana.value = formatarDataISO(dataAtual);
        carregarAgendamentosConformeModo();
    });
    btnAplicarHistorico.addEventListener("click", carregarAgendamentosHistorico);
    btnMesAtual.addEventListener("click", () => {
        preencherCamposMesAtual();
        carregarAgendamentosHistorico();
    });
}

function carregarAgendamentosConformeModo() {
    if (modoAgenda === 'semana') {
        carregarAgendamentosSemana();
    } else if (modoAgenda === 'historico') {
        carregarAgendamentosHistorico();
    }
}

function ativarModoAgenda(modo) {
    modoAgenda = modo;
    document.getElementById("filtros-semana-container").style.display = (modo === 'semana') ? 'flex' : 'none';
    filtrosHistoricoDiv.style.display = (modo === 'historico') ? 'flex' : 'none';
    btnAgendaSemana.classList.toggle("active", modo === "semana");
    btnHistorico.classList.toggle("active", modo === "historico");
    carregarAgendamentosConformeModo();
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
async function buscarEExibirAgendamentos(constraints, mensagemVazio, isHistorico = false) {
    listaAgendamentosDiv.innerHTML = `<p>Carregando agendamentos...</p>`;
    try {
        const ref = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(ref, ...constraints, orderBy("data"), orderBy("horario"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            listaAgendamentosDiv.innerHTML = `<p>${mensagemVazio}</p>`;
            return;
        }
        exibirCardsAgendamento(snapshot.docs, isHistorico);
    } catch (error) {
        exibirMensagemDeErro("Ocorreu um erro ao carregar os agendamentos.");
        console.error(error);
    }
}

function exibirCardsAgendamento(docs, isHistorico) {
    listaAgendamentosDiv.innerHTML = '';
    docs.forEach(doc => {
        const ag = { id: doc.id, ...doc.data() };

        // Se não for histórico, mostra apenas status 'ativo'
        if (!isHistorico && ag.status !== 'ativo') {
            return; // Pula para o próximo agendamento
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
                <p><b>Cliente:</b> ${ag.clienteNome || "Não informado"}</p>
                <p><b>Profissional:</b> ${ag.profissionalNome || "Não informado"}</p>
                <p>
                    <i class="fa-solid fa-calendar-day"></i>
                    <span class="card-agenda-dia">${formatarDataBrasileira(ag.data)}</span>
                    <i class="fa-solid fa-clock"></i>
                    <span class="card-agenda-hora">${ag.horario || "Não informada"}</span>
                </p>
                <p><b>Status:</b> ${statusLabel}</p>
            </div>`;
        listaAgendamentosDiv.appendChild(cardElement);
    });
    if (listaAgendamentosDiv.childElementCount === 0) {
        listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para os critérios selecionados.</p>`;
    }
}

// ----------- MODOS DE CARREGAMENTO ESPECÍFICOS -----------
function carregarAgendamentosSemana() {
    atualizarLegendaSemana();
    const { inicioISO, fimISO } = getPeriodoSemana(inputDataSemana.value);
    const constraints = [where("data", ">=", inicioISO), where("data", "<=", fimISO)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento ativo para esta semana.");
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
    // O 'true' no final indica que é histórico, então todos os status devem ser mostrados
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento encontrado no histórico para este período.", true);
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
