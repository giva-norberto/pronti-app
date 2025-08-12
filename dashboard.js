import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Botão voltar para o link principal do projeto
window.addEventListener("DOMContentLoaded", () => {
  const btnVoltar = document.querySelector('.btn-voltar');
  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => {
      window.location.href = "/";
    });
  }
});

// Busca empresaId de URL, localStorage ou Firestore
async function getEmpresaId(user) {
  const params = new URLSearchParams(window.location.search);
  let empresaId = params.get('empresaId');
  if (!empresaId) empresaId = localStorage.getItem('empresaId');
  if (!empresaId && user) {
    const empresariosRef = collection(db, "empresarios");
    const q = query(empresariosRef, where("donoId", "==", user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      empresaId = snap.docs[0].id;
      localStorage.setItem('empresaId', empresaId);
    }
  }
  if (empresaId) localStorage.setItem('empresaId', empresaId);
  return empresaId;
}

// Desenha o círculo de ocupação
function desenharOcupacao(percent) {
  const svg = `
    <svg>
      <circle cx="37" cy="37" r="32" stroke="#fff2" stroke-width="8" fill="none"/>
      <circle cx="37" cy="37" r="32" stroke="#3cec6c" stroke-width="8" fill="none"
        stroke-dasharray="${2 * Math.PI * 32}"
        stroke-dashoffset="${2 * Math.PI * 32 * (1 - percent/100)}"
        style="transition: stroke-dashoffset 1s"/>
    </svg>
    <div class="percent">${percent}%</div>
  `;
  document.getElementById("ocupacao-circular").innerHTML = svg;
}

// Função para formatar data e horário amigavelmente
function formatarDataHora(dataStr, horarioStr) {
  // dataStr: "2025-08-12", horarioStr: "15:30"
  const dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const [ano, mes, dia] = dataStr.split('-');
  const dataObj = new Date(`${dataStr}T${horarioStr}:00`);
  return `${dias[dataObj.getDay()]}, ${dia}/${mes}/${ano} às ${horarioStr}`;
}

// Desenha os agendamentos do dia na agenda-resultado
function desenharAgendamentosDoDia(agendamentos) {
  const container = document.getElementById("agenda-resultado");
  container.innerHTML = "";
  if (!agendamentos || agendamentos.length === 0) {
    container.innerHTML = `<div class="aviso-horarios">Nenhum agendamento encontrado para esta data.</div>`;
    return;
  }
  agendamentos.forEach(ag => {
    const card = document.createElement("div");
    card.className = "card-agendamento";
    card.innerHTML = `
      <div class="agendamento-info">
        <strong>${ag.servicoNome || ag.servico || "Serviço não informado"}</strong>
        <span>com ${ag.profissionalNome || ag.profissional || "Profissional não informado"}</span>
        <small>${formatarDataHora(ag.data, ag.horario)}</small>
        <span style="color:#a5b4fc;font-size:0.98rem;">Cliente: ${ag.clienteNome || ag.cliente || "Não informado"}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Preenche o dashboard
async function preencherDashboard(user) {
  const empresaId = await getEmpresaId(user);
  if (!empresaId) {
    alert("Empresa não definida. Selecione ou cadastre uma empresa.");
    return;
  }
  const empresaRef = await getDoc(doc(db, "empresarios", empresaId));
  if (!empresaRef.exists()) {
    alert("Empresa não encontrada.");
    return;
  }
  const donoId = empresaRef.data().donoId;
  const isDono = user.uid === donoId;

  // Filtro de data para agenda geral
  let dataSelecionada = '';
  const filtroData = document.getElementById("filtro-data");
  if (filtroData && filtroData.value) {
    dataSelecionada = filtroData.value;
  } else {
    // Padrão: hoje
    const hoje = new Date();
    dataSelecionada = hoje.toISOString().split('T')[0];
    if (filtroData) filtroData.value = dataSelecionada;
  }

  // Busca todos agendamentos da empresa na data selecionada
  const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
  const agQuery = query(
    agCollection,
    where("data", "==", dataSelecionada),
    where("status", "==", "ativo")
  );
  const agSnap = await getDocs(agQuery);
  const ags = agSnap.docs.map(doc => doc.data());

  desenharAgendamentosDoDia(ags);

  // Serviço destaque
  const servicos = {};
  ags.forEach(ag => {
    const nomeServico = ag.servicoNome || ag.servico;
    if (!servicos[nomeServico]) servicos[nomeServico] = 0;
    servicos[nomeServico]++;
  });
  const servicoDestaque = Object.entries(servicos).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById("servico-destaque").textContent = servicoDestaque ? servicoDestaque[0] : "Nenhum serviço hoje";

  // Profissional destaque
  const profs = {};
  ags.forEach(ag => {
    const nomeProf = ag.profissionalNome || ag.profissional;
    if (!profs[nomeProf]) profs[nomeProf] = 0;
    profs[nomeProf]++;
  });
  const profDestaque = Object.entries(profs).sort((a,b)=>b[1]-a[1])[0];
  if (profDestaque) {
    document.getElementById("prof-destaque-nome").textContent = profDestaque[0];
    document.getElementById("prof-destaque-qtd").textContent = `${profDestaque[1]} agendamentos`;
    // Buscar foto do profissional, se existir na coleção de profissionais
    const profDocRef = doc(db, "empresarios", empresaId, "profissionais", profDestaque[0]);
    const profDoc = await getDoc(profDocRef);
    document.getElementById("avatar-prof").src = profDoc.exists() && profDoc.data().fotoUrl ? profDoc.data().fotoUrl : "";
  } else {
    document.getElementById("prof-destaque-nome").textContent = "Nenhum profissional";
    document.getElementById("prof-destaque-qtd").textContent = "";
    document.getElementById("avatar-prof").src = "";
  }

  // Ocupação (percentual)
  const totalSlots = empresaRef.data().slotsDia || 10;
  const ocupacaoPercent = Math.round((ags.length / totalSlots) * 100);
  desenharOcupacao(ocupacaoPercent);
  document.getElementById("ocupacao-texto").textContent = `Sua agenda está ${ocupacaoPercent}% ocupada na data selecionada`;

  // Comparativo com data anterior
  const dataAnteriorObj = new Date(dataSelecionada);
  dataAnteriorObj.setDate(dataAnteriorObj.getDate() - 1);
  const dataAnterior = dataAnteriorObj.toISOString().split('T')[0];
  const agAnteriorQuery = query(
    agCollection,
    where("data", "==", dataAnterior),
    where("status", "==", "ativo")
  );
  const agAnteriorSnap = await getDocs(agAnteriorQuery);
  const agAnteriorQtd = agAnteriorSnap.size;
  const diff = ags.length - agAnteriorQtd;
  const diffPercent = agAnteriorQtd ? Math.round((diff / agAnteriorQtd) * 100) : 0;
  document.getElementById("comparativo-percent").textContent = (diffPercent >= 0 ? "+" : "") + diffPercent + "%";
  document.getElementById("comparativo-texto").textContent = `Você tem ${Math.abs(diffPercent)}% ${diffPercent >= 0 ? "mais" : "menos"} agendamentos que no dia anterior`;

  // Alerta de horários próximos
  let alerta = false;
  ags.sort((a,b)=>a.horario.localeCompare(b.horario));
  for (let i=1; i<ags.length; i++) {
    const [h1, m1] = ags[i-1].horario.split(':').map(Number);
    const [h2, m2] = ags[i].horario.split(':').map(Number);
    const minAntes = h1*60 + m1;
    const minDepois = h2*60 + m2;
    if ((minDepois - minAntes) < 15) alerta = true;
  }
  if (alerta) {
    document.getElementById("card-alerta").style.display = "";
    document.getElementById("alerta-msg").textContent = "Duas clientes marcaram horários muito próximos. Avalie disponibilidade!";
  } else {
    document.getElementById("card-alerta").style.display = "none";
  }

  // Sugestão da IA simples
  const horariosBaixa = [];
  for (let h=7; h<=19; h++) {
    if (!ags.find(ag=>parseInt(ag.horario.split(':')[0])===h)) horariosBaixa.push(h);
  }
  if (horariosBaixa.length) {
    document.getElementById("ia-sugestao").textContent = `Ofereça desconto para horários das ${horariosBaixa[0]}h às ${horariosBaixa[horariosBaixa.length-1]}h, estão com baixa ocupação.`;
    document.getElementById("btn-promocao").style.display = "";
  } else {
    document.getElementById("ia-sugestao").textContent = "Agenda cheia em todos os horários!";
    document.getElementById("btn-promocao").style.display = "none";
  }
}

// Evento para filtro por data
window.addEventListener("DOMContentLoaded", () => {
  const filtroData = document.getElementById("filtro-data");
  if (filtroData) {
    filtroData.addEventListener("change", () => {
      onAuthStateChanged(auth, user => {
        if (!user) {
          alert("Faça login para acessar o dashboard!");
          return;
        }
        preencherDashboard(user).catch(err => {
          alert("Erro ao carregar dados: " + err.message);
        });
      });
    });
  }
});

// Autenticação e carregamento inicial
onAuthStateChanged(auth, user => {
  if (!user) {
    alert("Faça login para acessar o dashboard!");
    return;
  }
  preencherDashboard(user).catch(err => {
    alert("Erro ao carregar dados: " + err.message);
  });
});

// Exportar resumo do dia e botão promoção
window.addEventListener("DOMContentLoaded", () => {
  const btnExportar = document.getElementById("btn-exportar");
  if (btnExportar) {
    btnExportar.addEventListener("click", () => {
      window.print();
    });
  }
  const btnPromocao = document.getElementById("btn-promocao");
  if (btnPromocao) {
    btnPromocao.addEventListener("click", () => {
      alert("Função de criar promoção em desenvolvimento!");
    });
  }
});
