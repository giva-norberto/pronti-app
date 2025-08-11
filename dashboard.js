import { db, auth } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Função para desenhar o círculo de ocupação
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

// Função principal para preencher o dashboard
async function preencherDashboard(user) {
  // Pegue o empresaId do contexto do app (exemplo: do perfil do usuário ou da URL)
  const empresaId = window.empresaId || localStorage.getItem("empresaId");
  if (!empresaId) {
    alert("Empresa não definida.");
    return;
  }
  // Busca dados da empresa para pegar donoId
  const empresaRef = await db.collection("empresarios").doc(empresaId).get();
  if (!empresaRef.exists) {
    alert("Empresa não encontrada.");
    return;
  }
  const donoId = empresaRef.data().donoId;
  const isDono = user.uid === donoId;

  // Busca agendamentos do dia (apenas se dono ou cliente permitido)
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  let agQuery;
  if (isDono) {
    agQuery = query(
      collection(db, "empresarios", empresaId, "agendamentos"),
      where("data", ">=", hoje),
      where("data", "<", amanha)
    );
  } else {
    agQuery = query(
      collection(db, "empresarios", empresaId, "agendamentos"),
      where("data", ">=", hoje),
      where("data", "<", amanha),
      where("clienteUid", "==", user.uid)
    );
  }
  const agSnap = await getDocs(agQuery);
  const ags = agSnap.docs.map(doc => doc.data());

  // Preencher cards
  // Serviço destaque
  const servicos = {};
  ags.forEach(ag => {
    if (!servicos[ag.servico]) servicos[ag.servico] = 0;
    servicos[ag.servico]++;
  });
  const servicoDestaque = Object.entries(servicos).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById("servico-destaque").textContent = servicoDestaque ? servicoDestaque[0] : "Nenhum serviço hoje";

  // Profissional destaque
  const profs = {};
  ags.forEach(ag => {
    if (!profs[ag.profissional]) profs[ag.profissional] = 0;
    profs[ag.profissional]++;
  });
  const profDestaque = Object.entries(profs).sort((a,b)=>b[1]-a[1])[0];
  if (profDestaque) {
    document.getElementById("prof-destaque-nome").textContent = profDestaque[0];
    document.getElementById("prof-destaque-qtd").textContent = `${profDestaque[1]} agendamentos`;
    // Opcional: buscar foto do profissional
    document.getElementById("avatar-prof").src = ""; // Preencha com URL real se disponível
  } else {
    document.getElementById("prof-destaque-nome").textContent = "Nenhum profissional";
    document.getElementById("prof-destaque-qtd").textContent = "";
    document.getElementById("avatar-prof").src = "";
  }

  // Ocupação (percentual)
  const totalSlots = 10; // ajuste para sua lógica de slots diários
  const ocupacaoPercent = Math.round((ags.length / totalSlots) * 100);
  desenharOcupacao(ocupacaoPercent);
  document.getElementById("ocupacao-texto").textContent = `Sua agenda está ${ocupacaoPercent}% ocupada hoje`;

  // Comparativo com ontem
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate()-1);
  const agOntemSnap = await getDocs(
    query(
      collection(db, "empresarios", empresaId, "agendamentos"),
      where("data", ">=", ontem),
      where("data", "<", hoje)
    )
  );
  const agOntemQtd = agOntemSnap.size;
  const diff = ags.length - agOntemQtd;
  const diffPercent = agOntemQtd ? Math.round((diff / agOntemQtd) * 100) : 0;
  document.getElementById("comparativo-percent").textContent = (diffPercent >= 0 ? "+" : "") + diffPercent + "%";
  document.getElementById("comparativo-texto").textContent = `Você tem ${Math.abs(diffPercent)}% ${diffPercent >= 0 ? "mais" : "menos"} agendamentos que ontem`;

  // Alerta de horários próximos (opcional e seguro)
  let alerta = false;
  ags.sort((a,b)=>new Date(a.horario)-new Date(b.horario));
  for (let i=1; i<ags.length; i++) {
    const h1 = new Date(ags[i-1].horario);
    const h2 = new Date(ags[i].horario);
    if ((h2-h1)/60000 < 15) alerta = true;
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
    if (!ags.find(ag=>new Date(ag.horario).getHours()===h)) horariosBaixa.push(h);
  }
  if (horariosBaixa.length) {
    document.getElementById("ia-sugestao").textContent = `Ofereça desconto para horários das ${horariosBaixa[0]}h às ${horariosBaixa[horariosBaixa.length-1]}h, estão com baixa ocupação.`;
    document.getElementById("btn-promocao").style.display = "";
  } else {
    document.getElementById("ia-sugestao").textContent = "Agenda cheia em todos os horários!";
    document.getElementById("btn-promocao").style.display = "none";
  }
}

// Autenticação e carregamento
onAuthStateChanged(auth, user => {
  if (!user) {
    alert("Faça login para acessar o dashboard!");
    return;
  }
  preencherDashboard(user).catch(err => {
    alert("Erro ao carregar dados: " + err.message);
  });
});

// Exportar resumo do dia (opcional, sem dependências externas)
document.getElementById("btn-exportar").addEventListener("click", () => {
  window.print(); // simples, pode ser substituído por html2canvas/pdf depois
});

// Botão promoção (exemplo)
document.getElementById("btn-promocao").addEventListener("click", () => {
  alert("Função de criar promoção em desenvolvimento!");
});
