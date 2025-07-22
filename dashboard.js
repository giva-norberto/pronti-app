/**
 * dashboard.js (Versão Final Corrigida com IA + Gráficos)
 * * Este script unifica a busca de dados para alimentar tanto
 * a IA quanto os gráficos originais do usuário, resolvendo o conflito anterior.
 */

// Importações combinadas para suportar tanto a IA quanto os gráficos
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";
import { gerarResumoDiarioInteligente } from './inteligencia.js';

const db = getFirestore(app);

// --- Gatilho Principal ---
// Executa a função principal que inicializa todo o dashboard.
document.addEventListener('DOMContentLoaded', carregarDashboard);

// =======================================================
// SEÇÃO DO RESUMO DIÁRIO INTELIGENTE (NOVAS FUNÇÕES)
// =======================================================

/**
 * Filtra os agendamentos de hoje, enriquece os dados e exibe o resumo.
 * Esta função é chamada DENTRO do carregarDashboard após os dados serem buscados.
 */
function processarResumoIA(todosAgendamentos, servicosMap) {
    const container = document.getElementById('resumo-diario-container');
    if (!container) return;

    container.innerHTML = '<p>🧠 Analisando seu dia...</p>';

    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));

    // Filtra apenas os agendamentos de hoje da lista completa que já foi carregada
    const agendamentosDeHoje = todosAgendamentos.filter(ag => {
        if (!ag.horario) return false;
        const dataAgendamento = new Date(ag.horario);
        return dataAgendamento >= inicioDoDia && dataAgendamento <= fimDoDia;
    });

    // Enriquece os dados de hoje com informações de serviço para a IA
    const agendamentosEnriquecidos = agendamentosDeHoje.map(ag => {
        const servico = servicosMap.get(ag.servicoId);
        if (!servico) return null;
        
        const inicio = new Date(ag.horario);
        const fim = new Date(inicio.getTime() + (servico.duracao || 30) * 60000);

        return {
            id: ag.id,
            cliente: { nome: ag.cliente || 'Cliente' },
            servico: { nome: servico.nome || 'Serviço', preco: servico.preco || 0 },
            inicio,
            fim
        };
    }).filter(Boolean); // Remove nulos se o serviço não for encontrado

    const resumo = gerarResumoDiarioInteligente(agendamentosEnriquecidos);
    container.innerHTML = criarHTMLDoResumo(resumo);
}

/**
 * Cria o HTML para o card do Resumo Diário.
 */
function criarHTMLDoResumo(resumo) {
    if (resumo.totalAtendimentos === 0) {
        return `<div class="resumo-card"><h3>Resumo do Dia</h3><p>${resumo.mensagem}</p></div>`;
    }
    let html = `
        <div class="resumo-card">
            <h3>Resumo Diário Inteligente</h3>
            <p>Hoje você tem <strong>${resumo.totalAtendimentos}</strong> atendimentos agendados:</p>
            <ul>
                <li><strong>Primeiro:</strong> ${resumo.primeiro.horario} — ${resumo.primeiro.servico} com ${resumo.primeiro.cliente}</li>
                <li><strong>Último:</strong> ${resumo.ultimo.horario} — ${resumo.ultimo.servico} com ${resumo.ultimo.cliente}</li>
            </ul>
            <div class="resumo-metricas">
                <div class="metrica">
                    <span>💰 Faturamento Estimado</span>
                    <strong>R$ ${resumo.faturamentoEstimado.toFixed(2).replace('.', ',')}</strong>
                </div>`;
    if (resumo.maiorIntervalo) {
        html += `<div class="metrica">
                    <span>🕓 Maior Intervalo</span>
                    <strong>${resumo.maiorIntervalo.inicio} - ${resumo.maiorIntervalo.fim} (${resumo.maiorIntervalo.duracaoMinutos} min)</strong>
                 </div>`;
    }
    html += `</div><p class="resumo-footer">Boa sorte com seu dia! 💪</p></div>`;
    return html;
}


// =======================================================
// SEÇÃO DOS GRÁFICOS (SEU CÓDIGO ORIGINAL INTACTO)
// =======================================================

