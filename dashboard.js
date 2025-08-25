// ======================================================================
//                       DASHBOARD.JS (VERSÃO FINAL - DESPOLUÍDO)
//   - Totais, pendentes, faturamento realizado e previsto
//   - Agenda curta por turno (foto/nome/horário, max 5 itens)
//   - Cards: Resumo, Serviço, Profissional, IA, Resumo Inteligente, Agenda
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
        if (i === 0) {
          const ultimoBloco = diaConfig.blocos?.[diaConfig.blocos.length - 1];
          if (ultimoBloco?.fim) {
            const fimExp = timeStringToMinutes(ultimoBloco.fim);
            const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
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
// RESUMO DO DIA
// --------------------------------------------------

async function obterResumoDoDia(empresaId, dataSelecionada) {
  try {
    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(agRef, where("data", "==", dataSelecionada), where("status", "in", STATUS_VALIDOS));
    const snapshot = await getDocs(q);

    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    let inicioTurno = 0, fimTurno = 24*60;
    if (minutosAgora < 12*60) { inicioTurno=6*60; fimTurno=12*60; }
    else if (minutosAgora<18*60){ inicioTurno=12*60; fimTurno=18*60; }
    else { inicioTurno=18*60; fimTurno=24*60; }

    let totalAgendamentosDia=0, agendamentosPendentes=0, faturamentoRealizado=0, faturamentoPrevisto=0;
    const servicosCount={}, profsCount={}, agendaItens=[], agsParaIA=[];

    snapshot.forEach(d=>{
      const ag=d.data();
      const minutosAg = timeStringToMinutes(ag.horario);
      totalAgendamentosDia++;
      faturamentoPrevisto += Number(ag.servicoPreco)||0;

      if(ag.status==="ativo" && minutosAg>=inicioTurno && minutosAg<fimTurno){
        agendamentosPendentes++;
        agendaItens.push({ horario:ag.horario||"--:--", clienteNome:ag.clienteNome||"Cliente", clienteFoto:ag.clienteFoto||"", servicoNome:ag.servicoNome||"" });
      } else if(ag.status==="realizado"){
        faturamentoRealizado += Number(ag.servicoPreco)||0;
      }

      if(ag.servicoNome) servicosCount[ag.servicoNome]=(servicosCount[ag.servicoNome]||0)+1;
      if(ag.profissionalNome) profsCount[ag.profissionalNome]=(profsCount[ag.profissionalNome]||0)+1;

      const dataISO = ag.data || dataSelecionada;
      const inicioISO = `${dataISO}T${ag.horario||"00:00"}:00`;
      const fimHora = ag.horarioFim || addMinutesToTimeString(ag.horario, Number(ag.servicoDuracao)||0);
      const fimISO = `${dataISO}T${fimHora||ag.horario||"00:00"}:00`;
      agsParaIA.push({ inicio:inicioISO, fim:fimISO, cliente:ag.clienteNome||"Cliente", servico:ag.servicoNome||"Serviço", servicoPreco:Number(ag.servicoPreco)||0 });
    });

    agendaItens.sort((a,b)=>(a.horario||"").localeCompare(b.horario||""));
    const servicoDestaque = Object.keys(servicosCount).sort((a,b)=>servicosCount[b]-servicosCount[a])[0]||null;
    const profissionalDestaque = Object.keys(profsCount).sort((a,b)=>profsCount[b]-profsCount[a])[0]||null;

    return { totalAgendamentosDia, agendamentosPendentes, faturamentoRealizado, faturamentoPrevisto, servicoDestaque, profissionalDestaque, agendaItens, agsParaIA };
  } catch(e){
    console.error("Erro ao obter resumo do dia:", e);
    return { totalAgendamentosDia:0, agendamentosPendentes:0, faturamentoRealizado:0, faturamentoPrevisto:0, servicoDestaque:null, profissionalDestaque:null, agendaItens:[], agsParaIA:[] };
  }
}

// --------------------------------------------------
// UI: CARDS DESPOLUÍDOS
// --------------------------------------------------

function preencherCardResumo(resumo){
  const totalEl=document.getElementById("total-agendamentos-dia");
  const pendEl=document.getElementById("agendamentos-pendentes");
  const fatRealEl=document.getElementById("faturamento-realizado");
  const fatPrevEl=document.getElementById("faturamento-previsto");
  const percEl=document.getElementById("percentual-ocupacao");
  if(!totalEl||!pendEl||!fatRealEl||!fatPrevEl||!percEl) return;

  const total=Number(resumo.totalAgendamentosDia)||0;
  const pend=Number(resumo.agendamentosPendentes)||0;
  const fatReal=Number(resumo.faturamentoRealizado)||0;
  const fatPrev=Number(resumo.faturamentoPrevisto)||0;
  const perc=Math.min(100, Math.round((pend/totalSlots)*100));

  totalEl.textContent=total;
  pendEl.textContent=pend;
  fatRealEl.textContent=fatReal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  fatPrevEl.textContent=fatPrev.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  percEl.textContent=`${perc}%`;
}

function preencherCardServico(servicoDestaque){
  const el=document.getElementById("servico-destaque");
  if(el) el.textContent=servicoDestaque||"Nenhum";
}

function preencherCardProfissional(profissionalDestaque){
  const nomeEl=document.getElementById("prof-destaque-nome");
  const qtdEl=document.getElementById("prof-destaque-qtd");
  if(!nomeEl||!qtdEl) return;
  if(profissionalDestaque){
    nomeEl.textContent=profissionalDestaque;
    qtdEl.textContent="Hoje";
  } else {
    nomeEl.textContent="Nenhum profissional";
    qtdEl.textContent="hoje";
  }
}

function calcularSugestaoIA(resumo){
  const total=Number(resumo.totalAgendamentosDia)||0;
  const ocupacaoPercent=Math.min(100,Math.round((total/totalSlots)*100));
  if(total===0) return "O dia está livre! Que tal criar uma promoção?";
  if(ocupacaoPercent<50) return "Ainda há horários vagos. Considere enviar lembrete aos clientes.";
  return "O dia está movimentado! Prepare-se para um dia produtivo.";
}

function preencherCardIA(mensagem){
  const el=document.getElementById("ia-sugestao");
  if(el) el.textContent=mensagem;
}

function preencherCardAgendaDoDia(agendaItens){
  const listaEl=document.getElementById("agenda-dia-lista");
  if(!listaEl) return;

  if(!agendaItens||agendaItens.length===0){
    listaEl.innerHTML="<div style='color:#888;text-align:center;padding:12px 0;'>Nenhum agendamento para o turno.</div>";
    return;
  }

  const maxItems=5;
  const html="<ul style='list-style:none;padding:0;margin:0;'>"+
    agendaItens.slice(0,maxItems).map(ag=>{
      const foto=ag.clienteFoto?`<img src="${ag.clienteFoto}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:8px;">`:"";
      return `<li style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f3f3;">
        ${foto}<span style="font-weight:600;min-width:52px">${ag.horario||"--:--"}</span>
        <span>${ag.clienteNome||"Cliente"}</span>
        ${ag.servicoNome?`<span style="margin-left:auto;opacity:.7">${ag.servicoNome}</span>`:""}
      </li>`;
    }).join("")+
    (agendaItens.length>maxItems?`<li style="text-align:center;color:#666;padding:4px 0;">+${agendaItens.length-maxItems} agendamento(s) restantes</li>`:"")+
  "</ul>";
  listaEl.innerHTML=html;
}

function preencherCardResumoInteligente(agsParaIA){
  const elResumo=document.getElementById("resumo-inteligente");
  if(!elResumo) return;
  const resumoInteligente=gerarResumoDiarioInteligente(agsParaIA);
  if(resumoInteligente?.mensagem){
    elResumo.innerHTML=resumoInteligente.mensagem;
  } else if(resumoInteligente?.totalAtendimentos>0){
    elResumo.innerHTML=`Total de atendimentos: <b>${resumoInteligente.totalAtendimentos}</b><br>
    Faturamento estimado: <b>${Number(resumoInteligente.faturamentoEstimado||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b>`;
  } else {
    elResumo.textContent="Nenhum dado disponível.";
  }
}

// --------------------------------------------------
// FUNÇÃO PRINCIPAL
// --------------------------------------------------

async function preencherDashboard(user,dataSelecionada,empresaId){
  try{
    const resumoDoDia = await obterResumoDoDia(empresaId,dataSelecionada);

    preencherCardResumo(resumoDoDia);
    preencherCardServico(resumoDoDia.servicoDestaque);
    preencherCardProfissional(resumoDoDia.profissionalDestaque);
    preencherCardIA(calcularSugestaoIA(resumoDoDia));
    preencherCardAgendaDoDia(resumoDoDia.agendaItens);
    preencherCardResumoInteligente(resumoDoDia.agsParaIA);

  } catch(error){
    console.error("Erro ao preencher dashboard:",error);
    alert("Ocorreu um erro ao carregar o dashboard.");
  }
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------

async function iniciarDashboard(user,empresaId){
  const filtroData=document.getElementById("filtro-data");
  const hojeString=new Date().toISOString().split("T")[0];
  const dataInicial=await encontrarProximaDataDisponivel(empresaId,hojeString);

  if(filtroData){
    filtroData.value=dataInicial;
    filtroData.addEventListener("change",debounce(()=>{
      preencherDashboard(user,filtroData.value,empresaId);
    },300));
  }

  await preencherDashboard(user,dataInicial,empresaId);
}

window.addEventListener("DOMContentLoaded",async()=>{
  try{
    const { user, perfil, isOwner } = await verificarAcesso();
    const empresaId = getEmpresaIdAtiva();
    await iniciarDashboard(user,empresaId);

    if(isOwner){
      const status = await checkUserStatus();
      if(status?.isTrialActive && status?.trialEndDate){
        const banner=document.getElementById("trial-notification-banner");
        if(banner){
          const hoje=new Date();
          const trialEnd=new Date(status.trialEndDate);
          const diasRestantes=Math.max(0,Math.ceil((trialEnd-hoje)/(1000*60*60*24)));
          banner.innerHTML=`🎉 Seu período de teste termina em ${diasRestantes} dia${diasRestantes!==1?"s":""}.`;
          banner.style.display="block";
        }
      }
    }

  } catch(error){
    console.error("Erro no porteiro:",error?.message||error);
    window.location.href="login.html";
  }

  const btnVoltar=document.getElementById("btn-voltar");
  if(btnVoltar) btnVoltar.addEventListener("click",()=>window.location.href="index.html");
});
