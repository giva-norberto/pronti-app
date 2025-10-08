// ======================================================================
//          DASHBOARD.JS (VERSÃO FINAL, COMPLETA E REVISADA)
// =====================================================================

// A importação de 'verificarAcesso' é a fonte dos dados do usuário e empresa.
import { verificarAcesso } from "./userService.js"; 
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from "./inteligencia.js";

// --- VARIÁVEIS GLOBAIS E CONSTANTES ---
let servicosChart;
const STATUS_VALIDOS = ["ativo", "realizado"];

// --- FUNÇÕES DE UTILIDADE ---
function timeStringToMinutes(timeStr  ) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --- FUNÇÕES DE RENDERIZAÇÃO E UI ---

function resetDashboardUI() {
    console.log("[DEBUG] Resetando a UI do Dashboard para estado de carregamento.");
    const spinner = '<span class="loading-spinner"></span>';
    
    document.getElementById('faturamento-realizado').innerHTML = spinner;
    document.getElementById('faturamento-previsto').textContent = '--';
    document.getElementById('total-agendamentos-dia').innerHTML = spinner;
    document.getElementById('agendamentos-pendentes').textContent = '--';
    document.getElementById('resumo-inteligente').innerHTML = spinner;
    
    const fatMensalEl = document.getElementById('faturamento-mensal');
    const agMesEl = document.getElementById('agendamentos-mes');
    if (fatMensalEl) fatMensalEl.innerHTML = spinner;
    if (agMesEl) agMesEl.textContent = '--';

    if (servicosChart) {
        servicosChart.destroy();
        servicosChart = null;
    }
    const graficoContainer = document.getElementById('grafico-container');
    if (graficoContainer && !graficoContainer.querySelector('.loading-spinner')) {
        graficoContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; min-height:320px;"><span class="loading-spinner"></span></div>';
    }
}