// --- FUNÇÃO 1: GRÁFICO DE CONTAGEM DE SERVIÇOS (Barras Verticais) ---
function gerarGraficoServicos(servicosMap, agendamentos) {
  const contagemServicos = {};
  agendamentos.forEach(ag => {
    const servicoId = ag.servicoId;
    if (servicoId) {
        contagemServicos[servicoId] = (contagemServicos[servicoId] || 0) + 1;
    }
  });

  const labels = Object.keys(contagemServicos).map(id => servicosMap.get(id)?.nome || 'Desconhecido');
  const dados = Object.values(contagemServicos);

  const ctx = document.getElementById('graficoServicos').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Nº de Agendamentos',
        data: dados,
        backgroundColor: 'rgba(13, 110, 253, 0.5)',
        borderColor: 'rgba(13, 110, 253, 1)',
        borderWidth: 1
      }]
    },
    options: { 
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

// --- FUNÇÃO 2: GRÁFICO DE FATURAMENTO POR SERVIÇO (Barras Horizontais) ---
function gerarGraficoFaturamento(servicosMap, agendamentos) {
  const faturamentoServicos = {};
  agendamentos.forEach(ag => {
    const servico = servicosMap.get(ag.servicoId);
    if (servico && servico.preco !== undefined) {
      const precoNum = parseFloat(servico.preco);
      faturamentoServicos[ag.servicoId] = (faturamentoServicos[ag.servicoId] || 0) + precoNum;
    }
  });

  const labels = Object.keys(faturamentoServicos).map(id => servicosMap.get(id)?.nome || 'Desconhecido');
  const dados = Object.values(faturamentoServicos);

  const ctx = document.getElementById('graficoFaturamento').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Faturamento (R$)',
        data: dados,
        backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)'],
      }]
    },
    options: {
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, title: { display: true, text: 'Faturamento (R$)' } } },
        responsive: true,
        plugins: { legend: { display: false } }
    }
  });
}

// --- FUNÇÃO 3: GRÁFICO DE AGENDAMENTOS POR MÊS (Linha) ---
function gerarGraficoMensal(agendamentos) {
    const contagemMensal = {};
    agendamentos.forEach(ag => {
        if(ag.horario) {
            const data = new Date(ag.horario);
            const mesAno = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            contagemMensal[mesAno] = (contagemMensal[mesAno] || 0) + 1;
        }
    });

    const labelsOrdenados = Object.keys(contagemMensal).sort((a, b) => {
        const meses = { 'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11 };
        // Lógica de ordenação ajustada para ser mais robusta
        const [mesAStr, anoA] = a.replace(/\./g, '').split(' de ');
        const [mesBStr, anoB] = b.replace(/\./g, '').split(' de ');
        const dataA = new Date(anoA, meses[mesAStr]);
        const dataB = new Date(anoB, meses[mesBStr]);
        return dataA - dataB;
    });

    const dados = labelsOrdenados.map(label => contagemMensal[label]);

    const ctx = document.getElementById('graficoMensal').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsOrdenados,
            datasets: [{
                label: 'Total de Agendamentos',
                data: dados,
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// --- FUNÇÃO PRINCIPAL QUE ORQUESTRA TUDO (SUA FUNÇÃO ORIGINAL MODIFICADA) ---
async function carregarDashboard() {
  try {
    const servicosCollection = collection(db, "servicos");
    const agendamentosCollection = collection(db, "agendamentos");

    // Passo 1: Busca os dados uma única vez (sua lógica original)
    const [servicosSnapshot, agendamentosSnapshot] = await Promise.all([
      getDocs(servicosCollection),
      getDocs(agendamentosCollection)
    ]);

    const agendamentos = agendamentosSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => {
      servicosMap.set(doc.id, doc.data());
    });

    // Passo 2: ACRESCENTAR a chamada para a IA com os dados já carregados
    processarResumoIA(agendamentos, servicosMap);

    // Passo 3: Chama as três funções para criar os três gráficos (sua lógica original)
    if(document.getElementById('graficoServicos')) gerarGraficoServicos(servicosMap, agendamentos);
    if(document.getElementById('graficoFaturamento')) gerarGraficoFaturamento(servicosMap, agendamentos);
    if(document.getElementById('graficoMensal')) gerarGraficoMensal(agendamentos);

  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    const container = document.querySelector('.dashboard-grid') || document.querySelector('.main-content');
    container.innerHTML = '<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
  }
}
