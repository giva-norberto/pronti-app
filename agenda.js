/**
 * agenda.js - Pronti (Versão Final Corrigida)
 * - Totalmente compatível com o HTML fornecido, sem necessidade de alterações no layout.
 * - Corrige o erro de inicialização e respeita os IDs dos elementos existentes.
 * - Ao abrir: Mostra agendamentos do dia atual.
 * - Botões "Agenda da Semana" e "Histórico" gerenciam a visualização dos filtros.
 * - A lógica de datas e filtros foi refinada para ser mais clara e robusta.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase
const app = initializeApp(firebaseConfig );
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements (IDs correspondem ao HTML fornecido)
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const btnAgendaSemana = document.getElementById("btn-agenda-semana");
const btnHistorico = document.getElementById("btn-historico");
const filtroSemanaDiv = document.getElementById("filtro-semana");
const inputDataSemana = document.getElementById("data-semana");
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
let modoAgenda = "semana"; // Inicia no modo semana, mas carrega o dia atual primeiro

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

// ----------- LÓGICA DE DATAS -----------
function getPeriodoSemana(dataBaseStr) {
    const inicio = new Date(dataBaseStr + 'T00:00:00Z'); // Use T00:00:00Z para consistência
    const fim = new Date(inicio);
    const diaDaSemana = inicio.getUTCDay(); // 0 (Domingo) a 6 (Sábado)
    const diasAteSabado = 6 - diaDaSemana;
    fim.setUTCDate(inicio.getUTCDate() + diasAteSabado);

    return {
        inicioISO: formatarDataISO(inicio),
        fimISO: formatarDataISO(fim)
    };
}

function atualizarLegendaSemana() {
    if (inputDataSemana && inputDataSemana.value && semanaInicioEl && semanaFimEl) {
        const { inicioISO, fimISO } = getPeriodoSemana(inputDataSemana.value);
        semanaInicioEl.textContent = formatarDataBrasileira(inicioISO);
        semanaFimEl.textContent = formatarDataBrasileira(fimISO);
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
        filtroProfissionalEl.style.display = "";
    } else {
        const filtroItem = document.getElementById("filtro-profissional-item");
        if(filtroItem) filtroItem.style.display = "none";
    }

    // Define a data inicial para hoje
    inputDataSemana.value = formatarDataISO(new Date());
    
    configurarListeners();
    ativarModoAgenda('semana'); // Ativa o modo semana visualmente
    carregarAgendamentosDia(); // Mas carrega os dados do DIA ATUAL primeiro
}

function configurarListeners() {
    btnAgendaSemana.addEventListener("click", () => ativarModoAgenda("semana"));
    btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));
    
    filtroProfissionalEl.addEventListener("change", carregarAgendamentosConformeModo);
    inputDataSemana.addEventListener("change", carregarAgendamentosConformeModo);
    
    btnSemanaProxima.addEventListener("click", () => {
        const dataAtual = new Date(inputDataSemana.value + 'T00:00:00Z');
        dataAtual.setUTCDate(dataAtual.getUTCDate() + 7);
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

    // Controle de visibilidade dos filtros
    filtroSemanaDiv.style.display = (modo === 'semana') ? '' : 'none';
    filtrosHistoricoDiv.style.display = (modo === 'historico') ? 'flex' : 'none';

    // Controle visual dos botões
    btnAgendaSemana.classList.toggle("active", modo === "semana");
    btnHistorico.classList.toggle("active", modo === "historico");

    // Carrega os dados correspondentes ao modo ativado
    if (modo === 'semana') {
        carregarAgendamentosSemana();
    } else if (modo === 'historico') {
        preencherCamposMesAtual();
        listaAgendamentosDiv.innerHTML = `<p>Selecione um período e clique em "Aplicar" para ver o histórico.</p>`;
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
        // O HTML do card é mantido exatamente como no seu exemplo, sem alterações de layout.
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
            </div>
            <div class="card-actions">
                <!-- Botões de ação podem ser adicionados aqui se necessário -->
            </div>`;
        // Remove o div de ações se estiver vazio para não ocupar espaço
        if (cardElement.querySelector('.card-actions').innerHTML.trim() === '') {
            cardElement.querySelector('.card-actions').remove();
        }
        listaAgendamentosDiv.appendChild(cardElement);
    });
    if (listaAgendamentosDiv.childElementCount === 0) {
        listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para os critérios selecionados.</p>`;
    }
}

// ----------- MODOS DE CARREGAMENTO ESPECÍFICOS -----------
function carregarAgendamentosDia() {
    atualizarLegendaSemana();
    const dataSelecionada = inputDataSemana.value;
    const constraints = [where("data", "==", dataSelecionada)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, `Nenhum agendamento para hoje.`);
}

function carregarAgendamentosSemana() {
    atualizarLegendaSemana();
    const { inicioISO, fimISO } = getPeriodoSemana(inputDataSemana.value);
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
