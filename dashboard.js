// ======================================================================
//                       DASHBOARD.JS (VERSÃO REVISADA)
//   - 1 consulta/dia (status: ativo/realizado)
//   - Cards: Resumo, Serviço/Profissional, Agenda do Dia (foto/nome/horário)
//   - Resumo Inteligente (campos corretos) + Sugestão IA
//   - Multi-empresa via localStorage ("empresaAtivaId")
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
// HORÁRIOS / PRÓXIMA DATA DISPONÍVEL
// --------------------------------------------------

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
  try {
    const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
    if (!empresaDoc.exists()) return dataInicial;
    const donoId = empresaDoc.data().donoId;
    if (!donoId) return dataInicial;

    const horariosSnap = await getDoc(
      doc(
        db,
        "empresarios",
        empresaId,
        "profissionais",
        donoId,
        "configuracoes",
        "horarios"
      )
    );
    const horarios = horariosSnap.exists() ? horariosSnap.data() : null;
    if (!horarios) return dataInicial;

    const diaDaSemana = [
      "domingo",
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ];
    let dataAtual = new Date(`${dataInicial}T12:00:00`);

    for (let i = 0; i < 90; i++) {
      const nomeDia = diaDaSemana[dataAtual.getDay()];
      const diaConfig = horarios[nomeDia];
      if (diaConfig && diaConfig.ativo) {
        if (i === 0) {
          const ultimoBloco = diaConfig.blocos?.[diaConfig.blocos.length - 1];
          if (ultimoBloco?.fim) {
            const fimExp = timeStringToMinutes(ultimoBloco.fim);
            const agoraMin =
              new Date().getHours() * 60 + new Date().getMinutes();
            if (agoraMin < fimExp) return dataAtual.toISOString().split("T")[0];
          } else {
            return dataAtual.toISOString().split("T")[0];
          }
        } else {
          return dataAtual.toISOString().split("T")[0];
        }
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
// RESUMO DO DIA (1 consulta)
//  - status IN ["ativo","realizado"]
//  - calcula: total, faturamento, destaques, agenda curta, lista p/ IA
// --------------------------------------------------

async function obterResumoDoDia(empresaId, dataSelecionada) {
  try {
    const agRef = collection(db, "empresarios", empresaId, "agendamentos");

    // Firestore permite where-in com até 10 valores
    const q = query(
      agRef,
      where("data", "==", dataSelecionada),
      where("status", "in", STATUS_VALIDOS)
    );

    const snapshot = await getDocs(q);

    // Acumuladores
    let totalAgendamentos = 0;
    let faturamentoPrevisto = 0;
    const servicosCount = {};
    const profsCount = {};

    // Para agenda do dia (UI)
    const agendaItens = [];

    // Para IA (campos corretos)
    const agsParaIA = [];

    snapshot.forEach((d) => {
      const ag = d.data();
      totalAgendamentos += 1;
      faturamentoPrevisto += Number(ag.servicoPreco) || 0;

      if (ag.servicoNome)
        servicosCount[ag.servicoNome] =
          (servicosCount[ag.servicoNome] || 0) + 1;
      if (ag.profissionalNome)
        profsCount[ag.profissionalNome] =
          (profsCount[ag.profissionalNome] || 0) + 1;

      // Derivar início/fim
      const dataISO = ag.data || dataSelecionada; // "YYYY-MM-DD"
      const inicioISO = `${dataISO}T${ag.horario || "00:00"}:00`;
      const fimHora =
        ag.horarioFim ||
        addMinutesToTimeString(ag.horario, Number(ag.servicoDuracao) || 0);
      const fimISO = `${dataISO}T${fimHora || ag.horario || "00:00"}:00`;

      // Para UI (agenda breve)
      agendaItens.push({
        horario: ag.horario || "--:--",
        clienteNome: ag.clienteNome || "Cliente",
        clienteFoto: ag.clienteFoto || "",
        servicoNome: ag.servicoNome || "",
      });

      // Para IA
      agsParaIA.push({
        inicio: inicioISO,
        fim: fimISO,
        cliente: ag.clienteNome || ag.cliente || "Cliente",
        servico: ag.servicoNome || ag.servico || "Serviço",
        servicoPreco: Number(ag.servicoPreco) || 0,
      });
    });

    // Ordenar agenda por horário (string HH:mm)
    agendaItens.sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));

    const servicoDestaque = Object.keys(servicosCount).sort(
      (a, b) => servicosCount[b] - servicosCount[a]
    )[0];

    const profissionalDestaque = Object.keys(profsCount).sort(
      (a, b) => profsCount[b] - profsCount[a]
    )[0];

    return {
      totalAgendamentos,
      faturamentoPrevisto,
      servicoDestaque: servicoDestaque || null,
      profissionalDestaque: profissionalDestaque || null,
      agendaItens, // lista curta para o card
      agsParaIA, // lista compacta para gerar o resumo inteligente
    };
  } catch (e) {
    console.error("Erro ao obter resumo do dia:", e);
    return {
      totalAgendamentos: 0,
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
  const fatEl = document.getElementById("faturamento-previsto");
  const percEl = document.getElementById("percentual-ocupacao");
  if (!totalEl || !fatEl || !percEl) return;

  const total = Number(resumo.totalAgendamentos) || 0;
  const fat = Number(resumo.faturamentoPrevisto) || 0;
  const perc = Math.min(100, Math.round((total / totalSlots) * 100));

  totalEl.textContent = total;
  fatEl.textContent = fat.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  percEl.textContent = `${perc}%`;
}

function preencherCardServico(servicoDestaque) {
  const el = document.getElementById("servico-destaque");
  if (el) el.textContent = servicoDestaque || "Nenhum";
}

function preencherCardProfissional(profissionalDestaque) {
  const nomeEl = document.getElementById("prof-destaque-nome");
  const qtdEl = document.getElementById("prof-destaque-qtd");
  if (!nomeEl || !qtdEl) return;

  if (profissionalDestaque) {
    nomeEl.textContent = profissionalDestaque;
    qtdEl.textContent = `Hoje`;
  } else {
    nomeEl.textContent = "Nenhum profissional";
    qtdEl.textContent = "hoje";
  }
}

function calcularSugestaoIA(resumo) {
  const total = Number(resumo.totalAgendamentos) || 0;
  const ocupacaoPercent = Math.min(100, Math.round((total / totalSlots) * 100));
  if (total === 0)
    return "O dia está livre! Que tal criar uma promoção para atrair clientes?";
  if (ocupacaoPercent < 50)
    return "Ainda há horários vagos. Considere enviar um lembrete aos clientes.";
  return "O dia está movimentado! Prepare-se para um dia produtivo.";
}

function preencherCardIA(mensagem) {
  const el = document.getElementById("ia-sugestao");
  if (el) el.textContent = mensagem;
}

function preencherCardAgendaDoDia(agendaItens) {
  const listaEl = document.getElementById("agenda-dia-lista");
  if (!listaEl) return;

  if (!agendaItens || agendaItens.length === 0) {
    listaEl.innerHTML =
      "<div style='color:#888;text-align:center;padding:12px 0;'>Nenhum agendamento para hoje.</div>";
    return;
  }

  // Render simples com foto (quando houver)
  const html =
    "<ul style='list-style:none;padding:0;margin:0;'>" +
    agendaItens
      .map((ag) => {
        const foto =
          ag.clienteFoto &&
          `<img src="${ag.clienteFoto}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:8px;vertical-align:middle;">`;
        return `<li style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f3f3;">
          ${foto || ""}
          <span style="font-weight:600;min-width:52px">${ag.horario || "--:--"}</span>
          <span>${ag.clienteNome || "Cliente"}</span>
          ${ag.servicoNome ? `<span style="margin-left:auto;opacity:.7">${ag.servicoNome}</span>` : ""}
        </li>`;
      })
      .join("") +
    "</ul>";
  listaEl.innerHTML = html;
}

// --------------------------------------------------
// FUNÇÃO PRINCIPAL DO DASHBOARD
// --------------------------------------------------

async function preencherDashboard(user, dataSelecionada, empresaId) {
  try {
    const resumoDoDia = await obterResumoDoDia(empresaId, dataSelecionada);

    // Cards simples
    preencherCardResumo(resumoDoDia);
    preencherCardServico(resumoDoDia.servicoDestaque);
    preencherCardProfissional(resumoDoDia.profissionalDestaque);
    preencherCardIA(calcularSugestaoIA(resumoDoDia));

    // Agenda do dia (lista curta)
    preencherCardAgendaDoDia(resumoDoDia.agendaItens);

    // Resumo Inteligente (passando estrutura correta)
    const resumoInteligente = gerarResumoDiarioInteligente(
      resumoDoDia.agsParaIA
    );
    const elResumo = document.getElementById("resumo-inteligente");
    if (elResumo) {
      if (resumoInteligente?.mensagem) {
        elResumo.innerHTML = resumoInteligente.mensagem;
      } else if (resumoInteligente?.totalAtendimentos > 0) {
        // Fallback: montar um textinho básico
        elResumo.innerHTML = `
          Total de atendimentos: <b>${resumoInteligente.totalAtendimentos}</b><br>
          Faturamento estimado: <b>${Number(
            resumoInteligente.faturamentoEstimado || 0
          ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
        `;
      } else {
        elResumo.textContent = "Nenhum dado disponível.";
      }
    }
  } catch (error) {
    console.error("Erro ao preencher dashboard:", error);
    alert("Ocorreu um erro ao carregar o dashboard.");
  }
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------

async function iniciarDashboard(user, empresaId) {
  const filtroData = document.getElementById("filtro-data");
  const hojeString = new Date().toISOString().split("T")[0];
  const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);

  if (filtroData) {
    filtroData.value = dataInicial;
    filtroData.addEventListener(
      "change",
      debounce(() => {
        preencherDashboard(user, filtroData.value, empresaId);
      }, 300)
    );
  }

  await preencherDashboard(user, dataInicial, empresaId);
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const { user, perfil, isOwner } = await verificarAcesso();
    const empresaId = getEmpresaIdAtiva();
    await iniciarDashboard(user, empresaId);

    // Notificação trial
    if (isOwner) {
      const status = await checkUserStatus();
      if (status?.isTrialActive && status?.trialEndDate) {
        const banner = document.getElementById("trial-notification-banner");
        if (banner) {
          const hoje = new Date();
          const trialEnd = new Date(status.trialEndDate);
          const diasRestantes = Math.max(
            0,
            Math.ceil((trialEnd - hoje) / (1000 * 60 * 60 * 24))
          );
          banner.innerHTML = `🎉 Seu período de teste termina em ${diasRestantes} dia${
            diasRestantes !== 1 ? "s" : ""
          }.`;
          banner.style.display = "block";
        }
      }
    }
  } catch (error) {
    console.error("Erro no porteiro:", error?.message || error);
    window.location.href = "login.html";
  }

  const btnVoltar = document.getElementById("btn-voltar");
  if (btnVoltar)
    btnVoltar.addEventListener("click", () => (window.location.href = "index.html"));
});
