// ======================================================================
//                       DASHBOARD.JS (VERSÃO FINAL REVISADO)
// ======================================================================

import { verificarAcesso, checkUserStatus } from "./userService.js";
import { showCustomAlert } from "./custom-alert.js";
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from "./inteligencia.js";

const totalSlots = 20;
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

function toLocalTimeStr(dateOrISO) {
  const d = dateOrISO instanceof Date ? dateOrISO : new Date(dateOrISO);
  if (isNaN(d)) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
// HORÁRIOS / PRÓXIMO EXPEDIENTE
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

    // Verifica até 90 dias à frente
    for (let i = 0; i < 90; i++) {
      const nomeDia = diaDaSemana[dataAtual.getDay()];
      const diaConfig = horarios[nomeDia];
      if (diaConfig && diaConfig.ativo) {
        return dataAtual.toISOString().split("T")[0]; // Retorna primeiro dia ativo (hoje ou futuro)
      }
      dataAtual.setDate(dataAtual.getDate() + 1); // Avança um dia
    }
    return dataInicial; // fallback
  } catch (e) {
    console.error("Erro ao buscar próxima data disponível:", e);
    return dataInicial;
  }
}

// --------------------------------------------------
// RESUMO DO DIA
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

    const servicosCount = {};
    const profsCount = {};
    const agendaItens = [];
    const agsParaIA = [];

    snapshot.forEach((d) => {
      const ag = d.data();
      const minutosAg = timeStringToMinutes(ag.horario);
      totalAgendamentosDia += 1;
      faturamentoPrevisto += Number(ag.servicoPreco) || 0;

      if (ag.status === "ativo") {
        if (minutosAg >= inicioTurno && minutosAg < fimTurno) {
          agendamentosPendentes += 1;
          agendaItens.push({
            horario: ag.horario || "--:--",
            clienteNome: ag.clienteNome || "Cliente",
            clienteFoto: ag.clienteFoto || "",
            servicoNome: ag.servicoNome || "",
          });
        }
      } else if (ag.status === "realizado") {
        faturamentoRealizado += Number(ag.servicoPreco) || 0;
      }

      if (ag.servicoNome) servicosCount[ag.servicoNome] = (servicosCount[ag.servicoNome] || 0) + 1;
      if (ag.profissionalNome) profsCount[ag.profissionalNome] = (profsCount[ag.profissionalNome] || 0) + 1;

      const dataISO = ag.data || dataSelecionada;
      const inicioISO = `${dataISO}T${ag.horario || "00:00"}:00`;
      const fimHora = ag.horarioFim || addMinutesToTimeString(ag.horario, Number(ag.servicoDuracao) || 0);
      const fimISO = `${dataISO}T${fimHora || ag.horario || "00:00"}:00`;

      agsParaIA.push({
        inicio: inicioISO,
        fim: fimISO,
        cliente: ag.clienteNome || ag.cliente || "Cliente",
        servico: ag.servicoNome || ag.servico || "Serviço",
        servicoPreco: Number(ag.servicoPreco) || 0,
      });
    });

    agendaItens.sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
    const servicoDestaque = Object.keys(servicosCount).sort((a,b)=>servicosCount[b]-servicosCount[a])[0];
    const profissionalDestaque = Object.keys(profsCount).sort((a,b)=>profsCount[b]-profsCount[a])[0];

    return {
      totalAgendamentosDia,
      agendamentosPendentes,
      faturamentoRealizado,
      faturamentoPrevisto,
      servicoDestaque: servicoDestaque || null,
      profissionalDestaque: profissionalDestaque || null,
      agendaItens,
      agsParaIA,
    };
  } catch (e) {
    console.error("Erro ao obter resumo do dia:", e);
    return {
      totalAgendamentosDia: 0,
      agendamentosPendentes: 0,
      faturamentoRealizado: 0,
      faturamentoPrevisto: 0,
      servicoDestaque: null,
      profissionalDestaque: null,
      agendaItens: [],
      agsParaIA: [],
    };
  }
}

// --------------------------------------------------
// UI: CARDS
// --------------------------------------------------

function preencherCardResumo(resumo) {
  const totalEl = document.getElementById("total-agendamentos-dia");
  const pendEl = document.getElementById("agendamentos-pendentes");
  const fatRealEl = document.getElementById("faturamento-realizado");
  const fatPrevEl = document.getElementById("faturamento-previsto");
  const percEl = document.getElementById("percentual-ocupacao");
  if (!totalEl || !pendEl || !fatRealEl || !fatPrevEl || !percEl) return;

  const total = Number(resumo.totalAgendamentosDia) || 0;
  const pend = Number(resumo.agendamentosPendentes) || 0;
  const fatReal = Number(resumo.faturamentoRealizado) || 0;
  const fatPrev = Number(resumo.faturamentoPrevisto) || 0;
  const perc = Math.min(100, Math.round((pend / totalSlots) * 100));

  totalEl.textContent = total;
  pendEl.textContent = pend;
  fatRealEl.textContent = fatReal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  fatPrevEl.textContent = fatPrev.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  percEl.textContent = `${perc}%`;
}

// ... (restante dos cards e funções) ...

