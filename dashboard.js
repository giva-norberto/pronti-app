/**
 * dashboard.js - Versão Final com Filtro de Intervalo e Melhorias Visuais
 */

import { getFirestore, collection, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
import { gerarResumoDiarioInteligente } from './inteligencia.js';

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
    container.innerHTML = '<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
  }
}

function processarResumoIA(todosAgendamentos, servicosMap) {
    const container = document.getElementById('resumo-diario-container');
    if (!container) return;
  
    container.innerHTML = '<p>🧠 Analisando seu dia...</p>';
  
    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));
  
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
let graficoMensalInstance = null;

function gerarGraficoMensal(agendamentos) {
    const filtroMesInicio = document.getElementById('filtro-mes-inicio');
    const filtroAnoInicio = document.getElementById('filtro-ano-inicio');
    const filtroMesFim = document.getElementById('filtro-mes-fim');
    const filtroAnoFim = document.getElementById('filtro-ano-fim');

    // 1. Popula os filtros de ano dinamicamente
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

    // 2. Define os valores padrão do filtro para 2025
    filtroMesInicio.value = '0'; // Janeiro
    filtroAnoInicio.value = '2025';
    filtroMesFim.value = '11'; // Dezembro
    filtroAnoFim.value = '2025';

    // 3. Função principal para renderizar/atualizar o gráfico
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
        graficoMensalInstance = new Chart(ctx, {
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
            plugins: [ChartDataLabels],
            options: {
                scales: { 
                    y: { beginAtZero: true, ticks: { stepSize: 1 } } 
                },
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

    // Adiciona os listeners para os filtros
    filtroMesInicio.addEventListener('change', atualizarGrafico);
    filtroAnoInicio.addEventListener('change', atualizarGrafico);
    filtroMesFim.addEventListener('change', atualizarGrafico);
    filtroAnoFim.addEventListener('change', atualizarGrafico);

    // Renderiza o gráfico pela primeira vez com os valores padrão
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
// dashboard-completo.js
// ============================================================
// 🔹 Inicialização do Firebase (v10.7.1 via CDN)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 🔹 Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SUA_AUTH_DOMAIN",
  projectId: "SUA_PROJECT_ID",
  storageBucket: "SUA_STORAGE_BUCKET",
  messagingSenderId: "SUA_MESSAGING_SENDER_ID",
  appId: "SUA_APP_ID"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================
// 🔹 Inteligência - Resumo Diário
// ============================================================
function gerarResumoDiarioInteligente(agendamentos) {
  if (!agendamentos || agendamentos.length === 0) {
    return "Nenhum agendamento para hoje.";
  }

  const total = agendamentos.length;
  const servicos = {};
  let totalFaturamento = 0;

  agendamentos.forEach(a => {
    servicos[a.servico] = (servicos[a.servico] || 0) + 1;
    totalFaturamento += a.preco || 0;
  });

  const servicoMaisAgendado = Object.entries(servicos)
    .sort((a, b) => b[1] - a[1])[0][0];

  return `Hoje você tem ${total} agendamentos. O serviço mais procurado é "${servicoMaisAgendado}". Faturamento previsto: R$ ${totalFaturamento.toFixed(2)}.`;
}

// ============================================================
// 🔹 Dashboard - Carregamento e Filtros
// ============================================================

// Seletores
const resumoContainer = document.getElementById("resumo-diario-container");
const filtroMesInicio = document.getElementById("filtro-mes-inicio");
const filtroAnoInicio = document.getElementById("filtro-ano-inicio");
const filtroMesFim = document.getElementById("filtro-mes-fim");
const filtroAnoFim = document.getElementById("filtro-ano-fim");

// Preencher filtros de ano dinamicamente
function preencherAnos() {
  const anoAtual = new Date().getFullYear();
  for (let ano = anoAtual; ano >= anoAtual - 5; ano--) {
    const optInicio = document.createElement("option");
    optInicio.value = ano;
    optInicio.textContent = ano;
    filtroAnoInicio.appendChild(optInicio);

    const optFim = document.createElement("option");
    optFim.value = ano;
    optFim.textContent = ano;
    filtroAnoFim.appendChild(optFim);
  }
}
preencherAnos();

// Função para buscar agendamentos do dia
async function carregarResumoDoDia(uidEmpresa) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const q = query(
    collection(db, "agendamentos"),
    where("empresaId", "==", uidEmpresa),
    where("data", ">=", Timestamp.fromDate(hoje)),
    where("data", "<", Timestamp.fromDate(amanha)),
    orderBy("data", "asc")
  );

  const snap = await getDocs(q);
  const agendamentos = snap.docs.map(doc => doc.data());
  resumoContainer.textContent = gerarResumoDiarioInteligente(agendamentos);
}

// ============================================================
// 🔹 Autenticação e Inicialização
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    resumoContainer.textContent = "Faça login para ver seus dados.";
    return;
  }

  await carregarResumoDoDia(user.uid);
  // Aqui você pode chamar funções para carregar gráficos
});
