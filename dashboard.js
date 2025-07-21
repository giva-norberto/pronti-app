import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

// --- FUNÇÃO 1: GRÁFICO DE CONTAGEM DE SERVIÇOS (Barras Verticais) ---
function gerarGraficoServicos(servicosMap, agendamentos) {
  const contagemServicos = {};
  agendamentos.forEach(ag => {
    const servicoId = ag.servicoId;
    contagemServicos[servicoId] = (contagemServicos[servicoId] || 0) + 1;
  });

  const labels = [];
  const dados = [];
  for (const servicoId in contagemServicos) {
    labels.push(servicosMap.get(servicoId)?.nome || 'Desconhecido');
    dados.push(contagemServicos[servicoId]);
  }

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

  const labels = [];
  const dados = [];
  for (const servicoId in faturamentoServicos) {
    labels.push(servicosMap.get(servicoId)?.nome || 'Desconhecido');
    dados.push(faturamentoServicos[servicoId]);
  }

  const ctx = document.getElementById('graficoFaturamento').getContext('2d');
  new Chart(ctx, {
    type: 'bar', // Tipo 'bar'
    data: {
      labels: labels,
      datasets: [{
        label: 'Faturamento (R$)',
        data: dados,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
        ],
      }]
    },
    options: {
        indexAxis: 'y', // ESSA LINHA TRANSFORMA EM BARRAS HORIZONTAIS
        scales: {
            x: { // Eixo X (horizontal) é o de valores
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Faturamento (R$)'
                }
            }
        },
        responsive: true,
        plugins: {
            legend: {
                display: false 
            }
        }
    }
  });
}

// --- FUNÇÃO 3: GRÁFICO DE AGENDAMENTOS POR MÊS (Linha) ---
function gerarGraficoMensal(agendamentos) {
    const contagemMensal = {};
    agendamentos.forEach(ag => {
        const data = new Date(ag.horario);
        const mesAno = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        contagemMensal[mesAno] = (contagemMensal[mesAno] || 0) + 1;
    });

    const labelsOrdenados = Object.keys(contagemMensal).sort((a, b) => {
        const [mesA, anoA] = a.split('/');
        const [mesB, anoB] = b.split('/');
        const meses = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
        const dataA = new Date(anoA, meses[mesA.replace('.','')]);
        const dataB = new Date(anoB, meses[mesB.replace('.','')]);
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

// --- FUNÇÃO PRINCIPAL QUE ORQUESTRA TUDO ---
async function carregarDashboard() {
  try {
    const servicosCollection = collection(db, "servicos");
    const agendamentosCollection = collection(db, "agendamentos");

    const [servicosSnapshot, agendamentosSnapshot] = await Promise.all([
      getDocs(servicosCollection),
      getDocs(agendamentosCollection)
    ]);

    const agendamentos = agendamentosSnapshot.docs.map(doc => doc.data());
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => {
      servicosMap.set(doc.id, doc.data());
    });

    // Chama as três funções para criar os três gráficos
    if(document.getElementById('graficoServicos')) gerarGraficoServicos(servicosMap, agendamentos);
    if(document.getElementById('graficoFaturamento')) gerarGraficoFaturamento(servicosMap, agendamentos);
    if(document.getElementById('graficoMensal')) gerarGraficoMensal(agendamentos);

  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    const container = document.querySelector('.dashboard-grid') || document.querySelector('.main-content');
    container.innerHTML = '<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
  }
}

// Executa a função principal para carregar o dashboard
carregarDashboard();