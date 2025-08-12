import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Botão voltar para o menu principal (igual ao da equipe/vitrine, mantendo o formato visual do dashboard)
window.addEventListener("DOMContentLoaded", () => {
  const btnVoltar = document.querySelector('.btn-voltar');
  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => {
      // Volta para o menu principal do dashboard (não apenas history.back)
      // Remove 'ativo' de todos os menus e conteúdos
      document.querySelectorAll('.sidebar-menu .menu-btn.ativo').forEach(el => el.classList.remove('ativo'));
      document.querySelectorAll('.main-content-dashboard .menu-content.ativo').forEach(el => el.classList.remove('ativo'));
      // Adiciona 'ativo' ao menu principal
      const menuBtn = document.querySelector('.sidebar-menu .menu-btn[data-menu="principal"]');
      if (menuBtn) menuBtn.classList.add('ativo');
      const menuContent = document.getElementById('menu-principal');
      if (menuContent) menuContent.classList.add('ativo');
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

  // Agendamentos do dia
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  let agQuery;
  const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
  if (isDono) {
    agQuery = query(
      agCollection,
      where("data", ">=", hoje),
      where("data", "<", amanha)
    );
  } else {
    agQuery = query(
      agCollection,
      where("data", ">=", hoje),
      where("data", "<", amanha),
      where("clienteUid", "==", user.uid)
    );
  }
  const agSnap = await getDocs(agQuery);
  const ags = agSnap.docs.map(doc => doc.data());

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
  document.getElementById("ocupacao-texto").textContent = `Sua agenda está ${ocupacaoPercent}% ocupada hoje`;

  // Comparativo com ontem
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate()-1);
  const agOntemQuery = query(
    agCollection,
    where("data", ">=", ontem),
    where("data", "<", hoje)
  );
  const agOntemSnap = await getDocs(agOntemQuery);
  const agOntemQtd = agOntemSnap.size;
  const diff = ags.length - agOntemQtd;
  const diffPercent = agOntemQtd ? Math.round((diff / agOntemQtd) * 100) : 0;
  document.getElementById("comparativo-percent").textContent = (diffPercent >= 0 ? "+" : "") + diffPercent + "%";
  document.getElementById("comparativo-texto").textContent = `Você tem ${Math.abs(diffPercent)}% ${diffPercent >= 0 ? "mais" : "menos"} agendamentos que ontem`;

  // Alerta de horários próximos
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
