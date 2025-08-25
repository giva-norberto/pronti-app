/**
 * agenda.js - Pronti (Versão Revisada)
 * - Agora possui três modos: Dia, Semana, Histórico.
 * - Modo "Dia" mostra só agendamentos do dia selecionado.
 * - Modo "Semana" mostra do dia selecionado até domingo (nunca dias anteriores).
 * - Histórico pega qualquer período.
 * - Toda manipulação de data é local.
 * - [ATUALIZAÇÃO] Cards agora trazem botão "Ausência" (Não Compareceu) para agendamentos com status 'ativo'.
 * - [ATUALIZAÇÃO MULTI-EMPRESA] Sempre lê empresaAtivaId do localStorage, redireciona para seleção se não houver.
 * - [NOVA LÓGICA] Ao vencer o turno do último agendamento do dia (ou em acesso posterior), o sistema pergunta ao usuário se deseja marcar ausências antes de finalizar o dia. Só após confirmação, os agendamentos vencidos são atualizados para "realizado" (exceto os marcados manualmente como ausência).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ----------- MULTI-EMPRESA: Checa empresa ativa -----------
let empresaId = localStorage.getItem("empresaAtivaId");
if (!empresaId) {
    window.location.href = "selecionar-empresa.html";
    throw new Error("Nenhuma empresa ativa encontrada.");
}

// DOM Elements
const listaAgendamentosDiv = document.getElementById("lista-agendamentos");
const filtroProfissionalEl = document.getElementById("filtro-profissional");
const btnAgendaDia = document.getElementById("btn-agenda-dia");
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

// Nova lógica: modal de confirmação
let modalFinalizarDia = null;

let perfilUsuario = "dono";
let meuUid = null;
let modoAgenda = "dia"; // Padrão: dia

// ----------- UTILITÁRIOS -----------
function mostrarToast(texto, cor = '#38bdf8') {
    if (typeof Toastify !== "undefined") {
        Toastify({ text: texto, duration: 4000, gravity: "top", position: "center", style: { background: cor, color: "white", borderRadius: "8px" } }).showToast();
    } else {
        alert(texto);
    }
}
function formatarDataISO(data) {
    const off = data.getTimezoneOffset();
    const dataLocal = new Date(data.getTime() - (off * 60 * 1000));
    return dataLocal.toISOString().split('T')[0];
}
function formatarDataBrasileira(dataISO) {
    if (!dataISO || dataISO.length !== 10) return dataISO;
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

// ----------- LÓGICA DE DATAS -----------
function getFimSemana(dataBaseStr) {
    // Retorna o domingo da semana do dia selecionado
    const [ano, mes, dia] = dataBaseStr.split('-').map(Number);
    const inicio = new Date(ano, mes - 1, dia);
    const diaDaSemana = inicio.getDay(); // 0=domingo, 1=segunda,...
    // Dias até domingo
    const diasAteDomingo = 7 - diaDaSemana;
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + diasAteDomingo - 1);
    return formatarDataISO(fim);
}
function atualizarLegendaSemana(inicioISO, fimISO) {
    if (legendaSemana) {
        legendaSemana.innerHTML = `Mostrando de <strong>${formatarDataBrasileira(inicioISO)}</strong> a <strong>${formatarDataBrasileira(fimISO)}</strong>`;
    }
}
function agendamentoJaVenceu(dataISO, horarioStr) {
    if (!dataISO || !horarioStr) return false;
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const [hora, min] = horarioStr.split(":").map(Number);
    const dataAg = new Date(ano, mes - 1, dia, hora, min, 0, 0);
    return dataAg.getTime() < Date.now();
}
function isDataAnteriorOuHoje(dataISO) {
    const hojeISO = formatarDataISO(new Date());
    return dataISO <= hojeISO;
}

// ----------- AUTENTICAÇÃO E PERFIL -----------
onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "login.html";
    meuUid = user.uid;
    try {
        // empresaId já foi lida do localStorage!
        perfilUsuario = await checarTipoUsuario(user.uid, empresaId);
        await inicializarPaginaAgenda();
    } catch (error) {
        exibirMensagemDeErro("Ocorreu um erro ao iniciar a página.");
        console.error("Erro na inicialização:", error);
    }
});

async function checarTipoUsuario(uid, empresaId) {
    // Confirma se é dono ou funcionário da empresa ativa
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
    inputDataSemana.value = formatarDataISO(new Date());
    configurarListeners();
    ativarModoAgenda('dia');
}

function configurarListeners() {
    btnAgendaDia.addEventListener("click", () => ativarModoAgenda("dia"));
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

    // Delegação para botão de ausência (não compareceu)
    listaAgendamentosDiv.addEventListener('click', async (e) => {
        const btnAusencia = e.target.closest('.btn-ausencia');
        if (btnAusencia) {
            const agendamentoId = btnAusencia.dataset.id;
            if (confirm("Marcar ausência deste cliente? Isso ficará registrado no histórico.")) {
                await marcarNaoCompareceu(agendamentoId);
            }
        }
    });
}

// ----------- FUNÇÃO PARA MARCAR AUSÊNCIA -----------
async function marcarNaoCompareceu(agendamentoId) {
    try {
        const agRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
        await updateDoc(agRef, { status: "nao_compareceu" });
        mostrarToast("Agendamento marcado como ausência.", "#f59e42");
        carregarAgendamentosConformeModo();
    } catch (error) {
        mostrarToast("Erro ao marcar ausência.", "#ef4444");
    }
}

function carregarAgendamentosConformeModo() {
    if (modoAgenda === 'semana') {
        carregarAgendamentosSemana();
    } else if (modoAgenda === 'historico') {
        carregarAgendamentosHistorico();
    } else {
        carregarAgendamentosDiaAtual();
    }
}

function ativarModoAgenda(modo) {
    modoAgenda = modo;
    document.getElementById("filtros-semana-container").style.display = (modo === 'semana' || modo === 'dia') ? 'flex' : 'none';
    filtrosHistoricoDiv.style.display = (modo === 'historico') ? 'flex' : 'none';
    btnAgendaDia.classList.toggle("active", modo === "dia");
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
// NOVA LÓGICA: Pergunta antes de atualizar para "realizado" os agendamentos vencidos do dia anterior ou do dia atual após o último horário
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

        // --- NOVA LÓGICA DE FINALIZAÇÃO DO DIA ---
        // Detecta se há agendamentos vencidos (ativos) para o(s) dia(s) anterior(es) ou turno do dia já acabou
        const docsVencidos = [];
        let ultimoHorarioDia = null;
        let dataReferencia = null;
        snapshot.docs.forEach(docSnap => {
            const ag = docSnap.data();
            if (ag.status === "ativo" && agendamentoJaVenceu(ag.data, ag.horario)) {
                docsVencidos.push(docSnap);
            }
            // Descobre o último horário do dia para a data selecionada
            if (!isHistorico && ag.data) {
                if (!dataReferencia) dataReferencia = ag.data;
                if (ag.data === dataReferencia) {
                    if (!ultimoHorarioDia || ag.horario > ultimoHorarioDia) {
                        ultimoHorarioDia = ag.horario;
                    }
                }
            }
        });

        // Se há agendamentos vencidos e (é dia anterior ou já passou do último horário do dia)
        if (
            docsVencidos.length > 0 &&
            (
                (dataReferencia && isDataAnteriorOuHoje(dataReferencia) && agendamentoJaVenceu(dataReferencia, ultimoHorarioDia))
                || (dataReferencia && dataReferencia < formatarDataISO(new Date()))
            )
        ) {
            exibirCardsAgendamento(snapshot.docs, isHistorico);

            // Exibe modal/botão de finalizar dia
            exibirModalFinalizarDia(docsVencidos, dataReferencia);
            return;
        }

        // Se não precisa perguntar, exibe os cards normalmente
        exibirCardsAgendamento(snapshot.docs, isHistorico);
    } catch (error) {
        exibirMensagemDeErro("Ocorreu um erro ao carregar os agendamentos.");
        console.error(error);
    }
}

function exibirModalFinalizarDia(docsVencidos, dataReferencia) {
    // Remove modal antigo se existir
    if (modalFinalizarDia) modalFinalizarDia.remove();

    modalFinalizarDia = document.createElement('div');
    modalFinalizarDia.className = 'modal-finalizar-dia';
    modalFinalizarDia.innerHTML = `
        <div class="modal-finalizar-dia__content">
            <h3>Finalizar dia ${formatarDataBrasileira(dataReferencia)}</h3>
            <p>Você deseja marcar alguma ausência para os agendamentos deste dia antes de finalizar? Todos os agendamentos ainda "ativos" serão marcados como "realizado" após a finalização.</p>
            <button id="btn-finalizar-dia">Finalizar dia</button>
            <button id="btn-fechar-modal">Fechar</button>
        </div>
        <style>
        .modal-finalizar-dia {
            position: fixed; z-index: 9999; left: 0; top: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
        }
        .modal-finalizar-dia__content {
            background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 8px 32px #0003; max-width: 370px;
            text-align: center;
        }
        .modal-finalizar-dia__content button {
            margin: 10px 8px 0 8px; padding: 8px 20px; font-size: 1rem; border-radius: 6px; border: none;
            background: #38bdf8; color: #fff; cursor: pointer;
        }
        #btn-fechar-modal { background: #aaa; }
        </style>
    `;
    document.body.appendChild(modalFinalizarDia);

    document.getElementById("btn-finalizar-dia").onclick = async () => {
        // Atualiza todos os docs vencidos para realizado
        const updates = [];
        for (const docSnap of docsVencidos) {
            // Não atualiza se já foi marcado como ausência/cancelado
            const ag = docSnap.data();
            if (
                ag.status === "ativo" &&
                agendamentoJaVenceu(ag.data, ag.horario) &&
                ag.status !== "nao_compareceu" &&
                ag.status !== "cancelado" &&
                ag.status !== "cancelado_pelo_gestor"
            ) {
                updates.push(updateDoc(doc(db, "empresarios", empresaId, "agendamentos", docSnap.id), { status: "realizado" }));
            }
        }
        if (updates.length > 0) await Promise.all(updates);
        mostrarToast("Agendamentos finalizados como 'realizado'.");
        modalFinalizarDia.remove();
        carregarAgendamentosConformeModo();
    };
    document.getElementById("btn-fechar-modal").onclick = () => {
        modalFinalizarDia.remove();
    };
}

function exibirCardsAgendamento(docs, isHistorico) {
    listaAgendamentosDiv.innerHTML = '';
    docs.forEach(doc => {
        const ag = { id: doc.id, ...doc.data() };

        // Se não for histórico, mostra apenas status 'ativo'
        if (!isHistorico && ag.status !== 'ativo') {
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
            ${
                // Só mostra o botão "Ausência" se for status ativo E não estiver no histórico
                (!isHistorico && ag.status === 'ativo') ? `
                <div class="card-actions">
                    <button class="btn-ausencia" data-id="${ag.id}" title="Marcar ausência">
                        <i class="fa-solid fa-user-slash"></i> Ausência
                    </button>
                </div>
                ` : ''
            }
        `;
        listaAgendamentosDiv.appendChild(cardElement);
    });
    if (listaAgendamentosDiv.childElementCount === 0) {
        listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para os critérios selecionados.</p>`;
    }
}

// ----------- MODO DIA (NOVO) -----------
function carregarAgendamentosDiaAtual() {
    const diaSelecionado = inputDataSemana.value;
    atualizarLegendaSemana(diaSelecionado, diaSelecionado);
    const constraints = [where("data", "==", diaSelecionado)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento ativo para este dia.");
}

// ----------- MODO SEMANA (ajustado: só do dia selecionado em diante) -----------
function carregarAgendamentosSemana() {
    const diaSelecionado = inputDataSemana.value;
    const fimISO = getFimSemana(diaSelecionado);
    atualizarLegendaSemana(diaSelecionado, fimISO);
    const constraints = [
        where("data", ">=", diaSelecionado),
        where("data", "<=", fimISO)
    ];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento ativo para este período.");
}

// ----------- MODO HISTÓRICO -----------
function carregarAgendamentosHistorico() {
    const dataIni = dataInicialEl.value;
    const dataFim = dataFinalEl.value;
    if (!dataIni || !dataFim) {
        mostrarToast("Por favor, selecione as datas de início e fim.", "#ef4444");
        return;
    }
    atualizarLegendaSemana(dataIni, dataFim);
    const constraints = [where("data", ">=", dataIni), where("data", "<=", dataFim)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento encontrado no histórico para este período.", true);
}

// ----------- FUNÇÕES AUXILIARES -----------
function preencherCamposMesAtual() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    if (dataInicialEl) dataInicialEl.value = formatarDataISO(primeiroDia);
    if (dataFinalEl) dataFinalEl.value = formatarDataISO(ultimoDia);
}

function exibirMensagemDeErro(mensagem) {
    if (listaAgendamentosDiv) {
        listaAgendamentosDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
    }
}
