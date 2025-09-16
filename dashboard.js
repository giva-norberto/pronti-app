// ======================================================================
//          DASHBOARD.JS (VERSÃO FINAL, COMPLETA E REVISADA)
// ======================================================================

import { verificarAcesso } from "./userService.js";
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from "./inteligencia.js";

// --- VARIÁVEIS GLOBAIS E CONSTANTES ---
let servicosChart;
const STATUS_VALIDOS = ["ativo", "realizado"];

// --- FUNÇÕES DE UTILIDADE ---
function timeStringToMinutes(timeStr ) {
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

    if (servicosChart) {
        servicosChart.destroy();
        servicosChart = null;
    }
    // Garante que o canvas esteja visível para o Chart.js, mas o contêiner pode mostrar um loading
    const graficoContainer = document.getElementById('grafico-container');
    if (graficoContainer && !graficoContainer.querySelector('.loading-spinner')) {
        graficoContainer.innerHTML = '<span class="loading-spinner"></span>';
    }
}

function preencherPainel(resumo, servicosSemana) {
    document.getElementById('faturamento-realizado').textContent = resumo.faturamentoRealizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById('faturamento-previsto').textContent = resumo.faturamentoPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById('total-agendamentos-dia').textContent = resumo.totalAgendamentosDia;
    document.getElementById('agendamentos-pendentes').textContent = resumo.agendamentosPendentes;

    if (resumo.agsParaIA && resumo.agsParaIA.length > 0) {
        const resumoInteligente = gerarResumoDiarioInteligente(resumo.agsParaIA);
        document.getElementById('resumo-inteligente').innerHTML = resumoInteligente?.mensagem || "<ul><li>Não foi possível gerar o resumo.</li></ul>";
    } else {
        document.getElementById('resumo-inteligente').innerHTML = "<ul><li>Nenhum agendamento no dia para resumir.</li></ul>";
    }

    const graficoContainer = document.getElementById('grafico-container');
    graficoContainer.innerHTML = '<canvas id="servicos-mais-vendidos"></canvas>'; // Limpa o spinner e adiciona o canvas
    const ctx = document.getElementById('servicos-mais-vendidos').getContext('2d');
    
    if (servicosChart) { // Garante que a instância anterior seja destruída
        servicosChart.destroy();
    }

    servicosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(servicosSemana),
            datasets: [{
                label: 'Vendas da Semana',
                data: Object.values(servicosSemana),
                backgroundColor: ['#6366f1', '#4f46e5', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff'],
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- FUNÇÕES DE BUSCA DE DADOS ---

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
        const [resumoDoDia, servicosDaSemana] = await Promise.all([
            buscarDadosDoDia(empresaId, data),
            buscarServicosDaSemana(empresaId)
        ]);
        preencherPainel(resumoDoDia, servicosDaSemana);
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        document.getElementById('resumo-inteligente').innerHTML = "<p style='color: red;'>Erro ao carregar dados.</p>";
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---

async function inicializarPagina() {
    try {
        const perfil = await verificarAcesso();
        const empresaId = perfil.empresaId;

        // Carregar menu lateral
        const response = await fetch('menu-lateral.html');
        document.getElementById('menu-container').innerHTML = await response.text();
        const menuModule = await import('./menu-lateral.js');
        if (menuModule.ativarMenuLateral) menuModule.ativarMenuLateral();

        const filtroDataEl = document.getElementById('filtro-data');
        filtroDataEl.value = new Date().toISOString().split('T')[0];
        
        // Carregamento inicial
        await carregarDashboard(empresaId, filtroDataEl.value);

        // Listener para mudança de data
        filtroDataEl.addEventListener('change', debounce(() => {
            carregarDashboard(empresaId, filtroDataEl.value);
        }, 300));

        // Listener para troca de empresa (se o menu lateral emitir este evento)
        window.addEventListener('empresaAtivaTroca', () => {
            console.log("[DEBUG] Evento de troca de empresa detectado. Recarregando dashboard...");
            location.reload(); // A forma mais segura de garantir um estado limpo
        });

    } catch (error) {
        if (error && !error.message.includes("Redirecionando")) {
            console.error("Falha crítica na inicialização do dashboard:", error);
        }
    }
}

window.addEventListener('DOMContentLoaded', inicializarPagina);
