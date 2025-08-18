/**
 * agenda.js - Pronti (Revisado v2)
 * - Lógica da "Agenda da Semana" agora respeita os dias de trabalho de cada funcionário.
 * - Busca os dias de trabalho do perfil do profissional no Firebase.
 * - Se "Todos os Profissionais" estiver selecionado, a semana vai até o próximo sábado como padrão.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
const inputData = document.getElementById("data-filtro");
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
let profissionaisCache = {}; // Cache para guardar dados dos profissionais

// ----------- UTILITÁRIOS -----------
function mostrarToast(texto, cor = '#38bdf8') {
    Toastify({ text: texto, duration: 4000, gravity: "top", position: "center", style: { background: cor, color: "white", borderRadius: "8px" } }).showToast();
}
function formatarDataISO(data) { return data.toISOString().split('T')[0]; }
function formatarDataBrasileira(dataISO) {
    if (!dataISO || dataISO.length !== 10) return dataISO;
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

// ----------- LÓGICA DE DATAS E PERÍODOS DINÂMICOS -----------
async function getSemanaDeTrabalhoDinamica(dataBase, profissionalId) {
    const inicio = new Date(dataBase);
    inicio.setUTCHours(0, 0, 0, 0);

    let diasDeTrabalho = [1, 2, 3, 4, 5, 6]; // Padrão: Seg-Sáb

    // Se um profissional específico for selecionado, busca seus dias de trabalho
    if (profissionalId && profissionalId !== 'todos') {
        if (profissionaisCache[profissionalId] && profissionaisCache[profissionalId].diasDeTrabalho) {
            diasDeTrabalho = profissionaisCache[profissionalId].diasDeTrabalho;
        } else {
            try {
                const profDocRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
                const profDocSnap = await getDoc(profDocRef);
                if (profDocSnap.exists() && profDocSnap.data().diasDeTrabalho) {
                    diasDeTrabalho = profDocSnap.data().diasDeTrabalho;
                    // Atualiza o cache
                    profissionaisCache[profissionalId] = { ...profissionaisCache[profissionalId], diasDeTrabalho };
                }
            } catch (error) {
                console.error("Erro ao buscar dias de trabalho do profissional:", error);
            }
        }
    }

    const fim = new Date(inicio);
    let diaAtual = inicio.getDay(); // 0=Dom, 1=Seg, ...
    let diasParaFrente = 0;

    // Encontra o próximo dia de trabalho no ciclo da semana
    while (diasParaFrente < 7) {
        if (diasDeTrabalho.includes(diaAtual)) {
            // Se hoje é um dia de trabalho, verifica se há mais dias de trabalho na frente na mesma semana
            let proximoDiaDeTrabalhoEncontrado = false;
            for (let i = diaAtual + 1; i < 7; i++) {
                if (diasDeTrabalho.includes(i)) {
                    proximoDiaDeTrabalhoEncontrado = true;
                    break;
                }
            }
            // Se não houver mais dias de trabalho nesta semana, o período termina hoje.
            if (!proximoDiaDeTrabalhoEncontrado) {
                break;
            }
        }
        
        fim.setDate(fim.getDate() + 1);
        diaAtual = fim.getDay();
        diasParaFrente++;

        // Se o próximo dia não for de trabalho, paramos no dia anterior
        if (!diasDeTrabalho.includes(diaAtual)) {
            fim.setDate(fim.getDate() - 1);
            break;
        }
    }
    
    // Garante que o fim não ultrapasse 6 dias a partir do início
    const diffTime = Math.abs(fim - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 6) {
        fim.setDate(inicio.getDate() + 6);
    }


    return {
        inicioISO: formatarDataISO(inicio),
        fimISO: formatarDataISO(fim)
    };
}


async function atualizarLegendaPeriodo() {
    if (!legendaPeriodoEl || !inputData.value) return;
    const dataBase = new Date(inputData.value + 'T00:00:00');

    if (modoAgenda === 'dia') {
        legendaPeriodoEl.textContent = `Mostrando agendamentos para ${formatarDataBrasileira(inputData.value)}`;
    } else if (modoAgenda === 'semana') {
        legendaPeriodoEl.textContent = `Calculando período...`; // Feedback imediato
        const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
        const { inicioISO, fimISO } = await getSemanaDeTrabalhoDinamica(dataBase, profissionalId);
        legendaPeriodoEl.textContent = `Mostrando de ${formatarDataBrasileira(inicioISO)} até ${formatarDataBrasileira(fimISO)}`;
    } else {
        legendaPeriodoEl.textContent = '';
    }
}

// ----------- AUTENTICAÇÃO E INICIALIZAÇÃO (sem alterações) -----------
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

async function inicializarPaginaAgenda() {
    if (perfilUsuario === "dono") {
        await popularFiltroProfissionais();
        document.getElementById("filtro-profissional-item").style.display = "";
    } else {
        document.getElementById("filtro-profissional-item").style.display = "none";
        // Carrega os dados do funcionário logado no cache
        const profDocRef = doc(db, "empresarios", empresaId, "profissionais", meuUid);
        const profDocSnap = await getDoc(profDocRef);
        if (profDocSnap.exists()) {
            profissionaisCache[meuUid] = profDocSnap.data();
        }
    }
    inputData.value = formatarDataISO(new Date());
    configurarListeners();
    ativarModoAgenda("dia");
}

function configurarListeners() {
    btnHoje.addEventListener("click", () => {
        inputData.value = formatarDataISO(new Date());
        ativarModoAgenda("dia");
    });
    btnAgendaSemana.addEventListener("click", () => ativarModoAgenda("semana"));
    btnHistorico.addEventListener("click", () => ativarModoAgenda("historico"));
    filtroProfissionalEl.addEventListener("change", carregarAgendamentosConformeModo);
    inputData.addEventListener("change", carregarAgendamentosConformeModo);
    btnAplicarHistorico.addEventListener("click", carregarAgendamentosHistorico);
    btnMesAtual.addEventListener("click", () => {
        preencherCamposMesAtual();
        carregarAgendamentosHistorico();
    });
}

function carregarAgendamentosConformeModo() {
    if (modoAgenda === 'dia') {
        carregarAgendamentosDia();
    } else if (modoAgenda === 'semana') {
        carregarAgendamentosSemana();
    }
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
        legendaPeriodoEl.textContent = '';
    }
}

// ----------- FILTRO PROFISSIONAL E CACHE -----------
async function popularFiltroProfissionais() {
    try {
        const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        snapshot.forEach(doc => {
            profissionaisCache[doc.id] = doc.data(); // Adiciona ao cache
            filtroProfissionalEl.appendChild(new Option(doc.data().nome, doc.id));
        });
    } catch (error) {
        mostrarToast("Erro ao buscar profissionais.", "#ef4444");
    }
}

// ----------- CARREGAMENTO DE AGENDAMENTOS (LÓGICA UNIFICADA) -----------
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
        const dataAg = new Date(ag.data + 'T00:00:00');
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

// ----------- MODOS DE CARREGAMENTO ESPECÍFICOS -----------
async function carregarAgendamentosDia() {
    await atualizarLegendaPeriodo();
    const dataSelecionada = inputData.value;
    const constraints = [where("data", "==", dataSelecionada)];
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, `Nenhum agendamento para ${formatarDataBrasileira(dataSelecionada)}.`);
}

async function carregarAgendamentosSemana() {
    await atualizarLegendaPeriodo(); // Espera a legenda atualizar primeiro
    const dataBase = new Date(inputData.value + 'T00:00:00');
    const profissionalId = perfilUsuario === "dono" ? filtroProfissionalEl.value : meuUid;
    const { inicioISO, fimISO } = await getSemanaDeTrabalhoDinamica(dataBase, profissionalId);
    const constraints = [where("data", ">=", inicioISO), where("data", "<=", fimISO)];
    if (profissionalId !== 'todos') {
        constraints.push(where("profissionalId", "==", profissionalId));
    }
    buscarEExibirAgendamentos(constraints, "Nenhum agendamento encontrado para esta semana de trabalho.");
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

// ----------- FUNÇÕES AUXILIARES (sem alterações) -----------
function preencherCamposMesAtual() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    dataInicialEl.value = formatarDataISO(primeiroDia);
    dataFinalEl.value = formatarDataISO(ultimoDia);
}

function exibirMensagemDeErro(mensagem) {
    if (listaAgendamentosDiv) {
        listaAgendamentosDiv.innerHTML = `<p style='color: #ef4444; text-align: center;'>${mensagem}</p>`;
    }
}
