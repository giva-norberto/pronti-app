// ======================================================================
//          DASHBOARD.JS (VERSÃO FINAL COM REGRA DE DATA CORRIGIDA)
// ======================================================================

import { verificarAcesso, checkUserStatus } from "./userService.js";
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

const totalSlots = 20; // Total de slots disponíveis no dia para cálculo de ocupação
const STATUS_VALIDOS = ["ativo", "realizado"];

// --------------------------------------------------
// UTILITÁRIOS
// --------------------------------------------------

function timeStringToMinutes(timeStr) {
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

function getEmpresaIdAtiva() {
  const empresaId = localStorage.getItem("empresaAtivaId");
  if (!empresaId) {
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

    return dataInicial; // fallback
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
    const agendaItens = [];
    const agsParaIA = [];

    snapshot.forEach((d) => {
      const ag = d.data();
      const minutosAg = timeStringToMinutes(ag.horario);
      totalAgendamentosDia++;
      faturamentoPrevisto += Number(ag.servicoPreco) || 0;

      if (ag.status === "ativo") {
        if (minutosAg >= inicioTurno && minutosAg < fimTurno) {
          agendamentosPendentes++;
          agendaItens.push({
            horario: ag.horario || "--:--",
            clienteNome: ag.clienteNome || "Cliente",
            servicoNome: ag.servicoNome || "",
            profissionalNome: ag.profissionalNome || ""
          });
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

    agendaItens.sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));

    return {
      totalAgendamentosDia,
      agendamentosPendentes,
      faturamentoRealizado,
      faturamentoPrevisto,
      agendaItens,
      agsParaIA,
    };
  } catch (e) {
    console.error("Erro ao obter resumo do dia:", e);
    return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevisto: 0, agendaItens: [], agsParaIA: [] };
  }
}

// --------------------------------------------------
// RENDERIZAÇÃO NA UI
// --------------------------------------------------

function preencherPainel(resumo) {
    // Cards de Resumo
    document.getElementById("faturamento-realizado").textContent = resumo.faturamentoRealizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("faturamento-previsto").textContent = resumo.faturamentoPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("total-agendamentos-dia").textContent = resumo.totalAgendamentosDia;
    document.getElementById("agendamentos-pendentes").textContent = resumo.agendamentosPendentes;

    // Agenda do Turno
    const listaAgendaEl = document.getElementById("agenda-dia-lista");
    if (resumo.agendaItens.length === 0) {
        listaAgendaEl.innerHTML = `<p style='color:#888;text-align:center;padding:12px 0;'>Nenhum agendamento para este turno.</p>`;
    } else {
        listaAgendaEl.innerHTML = resumo.agendaItens.map(ag => `
            <div class="agenda-item">
                <div class="agenda-info">
                    <strong>${ag.clienteNome}</strong>
                    <span>${ag.servicoNome}${ag.profissionalNome ? ' com ' + ag.profissionalNome : ''}</span>
                </div>
                <div class="agenda-horario">${ag.horario}</div>
            </div>
        `).join("");
    }

    // Resumo Inteligente e IA
    const resumoInteligente = gerarResumoDiarioInteligente(resumo.agsParaIA);
    const elResumo = document.getElementById("resumo-inteligente");
    const elSugestaoIA = document.getElementById("ia-sugestao");

    if (elResumo) {
        // A função gerarResumoDiarioInteligente deve retornar HTML de lista (<ul><li>...</li></ul>)
        if (resumoInteligente?.mensagem) {
            elResumo.innerHTML = resumoInteligente.mensagem;
        } else {
            elResumo.innerHTML = "<ul><li>Nenhum dado disponível para o resumo.</li></ul>";
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
// INICIALIZAÇÃO E EVENTOS
// --------------------------------------------------

async function iniciarDashboard(user, empresaId) {
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
        preencherPainel(resumo);
    }, 300));
  }

  const resumoInicial = await obterResumoDoDia(empresaId, dataInicial);
  preencherPainel(resumoInicial);
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const { user } = await verificarAcesso();
    const empresaId = getEmpresaIdAtiva();
    await iniciarDashboard(user, empresaId);

    const status = await checkUserStatus();
    if (status?.isTrialActive && status?.trialEndDate) {
      const banner = document.getElementById("trial-notification-banner");
      if (banner) {
        const hoje = new Date();
        const trialEnd = new Date(status.trialEndDate);
        const diasRestantes = Math.max(0, Math.ceil((trialEnd - hoje)/(1000*60*60*24)));
        banner.innerHTML = `🎉 O seu período de teste termina em ${diasRestantes} dia${diasRestantes!==1?"s":""}.`;
        banner.style.display = "block";
      }
    }
  } catch(error){
    if (!error.message.includes("A redirecionar")) {
        console.error("Erro no guardião de acesso:", error?.message || error);
        window.location.href = "login.html";
    }
  }
});
