import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// Se você tem o arquivo firebase-config.js, mantenha. Senão, defina aqui:
const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      carregarDashboard(user.uid);
    } else {
      window.location.href = 'login.html';
    }
  });
});

async function carregarDashboard(uid) {
  try {
    const servicosCollection = collection(db, "users", uid, "servicos");
    const agendamentosCollection = collection(db, "users", uid, "agendamentos");

    const [servicosSnapshot, agendamentosSnapshot] = await Promise.all([
      getDocs(servicosCollection),
      getDocs(agendamentosCollection)
    ]);

    const agendamentos = agendamentosSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => {
      servicosMap.set(doc.id, doc.data());
    });

    processarResumoIA(agendamentos, servicosMap);

    if(document.getElementById('graficoServicos')) gerarGraficoServicos(servicosMap, agendamentos);
    if(document.getElementById('graficoFaturamento')) gerarGraficoFaturamento(servicosMap, agendamentos);
    if(document.getElementById('graficoMensal')) gerarGraficoMensal(agendamentos);

  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    const container = document.querySelector('.dashboard-grid') || document.querySelector('.main-content');
    if (container) {
      container.innerHTML = '<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
    }
  }
}

// Resumo IA
function processarResumoIA(todosAgendamentos, servicosMap) {
  const container = document.getElementById('resumo-diario-container');
  if (!container) return;

  container.innerHTML = '<p>🧠 Analisando seu dia...</p>';

  const hoje = new Date();
  const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
  const fimDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);

  const agendamentosDeHoje = todosAgendamentos.filter(ag => {
    if (!ag.horario || typeof ag.horario.toDate !== 'function') {
      return false;
    }
    const dataAgendamento = ag.horario.toDate();
    return dataAgendamento >= inicioDoDia && dataAgendamento <= fimDoDia;
  });

  const agendamentosEnriquecidos = agendamentosDeHoje.map(ag => {
    const servico = servicosMap.get(ag.servicoId);
    if (!servico) return null;
    const inicio = ag.horario.toDate();
    const fim = new Date(inicio.getTime() + (servico.duracao || 30) * 60000);
    return {
      id: ag.id,
      cliente: { nome: ag.clienteNome || 'Cliente' },
      servico: { nome: servico.nome || 'Serviço', preco: servico.preco || 0 },
      inicio,
      fim
    };
  }).filter(Boolean);

  const resumo = gerarResumoDiarioInteligente(agendamentosEnriquecidos);
  container.innerHTML = criarHTMLDoResumo(resumo);
}

