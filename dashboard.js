// dashboard-completo.js
// Tudo em um: Firebase v10.7.1 + IA (resumo) + gráficos (Chart.js)
// ---------------------------------------------------------------
// Substitua as credenciais em firebaseConfig abaixo antes de publicar.
// ---------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// -----------------------------
// CONFIGURAÇÃO FIREBASE (ATUALIZE)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
// -----------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---------- Helpers de formatação ----------
function pad2(n){ return String(n).padStart(2,'0'); }
function formatHora(date){
  if(!(date instanceof Date)) return '';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function formatDateTime(date){
  if(!(date instanceof Date)) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth()+1)}/${date.getFullYear()} ${formatHora(date)}`;
}

// ======================
// === IA: Resumo Diário
// ======================
/**
 * Recebe uma lista de agendamentos enriquecidos:
 * cada item: { id, cliente: { nome }, servico: { nome, preco }, inicio: Date, fim: Date }
 * Retorna objeto com { totalAtendimentos, mensagem, primeiro, ultimo, faturamentoEstimado, maiorIntervalo }
 */
function gerarResumoDiarioInteligente(agendamentosEnriquecidos){
  if(!Array.isArray(agendamentosEnriquecidos) || agendamentosEnriquecidos.length === 0){
    return { totalAtendimentos: 0, mensagem: "Nenhum agendamento para hoje." };
  }

  // Ordena por início
  const ord = [...agendamentosEnriquecidos].sort((a,b)=>a.inicio - b.inicio);

  const total = ord.length;
  let faturamentoEstimado = 0;
  const contagemServicos = {};

  ord.forEach(a=>{
    const preco = Number(a.servico.preco) || 0;
    faturamentoEstimado += preco;
    const nomeServ = a.servico.nome || 'Serviço';
    contagemServicos[nomeServ] = (contagemServicos[nomeServ]||0) + 1;
  });

  // Primeiro e último
  const primeiro = {
    horario: formatHora(ord[0].inicio),
    servico: ord[0].servico.nome || 'Serviço',
    cliente: ord[0].cliente.nome || 'Cliente'
  };
  const ultimo = {
    horario: formatHora(ord[ord.length-1].inicio),
    servico: ord[ord.length-1].servico.nome || 'Serviço',
    cliente: ord[ord.length-1].cliente.nome || 'Cliente'
  };

  // Maior intervalo entre agendamentos (considera intervalo entre fim de um e início do próximo)
  let maiorIntervalo = null;
  for(let i=0;i<ord.length-1;i++){
    const fimAtual = ord[i].fim;
    const inicioProx = ord[i+1].inicio;
    const durMs = inicioProx - fimAtual;
    const durMin = Math.round(durMs / 60000);
    if(durMin > 0){
      if(!maiorIntervalo || durMin > maiorIntervalo.duracaoMinutos){
        maiorIntervalo = {
          indexInicio: i,
          indexFim: i+1,
          duracaoMinutos: durMin,
          inicio: formatHora(fimAtual),
          fim: formatHora(inicioProx)
        };
      }
    }
  }

  const mensagem = `Você tem ${total} atendimentos hoje. Faturamento estimado: R$ ${faturamentoEstimado.toFixed(2).replace('.',',')}.`;

  return {
    totalAtendimentos: total,
    mensagem,
    primeiro,
    ultimo,
    faturamentoEstimado,
    maiorIntervalo
  };
}

// ======================
// === Funções do DOM & Gráficos
// ======================
let graficoMensalInstance = null;
let graficoServicosInstance = null;
let graficoFaturamentoInstance = null;

// Cria HTML do resumo (compatível com o seu layout)
function criarHTMLDoResumo(resumo){
  if(!resumo) return '';
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

// ---------- Gerar gráfico mensal com filtros ----------
function gerarGraficoMensal(agendamentos){
  const filtroMesInicio = document.getElementById('filtro-mes-inicio');
  const filtroAnoInicio = document.getElementById('filtro-ano-inicio');
  const filtroMesFim = document.getElementById('filtro-mes-fim');
  const filtroAnoFim = document.getElementById('filtro-ano-fim');
  const canvas = document.getElementById('graficoMensal');
  if(!canvas) return;

  // popula anos se selects existirem e vazios
  const anos = [...new Set(
    agendamentos
      .filter(ag => ag.horario && typeof ag.horario.toDate === 'function')
      .map(ag => ag.horario.toDate().getFullYear())
  )].sort((a,b)=>b-a);

  if(filtroAnoInicio && filtroAnoFim){
    filtroAnoInicio.innerHTML = '';
    filtroAnoFim.innerHTML = '';
    anos.forEach(ano=>{
      const o1 = document.createElement('option'); o1.value = ano; o1.textContent = ano; filtroAnoInicio.appendChild(o1);
      const o2 = document.createElement('option'); o2.value = ano; o2.textContent = ano; filtroAnoFim.appendChild(o2);
    });
    // valores padrão modernos: caso o array esteja vazio, usa ano atual
    if(!anos.length){
      const anoAtual = new Date().getFullYear();
      const opt1 = document.createElement('option'); opt1.value = anoAtual; opt1.textContent = anoAtual; filtroAnoInicio.appendChild(opt1);
      const opt2 = document.createElement('option'); opt2.value = anoAtual; opt2.textContent = anoAtual; filtroAnoFim.appendChild(opt2);
    }
  }

  // define padrões (se existirem)
  if(filtroMesInicio) filtroMesInicio.value = filtroMesInicio.value || '0';
  if(filtroMesFim) filtroMesFim.value = filtroMesFim.value || '11';
  if(filtroAnoInicio) filtroAnoInicio.value = filtroAnoInicio.value || (anos[0] || new Date().getFullYear());
  if(filtroAnoFim) filtroAnoFim.value = filtroAnoFim.value || (anos[0] || new Date().getFullYear());

  const atualizarGrafico = () => {
    const inicioAno = Number(filtroAnoInicio?.value || new Date().getFullYear());
    const inicioMes = Number(filtroMesInicio?.value || 0);
    const fimAno = Number(filtroAnoFim?.value || new Date().getFullYear());
    const fimMes = Number(filtroMesFim?.value || 11);

    const dataInicio = new Date(inicioAno, inicioMes, 1, 0, 0, 0, 0);
    const dataFim = new Date(fimAno, fimMes, 1);
    dataFim.setMonth(dataFim.getMonth()+1);
    dataFim.setDate(0); // último dia do mês
    dataFim.setHours(23,59,59,999);

    const filtrados = agendamentos.filter(ag => ag.horario && typeof ag.horario.toDate === 'function' && (() => {
      const d = ag.horario.toDate();
      return d >= dataInicio && d <= dataFim;
    })());

    const contagem = {};
    filtrados.forEach(ag=>{
      const d = ag.horario.toDate();
      const mesAno = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      contagem[mesAno] = (contagem[mesAno] || 0) + 1;
    });

    // ordena por data real
    const labels = Object.keys(contagem).sort((a,b)=>{
      const [mesAStr, anoA] = a.split(' ');
      const [mesBStr, anoB] = b.split(' ');
      const meses = {jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
      const mA = meses[mesAStr.replace('.','').toLowerCase()] ?? 0;
      const mB = meses[mesBStr.replace('.','').toLowerCase()] ?? 0;
      return new Date(Number(anoA), mA) - new Date(Number(anoB), mB);
    });
    const data = labels.map(l=>contagem[l]);

    if(graficoMensalInstance) graficoMensalInstance.destroy();
    const ctx = canvas.getContext('2d');
    graficoMensalInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total de Agendamentos',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        }]
      },
      plugins: (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [],
      options: {
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: 'top', formatter: Math.round, font: { weight: 'bold' } }
        },
        responsive: true
      }
    });
  };

  // listeners
  [filtroMesInicio, filtroAnoInicio, filtroMesFim, filtroAnoFim].forEach(el=>{
    if(el) el.addEventListener('change', atualizarGrafico);
  });

  atualizarGrafico();
}

// ---------- Gerar gráfico de serviços ----------
function gerarGraficoServicos(servicosMap, agendamentos){
  const canvas = document.getElementById('graficoServicos');
  if(!canvas) return;

  const contagem = {};
  agendamentos.forEach(ag=>{
    const id = ag.servicoId;
    contagem[id] = (contagem[id] || 0) + 1;
  });

  const labels = Object.keys(contagem).map(id => servicosMap.get(id)?.nome || 'Desconhecido');
  const data = Object.values(contagem);

  if(graficoServicosInstance) graficoServicosInstance.destroy();
  const ctx = canvas.getContext('2d');
  graficoServicosInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Nº de Agendamentos',
        data,
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

// ---------- Gerar gráfico de faturamento ----------
function gerarGraficoFaturamento(servicosMap, agendamentos){
  const canvas = document.getElementById('graficoFaturamento');
  if(!canvas) return;

  const fatur = {};
  agendamentos.forEach(ag=>{
    const s = servicosMap.get(ag.servicoId);
    if(s && s.preco !== undefined){
      const p = parseFloat(s.preco) || 0;
      fatur[ag.servicoId] = (fatur[ag.servicoId] || 0) + p;
    }
  });

  const labels = Object.keys(fatur).map(id => servicosMap.get(id)?.nome || 'Desconhecido');
  const data = Object.values(fatur);

  if(graficoFaturamentoInstance) graficoFaturamentoInstance.destroy();
  const ctx = canvas.getContext('2d');
  graficoFaturamentoInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Faturamento (R$)',
        data,
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

// ======================
// === Carregar Dashboard
// ======================
async function carregarDashboard(uid){
  try{
    // Coleções dentro do usuário (mesmo padrão que você tinha)
    const servicosCollection = collection(db, "users", uid, "servicos");
    const agendamentosCollection = collection(db, "users", uid, "agendamentos");

    const [servicosSnapshot, agendamentosSnapshot] = await Promise.all([
      getDocs(servicosCollection),
      getDocs(agendamentosCollection)
    ]);

    const agendamentos = agendamentosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => servicosMap.set(doc.id, doc.data()));

    // processar resumo IA (enriquecer agendamentos com datas e duracao)
    processarResumoIA(agendamentos, servicosMap);

    // gráficos
    if(document.getElementById('graficoServicos')) gerarGraficoServicos(servicosMap, agendamentos);
    if(document.getElementById('graficoFaturamento')) gerarGraficoFaturamento(servicosMap, agendamentos);
    if(document.getElementById('graficoMensal')) gerarGraficoMensal(agendamentos);

  } catch(err){
    console.error("Erro ao carregar dados do dashboard:", err);
    const container = document.querySelector('.dashboard-grid') || document.querySelector('.main-content');
    if(container) container.innerHTML = '<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
  }
}

function processarResumoIA(todosAgendamentos, servicosMap){
  const container = document.getElementById('resumo-diario-container');
  if(!container) return;

  container.innerHTML = '<p>🧠 Analisando seu dia...</p>';

  const hoje = new Date();
  const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0,0,0,0);
  const fimDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23,59,59,999);

  // filtra apenas os agendamentos com campo 'horario' (Timestamp)
  const agendamentosDeHoje = todosAgendamentos.filter(ag => ag.horario && typeof ag.horario.toDate === 'function').filter(ag=>{
    const d = ag.horario.toDate();
    return d >= inicioDoDia && d <= fimDoDia;
  });

  // enriquece com inicio/fim e informações do serviço/cliente
  const agendamentosEnriquecidos = agendamentosDeHoje.map(ag=>{
    const servico = servicosMap.get(ag.servicoId);
    if(!servico) return null;
    const inicio = ag.horario.toDate();
    const durMin = Number(servico.duracao) || 30;
    const fim = new Date(inicio.getTime() + durMin * 60000);
    return {
      id: ag.id,
      cliente: { nome: ag.clienteNome || ag.cliente?.nome || 'Cliente' },
      servico: { nome: servico.nome || 'Serviço', preco: servico.preco || 0, duracao: durMin },
      inicio,
      fim
    };
  }).filter(Boolean);

  const resumo = gerarResumoDiarioInteligente(agendamentosEnriquecidos);
  container.innerHTML = criarHTMLDoResumo(resumo);
}

// ======================
// === Inicialização (autenticação)
// ======================
document.addEventListener('DOMContentLoaded', () => {
  // Garante que Chart (global) esteja pronto — você deve incluir Chart.js antes deste módulo no HTML
  onAuthStateChanged(auth, (user) => {
    if(user){
      carregarDashboard(user.uid);
    } else {
      // Se não está logado, redireciona (mesmo comportamento do seu original)
      // Evita redirecionamento automático se estiver em ambiente de dev local sem login:
      try {
        window.location.href = 'login.html';
      } catch(e){
        console.warn('Redirecionamento falhou:', e);
      }
    }
  });
});
