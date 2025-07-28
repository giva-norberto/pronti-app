/**
 * dashboard.js (Versão com Comunicação Corrigida)
 * * Este script foi ajustado para buscar os dados do local correto (a pasta
 * * segura do utilizador autenticado), resolvendo o problema de comunicação
 * * e mantendo todas as fórmulas e funções originais intactas.
 */

// Importações combinadas, incluindo a de autenticação
import { getFirestore, collection, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
import { gerarResumoDiarioInteligente } from './inteligencia.js';

const db = getFirestore(app);
const auth = getAuth(app);

// --- Gatilho Principal ---
// Garante que o código só é executado após a autenticação do utilizador.
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Utilizador está autenticado, podemos carregar o dashboard
            carregarDashboard(user.uid);
        } else {
            // Utilizador não está autenticado, redireciona para o login
            console.log("Nenhum utilizador autenticado. A redirecionar para o login...");
            window.location.href = 'login.html';
        }
    });
});


// --- FUNÇÃO PRINCIPAL QUE ORQUESTRA TUDO (SUA FUNÇÃO ORIGINAL ADAPTADA) ---
async function carregarDashboard(uid) {
  try {
    // CORREÇÃO CRÍTICA: As coleções agora apontam para a pasta segura do utilizador.
    const servicosCollection = collection(db, "users", uid, "servicos");
    const agendamentosCollection = collection(db, "users", uid, "agendamentos");

    // O resto da sua lógica de busca e processamento permanece intacta.
    const [servicosSnapshot, agendamentosSnapshot] = await Promise.all([
      getDocs(servicosCollection),
      getDocs(agendamentosCollection)
    ]);

    const agendamentos = agendamentosSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => {
      servicosMap.set(doc.id, doc.data());
    });

    // Passo 2: Chama a IA com os dados já carregados.
    processarResumoIA(agendamentos, servicosMap);

    // Passo 3: Chama as suas três funções de gráfico.
    if(document.getElementById('graficoServicos')) gerarGraficoServicos(servicosMap, agendamentos);
    if(document.getElementById('graficoFaturamento')) gerarGraficoFaturamento(servicosMap, agendamentos);
    if(document.getElementById('graficoMensal')) gerarGraficoMensal(agendamentos);

  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    const container = document.querySelector('.dashboard-grid') || document.querySelector('.main-content');
    container.innerHTML = '<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
  }
}

// =======================================================
// SEÇÃO DO RESUMO DIÁRIO INTELIGENTE (FUNÇÃO CORRIGIDA)
// =======================================================
function processarResumoIA(todosAgendamentos, servicosMap) {
    const container = document.getElementById('resumo-diario-container');
    if (!container) return;
  
    container.innerHTML = '<p>🧠 Analisando seu dia...</p>';
  
    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));
  
    // --- INÍCIO DA CORREÇÃO ---
    const agendamentosDeHoje = todosAgendamentos.filter(ag => {
        // Verifica se o campo 'horario' existe e se é um objeto Timestamp
        if (!ag.horario || typeof ag.horario.toDate !== 'function') {
          return false;
        }
        // Converte o Timestamp para um objeto Date do JavaScript
        const dataAgendamento = ag.horario.toDate();
        // Compara se a data está dentro do intervalo do dia de hoje
        return dataAgendamento >= inicioDoDia && dataAgendamento <= fimDoDia;
    });
    // --- FIM DA CORREÇÃO ---
  
    const agendamentosEnriquecidos = agendamentosDeHoje.map(ag => {
        const servico = servicosMap.get(ag.servicoId);
        if (!servico) return null;
        
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (servico.duracao || 30) * 60000);
  
        return {
            id: ag.id,
            cliente: { nome: ag.clienteNome || 'Cliente' }, // Corrigido para clienteNome
            servico: { nome: servico.nome || 'Serviço', preco: servico.preco || 0 },
            inicio,
            fim
        };
    }).filter(Boolean);
  
    const resumo = gerarResumoDiarioInteligente(agendamentosEnriquecidos);
    container.innerHTML = criarHTMLDoResumo(resumo);
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
// SEÇÃO DOS GRÁFICOS (SEU CÓDIGO ORIGINAL INTACTO)
// =======================================================
function gerarGraficoServicos(servicosMap, agendamentos) {
  const contagemServicos = {};
  agendamentos.forEach(ag => {
    const servicoId = ag.servicoId;
    contagemServicos[servicoId] = (contagemServicos[servicoId] || 0) + 1;
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
        backgroundColor: ['rgba(255, 99, 132, 0.7)','rgba(54, 162, 235, 0.7)','rgba(255, 206, 86, 0.7)','rgba(75, 192, 192, 0.7)','rgba(153, 102, 255, 0.7)'],
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

function gerarGraficoMensal(agendamentos) {
    const contagemMensal = {};
    agendamentos.forEach(ag => {
        // Verifica se o campo 'horario' é um Timestamp válido
        if (ag.horario && typeof ag.horario.toDate === 'function') {
            const data = ag.horario.toDate();
            // Gera uma chave no formato "Mês de Ano" (ex: "jul. de 2025")
            const mesAno = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            contagemMensal[mesAno] = (contagemMensal[mesAno] || 0) + 1;
        }
    });

    // --- INÍCIO DA CORREÇÃO ---
    // Lógica para ordenar os meses corretamente
    const labelsOrdenados = Object.keys(contagemMensal).sort((a, b) => {
        const meses = {
            'jan.': 0, 'fev.': 1, 'mar.': 2, 'abr.': 3, 'mai.': 4, 'jun.': 5, 
            'jul.': 6, 'ago.': 7, 'set.': 8, 'out.': 9, 'nov.': 10, 'dez.': 11
        };
        
        // Separa "mês." e "ano" da string "mês. de ano"
        const [mesA, , anoA] = a.split(' ');
        const [mesB, , anoB] = b.split(' ');

        const dataA = new Date(anoA, meses[mesA]);
        const dataB = new Date(anoB, meses[mesB]);
        
        return dataA - dataB;
    });
    // --- FIM DA CORREÇÃO ---

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
