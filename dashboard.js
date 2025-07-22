/**
 * dashboard.js (Versão Final, com IA e Gráficos)
 * * Este script é o coração do dashboard. Ele carrega tanto o
 * Resumo Diário Inteligente quanto os gráficos de métricas do negócio.
 */

// Importações essenciais do Firebase e dos seus módulos locais
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from './inteligencia.js';

// --- Gatilho Principal ---
document.addEventListener('DOMContentLoaded', async () => {
    // Executa o carregamento do resumo e dos gráficos em paralelo para mais performance
    await Promise.all([
        exibirResumoDiario(),
        carregarGraficos()
    ]);
});

// =======================================================
// SEÇÃO DO RESUMO DIÁRIO INTELIGENTE
// =======================================================

async function exibirResumoDiario() {
    const container = document.getElementById('resumo-diario-container');
    if (!container) return;
    container.innerHTML = '<p>🧠 Analisando seu dia...</p>';
    try {
        const agendamentosEnriquecidos = await buscarEEnriquecerAgendamentosDeHoje();
        const resumo = gerarResumoDiarioInteligente(agendamentosEnriquecidos);
        container.innerHTML = criarHTMLDoResumo(resumo);
    } catch (error) {
        console.error("Erro ao gerar resumo diário:", error);
        container.innerHTML = '<p class="erro">❌ Ops! Não foi possível carregar o resumo do dia.</p>';
    }
}

async function buscarEEnriquecerAgendamentosDeHoje() {
    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999)).toISOString();
    const agendamentosRef = collection(db, "agendamentos");
    const q = query(agendamentosRef, where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const querySnapshot = await getDocs(q);
    const promessasAgendamentos = querySnapshot.docs.map(async (agendamentoDoc) => {
        const agendamentoData = agendamentoDoc.data();
        if (!agendamentoData.servicoId) return null;
        const servicoRef = doc(db, "servicos", agendamentoData.servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (!servicoSnap.exists()) return null;
        const servicoData = servicoSnap.data();
        const inicio = new Date(agendamentoData.horario);
        const fim = new Date(inicio.getTime() + (servicoData.duracao || 30) * 60000);
        return {
            id: agendamentoDoc.id,
            cliente: { nome: agendamentoData.cliente || 'Cliente' },
            servico: { nome: servicoData.nome || 'Serviço', preco: servicoData.preco || 0 },
            inicio,
            fim
        };
    });
    const resultados = await Promise.all(promessasAgendamentos);
    return resultados.filter(res => res !== null);
}

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
// SEÇÃO DOS GRÁFICOS
// =======================================================

/**
 * Função principal que busca todos os dados necessários e chama as funções
 * que renderizam cada um dos gráficos.
 */
async function carregarGraficos() {
    try {
        console.log("Buscando dados para os gráficos...");
        const agendamentosSnapshot = await getDocs(collection(db, "agendamentos"));
        const servicosSnapshot = await getDocs(collection(db, "servicos"));

        // Mapeia os dados para um formato mais fácil de usar
        const todosAgendamentos = agendamentosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const todosServicos = new Map(servicosSnapshot.docs.map(doc => [doc.id, doc.data()]));

        console.log("Dados carregados. Renderizando gráficos...");
        carregarGraficoServicosMaisAgendados(todosAgendamentos, todosServicos);
        carregarGraficoFaturamentoPorServico(todosAgendamentos, todosServicos);
        carregarGraficoAgendamentosMensal(todosAgendamentos);

    } catch (error) {
        console.error("Erro ao carregar dados para os gráficos:", error);
    }
}

/**
 * Cria o gráfico de "Serviços Mais Agendados" (Pizza).
 */
function carregarGraficoServicosMaisAgendados(agendamentos, servicos) {
    const contagemServicos = agendamentos.reduce((acc, agendamento) => {
        const servicoId = agendamento.servicoId;
        if (servicoId) {
            acc[servicoId] = (acc[servicoId] || 0) + 1;
        }
        return acc;
    }, {});

    const labels = Object.keys(contagemServicos).map(id => servicos.get(id)?.nome || 'Serviço Desconhecido');
    const data = Object.values(contagemServicos);

    new Chart(document.getElementById('graficoServicos'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Agendamentos',
                data: data,
                backgroundColor: ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/**
 * Cria o gráfico de "Faturamento por Serviço" (Barras).
 */
function carregarGraficoFaturamentoPorServico(agendamentos, servicos) {
    const faturamentoServicos = agendamentos.reduce((acc, agendamento) => {
        const servicoId = agendamento.servicoId;
        const servico = servicos.get(servicoId);
        if (servico && servico.preco) {
            acc[servicoId] = (acc[servicoId] || 0) + parseFloat(servico.preco);
        }
        return acc;
    }, {});

    const labels = Object.keys(faturamentoServicos).map(id => servicos.get(id)?.nome || 'Serviço Desconhecido');
    const data = Object.values(faturamentoServicos);

    new Chart(document.getElementById('graficoFaturamento'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento (R$)',
                data: data,
                backgroundColor: '#6366f1',
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });
}

/**
 * Cria o gráfico de "Agendamentos por Mês" (Linha).
 */
function carregarGraficoAgendamentosMensal(agendamentos) {
    const contagemMensal = agendamentos.reduce((acc, agendamento) => {
        const mes = new Date(agendamento.horario).getMonth(); // 0 = Janeiro, 11 = Dezembro
        acc[mes] = (acc[mes] || 0) + 1;
        return acc;
    }, {});

    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = Array(12).fill(0);
    for (const mes in contagemMensal) {
        data[mes] = contagemMensal[mes];
    }

    new Chart(document.getElementById('graficoMensal'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Agendamentos',
                data: data,
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
