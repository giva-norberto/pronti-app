// ======================================================================
//          DASHBOARD.JS (CORRIGIDO E VALIDADO PARA MULTIEMPRESA)
// ======================================================================

// ✅ CORREÇÃO: Importa 'verificarAcesso' do userService. A função 'checkUserStatus' não é exportada,
// mas seus dados já vêm dentro do objeto retornado por verificarAcesso.
import { verificarAcesso } from "./userService.js";
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from "./inteligencia.js";

const totalSlots = 20;
const STATUS_VALIDOS = ["ativo", "realizado"];

// --------------------------------------------------
// UTILITÁRIOS
// --------------------------------------------------

function timeStringToMinutes(timeStr ) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function addMinutesToTimeString(timeStr, minutes) {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const base = new Date();
  base.setHours(h, m, 0, 0);
  base.setMinutes(base.getMinutes() + (Number(minutes) || 0));
  const hh = String(base.getHours()).padStart(2, "0");
  const mm = String(base.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ✅ BOA PRÁTICA: Esta função é útil, mas será chamada dentro do fluxo principal para evitar erros.
function getEmpresaIdAtiva() {
  const empresaId = localStorage.getItem("empresaAtivaId");
  if (!empresaId) {
    // O verificarAcesso já deve ter redirecionado, mas é uma segurança extra.
    window.location.href = "selecionar-empresa.html";
    throw new Error("Empresa não selecionada.");
  }
  return empresaId;
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --------------------------------------------------
// LÓGICA DA DATA
// --------------------------------------------------

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
  try {
    const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
    if (!empresaDoc.exists()) return dataInicial;
    const donoId = empresaDoc.data().donoId;
    if (!donoId) return dataInicial;

    const horariosSnap = await getDoc(
      doc(db, "empresarios", empresaId, "profissionais", donoId, "configuracoes", "horarios")
    );
    const horarios = horariosSnap.exists() ? horariosSnap.data() : null;
    if (!horarios) return dataInicial;

    const diaDaSemana = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
    let dataAtual = new Date(`${dataInicial}T12:00:00`);

    for (let i = 0; i < 90; i++) {
      const nomeDia = diaDaSemana[dataAtual.getDay()];
      const diaConfig = horarios[nomeDia];
      if (diaConfig && diaConfig.ativo) {
        return dataAtual.toISOString().split("T")[0];
      }
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return dataInicial;
  } catch (e) {
    console.error("Erro ao buscar próxima data disponível:", e);
    return dataInicial;
  }
}

// --------------------------------------------------
// BUSCA E PROCESSAMENTO DE DADOS
// --------------------------------------------------

async function obterResumoDoDia(empresaId, dataSelecionada) {
  try {
    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(
      agRef,
      where("data", "==", dataSelecionada),
      where("status", "in", STATUS_VALIDOS)
    );
    const snapshot = await getDocs(q);

    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    let inicioTurno = 0, fimTurno = 24 * 60;
    if (minutosAgora < 12 * 60) {
      inicioTurno = 6 * 60;
      fimTurno = 12 * 60;
    } else if (minutosAgora < 18 * 60) {
      inicioTurno = 12 * 60;
      fimTurno = 18 * 60;
    } else {
      inicioTurno = 18 * 60;
      fimTurno = 24 * 60;
    }

    let totalAgendamentosDia = 0;
    let agendamentosPendentes = 0;
    let faturamentoRealizado = 0;
    let faturamentoPrevisto = 0;
    const agsParaIA = [];

    snapshot.forEach((d) => {
      const ag = d.data();
      const minutosAg = timeStringToMinutes(ag.horario);
      totalAgendamentosDia++;
      faturamentoPrevisto += Number(ag.servicoPreco) || 0;

      if (ag.status === "ativo") {
        if (minutosAg >= inicioTurno && minutosAg < fimTurno) {
          agendamentosPendentes++;
        }
      } else if (ag.status === "realizado") {
        faturamentoRealizado += Number(ag.servicoPreco) || 0;
      }

      const dataISO = ag.data || dataSelecionada;
      const inicioISO = `${dataISO}T${ag.horario || "00:00"}:00`;
      const fimHora = ag.horarioFim || addMinutesToTimeString(ag.horario, Number(ag.servicoDuracao) || 0);
      const fimISO = `${dataISO}T${fimHora || ag.horario || "00:00"}:00`;

      agsParaIA.push({
        inicio: inicioISO,
        fim: fimISO,
        cliente: ag.clienteNome || "Cliente",
        servico: ag.servicoNome || "Serviço",
        servicoPreco: Number(ag.servicoPreco) || 0,
        status: ag.status || ""
      });
    });

    return {
      totalAgendamentosDia,
      agendamentosPendentes,
      faturamentoRealizado,
      faturamentoPrevisto,
      agsParaIA,
    };
  } catch (e) {
    console.error("Erro ao obter resumo do dia:", e);
    return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevisto: 0, agsParaIA: [] };
  }
}

async function obterServicosMaisVendidosSemana(empresaId) {
  try {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 6);
    const dataISOInicio = inicioSemana.toISOString().split("T")[0];

    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(
      agRef,
      where("data", ">=", dataISOInicio),
      where("data", "<=", hoje.toISOString().split("T")[0]),
      where("status", "in", STATUS_VALIDOS)
    );
    const snapshot = await getDocs(q);

    const contagem = {};
    snapshot.forEach((d) => {
      const ag = d.data();
      const nome = ag.servicoNome || "Serviço";
      contagem[nome] = (contagem[nome] || 0) + 1;
    });

    return contagem;
  } catch (e) {
    console.error("Erro ao buscar serviços semanais:", e);
    return {};
  }
}

// --------------------------------------------------
// RENDERIZAÇÃO NA UI
// --------------------------------------------------

// ✅ CORREÇÃO: A função agora recebe o 'empresaId' para passar para a IA.
function preencherPainel(resumo, servicosSemana, empresaId) {
  document.getElementById("faturamento-realizado").textContent =
    resumo.faturamentoRealizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("faturamento-previsto").textContent =
    resumo.faturamentoPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("total-agendamentos-dia").textContent = resumo.totalAgendamentosDia;
  document.getElementById("agendamentos-pendentes").textContent = resumo.agendamentosPendentes;

  const canvas = document.getElementById("grafico-servicos-semana");
  if (canvas) {
    // Destrói o gráfico anterior para evitar sobreposição
    const chartExistente = Chart.getChart(canvas);
    if (chartExistente) {
        chartExistente.destroy();
    }
    new Chart(canvas, {
      type: "pie",
      data: {
        labels: Object.keys(servicosSemana),
        datasets: [{
          data: Object.values(servicosSemana),
          backgroundColor: ["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc948"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: "Serviços mais vendidos da semana" }
        }
      }
    });
  }

  const elResumo = document.getElementById("resumo-inteligente");
  const elSugestaoIA = document.getElementById("ia-sugestao");

  if (elResumo) {
    // ✅ CORREÇÃO: Valida se há dados ANTES de chamar a IA.
    if (resumo.agsParaIA && resumo.agsParaIA.length > 0) {
      // Passa o empresaId para a função de IA, caso ela precise de mais contexto no futuro.
      const resumoInteligente = gerarResumoDiarioInteligente(resumo.agsParaIA, empresaId);
      elResumo.innerHTML = resumoInteligente?.mensagem || "<ul><li>Não foi possível gerar o resumo.</li></ul>";
    } else {
      elResumo.innerHTML = "<ul><li>Nenhum agendamento no dia para resumir.</li></ul>";
    }
  }
  
  if (elSugestaoIA) {
    elSugestaoIA.textContent = calcularSugestaoIA(resumo);
  }
}

function calcularSugestaoIA(resumo) {
  const total = resumo.totalAgendamentosDia || 0;
  const ocupacaoPercent = Math.min(100, Math.round((total / totalSlots) * 100));
  if (total === 0) return "O dia está livre! Que tal criar uma promoção para atrair clientes?";
  if (ocupacaoPercent < 50) return "Ainda há horários vagos. Considere enviar um lembrete aos clientes.";
  return "O dia está movimentado! Prepare-se para um dia produtivo.";
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------

// ✅ CORREÇÃO: A função agora recebe o objeto de perfil completo.
async function iniciarDashboard(perfil) {
  const empresaId = perfil.empresaId;
  console.log("[DEBUG] Dashboard carregando para empresa:", empresaId);

  const filtroData = document.getElementById("filtro-data");
  const hojeString = new Date().toISOString().split("T")[0];
  const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);

  if (filtroData) {
    filtroData.value = dataInicial;
    filtroData.addEventListener("change", debounce(async () => {
      const novaData = await encontrarProximaDataDisponivel(empresaId, filtroData.value);
      if (novaData !== filtroData.value) {
        filtroData.value = novaData;
      }
      const resumo = await obterResumoDoDia(empresaId, novaData);
      const servicosSemana = await obterServicosMaisVendidosSemana(empresaId);
      preencherPainel(resumo, servicosSemana, empresaId);
    }, 300));
  }

  const resumoInicial = await obterResumoDoDia(empresaId, dataInicial);
  const servicosSemana = await obterServicosMaisVendidosSemana(empresaId);
  preencherPainel(resumoInicial, servicosSemana, empresaId);
}

// ---- ESCUTA TROCA DE EMPRESA ATIVA E RECARREGA ----
window.addEventListener("empresaAtivaTroca", () => {
  console.log("[DEBUG] Evento de troca de empresa detectado. Recarregando dashboard.");
  location.reload();
});

// --------------------------------------------------
// LOAD
// --------------------------------------------------

window.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ CORREÇÃO: 'verificarAcesso' retorna o objeto de perfil completo.
    const perfil = await verificarAcesso();
    
    // Se 'verificarAcesso' resolver, temos certeza que 'perfil.empresaId' existe.
    await iniciarDashboard(perfil);

    // ✅ CORREÇÃO: Usa os dados de 'statusAssinatura' que já vieram no objeto de perfil.
    const status = perfil.statusAssinatura;
    if (status?.isTrialActive && status?.trialDaysRemaining > 0) {
      const banner = document.getElementById("trial-notification-banner");
      if (banner) {
        const diasRestantes = status.trialDaysRemaining;
        banner.innerHTML = `🎉 O seu período de teste termina em ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}.`;
        banner.style.display = "block";
      }
    }
  } catch(error){
    // O 'verificarAcesso' rejeita a promessa em caso de redirecionamento.
    // Apenas logamos o erro se não for uma mensagem de redirecionamento padrão.
    if (error && !error.message.includes("Redirecionando") && !error.message.includes("Nenhuma empresa")) {
      console.error("Erro crítico no carregamento do dashboard:", error);
      // Como último recurso, redireciona para o login.
      window.location.href = "login.html";
    }
  }
});