function preencherPainel(resumoDia, resumoMes, servicosSemana) {
    // Preenche dados do dia
    document.getElementById('faturamento-realizado').textContent = resumoDia.faturamentoRealizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById('faturamento-previsto').textContent = resumoDia.faturamentoPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById('total-agendamentos-dia').textContent = resumoDia.totalAgendamentosDia;
    document.getElementById('agendamentos-pendentes').textContent = resumoDia.agendamentosPendentes;

    // Preenche dados do mês
    const fatMensalEl = document.getElementById('faturamento-mensal');
    const agMesEl = document.getElementById('agendamentos-mes');
    if (fatMensalEl) fatMensalEl.textContent = resumoMes.faturamentoMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (agMesEl) agMesEl.textContent = resumoMes.agendamentosMes;

    // Preenche Resumo Inteligente
    if (resumoDia.agsParaIA && resumoDia.agsParaIA.length > 0) {
        const resumoInteligente = gerarResumoDiarioInteligente(resumoDia.agsParaIA);
        document.getElementById('resumo-inteligente').innerHTML = resumoInteligente?.mensagem || "<ul><li>Não foi possível gerar o resumo.</li></ul>";
    } else {
        document.getElementById('resumo-inteligente').innerHTML = "<ul><li>Nenhum agendamento no dia para resumir.</li></ul>";
    }

    // Preenche Gráfico
    const graficoContainer = document.getElementById('grafico-container');
    graficoContainer.innerHTML = '<canvas id="servicos-mais-vendidos"></canvas>';
    const ctx = document.getElementById('servicos-mais-vendidos').getContext('2d');
    
    if (servicosChart) servicosChart.destroy();

    servicosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(servicosSemana),
            datasets: [{
                label: 'Vendas na Semana',
                data: Object.values(servicosSemana),
                backgroundColor: '#6366f1',
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// --- FUNÇÕES DE BUSCA DE DADOS (LÓGICA DE NEGÓCIO INALTERADA) ---

async function buscarDadosDoDia(empresaId, data) {
    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(agRef, where("data", "==", data), where("status", "in", STATUS_VALIDOS));
    const snapshot = await getDocs(q);

    let faturamentoRealizado = 0, faturamentoPrevisto = 0, totalAgendamentosDia = 0, agendamentosPendentes = 0;
    const agsParaIA = [];
    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    snapshot.forEach(doc => {
        const ag = doc.data();
        totalAgendamentosDia++;
        faturamentoPrevisto += Number(ag.servicoPreco) || 0;
        if (ag.status === "realizado") {
            faturamentoRealizado += Number(ag.servicoPreco) || 0;
        } else if (ag.status === "ativo") {
            const minutosAg = timeStringToMinutes(ag.horario);
            if (minutosAg >= minutosAgora) {
                agendamentosPendentes++;
            }
        }
        agsParaIA.push({
            inicio: `${ag.data}T${ag.horario}:00`,
            cliente: ag.clienteNome,
            servico: ag.servicoNome,
            servicoPreco: Number(ag.servicoPreco) || 0,
            status: ag.status
        });
    });

    return { faturamentoRealizado, faturamentoPrevisto, totalAgendamentosDia, agendamentosPendentes, agsParaIA };
}

async function buscarDadosDoMes(empresaId) {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const dataISOInicio = primeiroDia.toISOString().split("T")[0];
    const dataISOFim = ultimoDia.toISOString().split("T")[0];

    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(agRef, where("data", ">=", dataISOInicio), where("data", "<=", dataISOFim), where("status", "==", "realizado"));
    const snapshot = await getDocs(q);

    let faturamentoMensal = 0;
    snapshot.forEach(doc => {
        faturamentoMensal += Number(doc.data().servicoPreco) || 0;
    });

    return { faturamentoMensal, agendamentosMes: snapshot.size };
}

async function buscarServicosDaSemana(empresaId) {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 6);
    const dataISOInicio = inicioSemana.toISOString().split("T")[0];
    const dataISOFim = hoje.toISOString().split("T")[0];

    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(agRef, where("data", ">=", dataISOInicio), where("data", "<=", dataISOFim), where("status", "in", STATUS_VALIDOS));
    const snapshot = await getDocs(q);

    const contagem = {};
    snapshot.forEach(doc => {
        const nome = doc.data().servicoNome || "Serviço";
        contagem[nome] = (contagem[nome] || 0) + 1;
    });
    return contagem;
}

// --- FUNÇÃO PRINCIPAL DE ORQUESTRAÇÃO ---

async function carregarDashboard(empresaId, data) {
    console.log(`[DEBUG] Carregando dashboard para empresa ${empresaId} na data ${data}`);
    resetDashboardUI();
    try {
        const [resumoDoDia, resumoDoMes, servicosDaSemana] = await Promise.all([
            buscarDadosDoDia(empresaId, data),
            buscarDadosDoMes(empresaId),
            buscarServicosDaSemana(empresaId)
        ]);
        preencherPainel(resumoDoDia, resumoDoMes, servicosDaSemana);
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        document.getElementById('resumo-inteligente').innerHTML = "<p style='color: red;'>Erro ao carregar dados.</p>";
    }
}

// --- INICIALIZAÇÃO DA PÁGINA (LÓGICA CORRIGIDA) ---

async function inicializarPagina() {
    try {
        // 1. 'verificarAcesso' já garante que o usuário está logado e tem um perfil.
        // Ele também redireciona se necessário, então não precisamos nos preocupar com isso aqui.
        const perfil = await verificarAcesso();
        const empresaId = perfil.empresaId;

        // =================================================================================
        // CORREÇÃO PRINCIPAL: As linhas abaixo, que tentavam carregar e ativar o menu,
        // foram removidas. Essa responsabilidade agora é 100% do 'dashboard.html',
        // que já faz isso da maneira correta usando 'onAuthStateChanged'.
        //
        // LINHAS REMOVIDAS:
        // const response = await fetch('menu-lateral.html');
        // document.getElementById('menu-container').innerHTML = await response.text();
        // const menuModule = await import('./menu-lateral.js');
        // if (menuModule.ativarMenuLateral) menuModule.ativarMenuLateral();
        // =================================================================================

        // 2. Configura o filtro de data com o valor padrão.
        const filtroDataEl = document.getElementById('filtro-data');
        filtroDataEl.value = new Date().toISOString().split('T')[0];
        
        // 3. Carrega os dados do dashboard com a empresa e data corretas.
        await carregarDashboard(empresaId, filtroDataEl.value);

        // 4. Adiciona os listeners para interatividade da página.
        filtroDataEl.addEventListener('change', debounce(() => {
            carregarDashboard(empresaId, filtroDataEl.value);
        }, 300));

        window.addEventListener('empresaAtivaTroca', () => {
            location.reload();
        });

    } catch (error) {
        // 'verificarAcesso' já trata o redirecionamento, então só logamos outros erros.
        if (error && !error.message.includes("Redirecionando")) {
            console.error("Falha crítica na inicialização do dashboard:", error);
        }
    }
}

// Inicia todo o processo quando o DOM da página estiver pronto.
window.addEventListener('DOMContentLoaded', inicializarPagina);