// Função IA
function gerarResumoDiarioInteligente(agendamentos) {
  if (!Array.isArray(agendamentos) || agendamentos.length === 0) {
    return { totalAtendimentos: 0, mensagem: "Nenhum agendamento para hoje." };
  }
  const ord = [...agendamentos].sort((a, b) => a.inicio - b.inicio);
  const total = ord.length;
  let faturamento = 0;
  ord.forEach(a => faturamento += Number(a.servico.preco) || 0);

  const primeiro = {
    horario: formatHora(ord[0].inicio),
    servico: ord[0].servico.nome,
    cliente: ord[0].cliente.nome
  };
  const ultimo = {
    horario: formatHora(ord[ord.length - 1].inicio),
    servico: ord[ord.length - 1].servico.nome,
    cliente: ord[ord.length - 1].cliente.nome
  };

  let maiorIntervalo = null;
  for (let i = 0; i < ord.length - 1; i++) {
    const fimAtual = ord[i].fim, inicioProx = ord[i + 1].inicio;
    const durMin = Math.round((inicioProx - fimAtual) / 60000);
    if (durMin > 0 && (!maiorIntervalo || durMin > maiorIntervalo.duracaoMinutos)) {
      maiorIntervalo = {
        duracaoMinutos: durMin,
        inicio: formatHora(fimAtual),
        fim: formatHora(inicioProx)
      };
    }
  }
  return {
    totalAtendimentos: total,
    mensagem: `Você tem ${total} atendimentos hoje. Faturamento estimado: R$ ${faturamento.toFixed(2).replace('.',',')}.`,
    primeiro, ultimo, faturamentoEstimado: faturamento, maiorIntervalo
  };
}
function formatHora(date) {
  return date instanceof Date ? String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0') : '';
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

// GRÁFICOS
let graficoMensalInstance = null;
function gerarGraficoMensal(agendamentos) {
  const filtroMesInicio = document.getElementById('filtro-mes-inicio');
  const filtroAnoInicio = document.getElementById('filtro-ano-inicio');
  const filtroMesFim = document.getElementById('filtro-mes-fim');
  const filtroAnoFim = document.getElementById('filtro-ano-fim');
  if (!filtroMesInicio || !filtroAnoInicio || !filtroMesFim || !filtroAnoFim) return;
  const anos = [...new Set(
    agendamentos
      .filter(ag => ag.horario && typeof ag.horario.toDate === 'function')
      .map(ag => ag.horario.toDate().getFullYear())
  )];
  anos.sort((a, b) => b - a);

  filtroAnoInicio.innerHTML = '';
  filtroAnoFim.innerHTML = '';
  anos.forEach(ano => {
    const option1 = document.createElement('option');
    option1.value = ano;
    option1.textContent = ano;
    filtroAnoInicio.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = ano;
    option2.textContent = ano;
    filtroAnoFim.appendChild(option2);
  });

  filtroMesInicio.value = '0';
  filtroAnoInicio.value = anos[0] || new Date().getFullYear();
  filtroMesFim.value = '11';
  filtroAnoFim.value = anos[0] || new Date().getFullYear();

  const atualizarGrafico = () => {
    const dataInicio = new Date(filtroAnoInicio.value, filtroMesInicio.value, 1);
    const dataFim = new Date(filtroAnoFim.value, parseInt(filtroMesFim.value) + 1, 0);
    dataFim.setHours(23, 59, 59, 999);

    const agendamentosFiltrados = agendamentos.filter(ag => {
      if (!ag.horario || typeof ag.horario.toDate !== 'function') return false;
      const dataAgendamento = ag.horario.toDate();
      return dataAgendamento >= dataInicio && dataAgendamento <= dataFim;
    });

    const contagemMensal = {};
    agendamentosFiltrados.forEach(ag => {
      const data = ag.horario.toDate();
      const mesAno = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      contagemMensal[mesAno] = (contagemMensal[mesAno] || 0) + 1;
    });

    const labelsOrdenados = Object.keys(contagemMensal).sort((a, b) => {
      const meses = { 'jan.':0, 'fev.':1, 'mar.':2, 'abr.':3, 'mai.':4, 'jun.':5, 'jul.':6, 'ago.':7, 'set.':8, 'out.':9, 'nov.':10, 'dez.':11 };
      const [mesAStr, , anoA] = a.split(' ');
      const [mesBStr, , anoB] = b.split(' ');
      const dataA = new Date(anoA, meses[mesAStr.toLowerCase().replace('.', '')]);
      const dataB = new Date(anoB, meses[mesBStr.toLowerCase().replace('.', '')]);
      return dataA - dataB;
    });

    const dados = labelsOrdenados.map(label => contagemMensal[label]);

    if (graficoMensalInstance) {
      graficoMensalInstance.destroy();
    }
    const ctx = document.getElementById('graficoMensal').getContext('2d');
    graficoMensalInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: labelsOrdenados,
        datasets: [{
          label: 'Total de Agendamentos',
          data: dados,
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        }]
      },
      plugins: (typeof window.ChartDataLabels !== "undefined") ? [window.ChartDataLabels] : [],
      options: {
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: Math.round,
            font: { weight: 'bold' }
          }
        }
      }
    });
  };
  filtroMesInicio.addEventListener('change', atualizarGrafico);
  filtroAnoInicio.addEventListener('change', atualizarGrafico);
  filtroMesFim.addEventListener('change', atualizarGrafico);
  filtroAnoFim.addEventListener('change', atualizarGrafico);
  atualizarGrafico();
}

function gerarGraficoServicos(servicosMap, agendamentos) {
  const contagemServicos = {};
  agendamentos.forEach(ag => {
    const servicoId = ag.servicoId;
    contagemServicos[servicoId] = (contagemServicos[servicoId] || 0) + 1;
  });
  const labels = Object.keys(contagemServicos).map(id => servicosMap.get(id)?.nome || 'Desconhecido');
  const dados = Object.values(contagemServicos);
  const ctx = document.getElementById('graficoServicos').getContext('2d');
  new window.Chart(ctx, {
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
  new window.Chart(ctx, {
    type: 'bar',
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
          'rgba(153, 102, 255, 0.7)'
        ],
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
