// Firebase Modular v10.12.2 e Chart.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Seu config real
const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function pad2(n){ return String(n).padStart(2,'0'); }
function formatHora(date){ return date instanceof Date ? `${pad2(date.getHours())}:${pad2(date.getMinutes())}` : ''; }

function gerarResumoDiarioInteligente(agendamentos){
  if(!Array.isArray(agendamentos) || agendamentos.length===0){
    return { totalAtendimentos: 0, mensagem: "Nenhum agendamento para hoje." };
  }
  const ord = [...agendamentos].sort((a,b)=>a.inicio-b.inicio);
  const total = ord.length;
  let faturamento = 0;
  ord.forEach(a=>faturamento += Number(a.servico.preco)||0);

  const primeiro = {
    horario: formatHora(ord[0].inicio),
    servico: ord[0].servico.nome||'Serviço',
    cliente: ord[0].cliente.nome||'Cliente'
  };
  const ultimo = {
    horario: formatHora(ord[ord.length-1].inicio),
    servico: ord[ord.length-1].servico.nome||'Serviço',
    cliente: ord[ord.length-1].cliente.nome||'Cliente'
  };

  let maiorIntervalo = null;
  for(let i=0;i<ord.length-1;i++){
    const fimAtual = ord[i].fim, inicioProx = ord[i+1].inicio;
    const durMin = Math.round((inicioProx-fimAtual)/60000);
    if(durMin>0 && (!maiorIntervalo || durMin>maiorIntervalo.duracaoMinutos)){
      maiorIntervalo = {
        duracaoMinutos: durMin,
        inicio: formatHora(fimAtual),
        fim: formatHora(inicioProx)
      };
    }
  }
  return {
    totalAtendimentos: total,
    mensagem: `Você tem ${total} atendimentos hoje. Faturamento estimado: R$ ${faturamento.toFixed(2).replace('.',',')}.`,
    primeiro, ultimo, faturamentoEstimado: faturamento, maiorIntervalo
  };
}

function criarHTMLDoResumo(resumo){
  if(!resumo) return '';
  if(resumo.totalAtendimentos===0){
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
          <strong>R$ ${resumo.faturamentoEstimado.toFixed(2).replace('.',',')}</strong>
        </div>`;
  if(resumo.maiorIntervalo){
    html += `<div class="metrica">
      <span>🕓 Maior Intervalo</span>
      <strong>${resumo.maiorIntervalo.inicio} - ${resumo.maiorIntervalo.fim} (${resumo.maiorIntervalo.duracaoMinutos} min)</strong>
    </div>`;
  }
  html += `</div><p class="resumo-footer">Boa sorte com seu dia! 💪</p></div>`;
  return html;
}

let graficoMensalInstance = null, graficoServicosInstance = null, graficoFaturamentoInstance = null;

function gerarGraficoMensal(agendamentos){
  const filtroMesInicio = document.getElementById('filtro-mes-inicio');
  const filtroAnoInicio = document.getElementById('filtro-ano-inicio');
  const filtroMesFim = document.getElementById('filtro-mes-fim');
  const filtroAnoFim = document.getElementById('filtro-ano-fim');
  const canvas = document.getElementById('graficoMensal');
  if(!canvas) return;

  const anos = [...new Set(
    agendamentos
      .filter(ag=>ag.horario&&typeof ag.horario.toDate==='function')
      .map(ag=>ag.horario.toDate().getFullYear())
  )].sort((a,b)=>b-a);

  if(filtroAnoInicio&&filtroAnoFim){
    filtroAnoInicio.innerHTML = '';
    filtroAnoFim.innerHTML = '';
    anos.forEach(ano=>{
      const o1=document.createElement('option'); o1.value=ano; o1.textContent=ano; filtroAnoInicio.appendChild(o1);
      const o2=document.createElement('option'); o2.value=ano; o2.textContent=ano; filtroAnoFim.appendChild(o2);
    });
    if(!anos.length){
      const anoAtual = new Date().getFullYear();
      const opt1=document.createElement('option'); opt1.value=anoAtual; opt1.textContent=anoAtual; filtroAnoInicio.appendChild(opt1);
      const opt2=document.createElement('option'); opt2.value=anoAtual; opt2.textContent=anoAtual; filtroAnoFim.appendChild(opt2);
    }
  }

  if(filtroMesInicio) filtroMesInicio.value = filtroMesInicio.value || '0';
  if(filtroMesFim) filtroMesFim.value = filtroMesFim.value || '11';
  if(filtroAnoInicio) filtroAnoInicio.value = filtroAnoInicio.value || (anos[0]||new Date().getFullYear());
  if(filtroAnoFim) filtroAnoFim.value = filtroAnoFim.value || (anos[0]||new Date().getFullYear());

  const atualizarGrafico = () => {
    const inicioAno = Number(filtroAnoInicio?.value||new Date().getFullYear());
    const inicioMes = Number(filtroMesInicio?.value||0);
    const fimAno = Number(filtroAnoFim?.value||new Date().getFullYear());
    const fimMes = Number(filtroMesFim?.value||11);

    const dataInicio = new Date(inicioAno, inicioMes, 1, 0,0,0,0);
    const dataFim = new Date(fimAno, fimMes+1, 0, 23,59,59,999);

    const filtrados = agendamentos.filter(ag=>ag.horario&&typeof ag.horario.toDate==='function'&&(() => {
      const d=ag.horario.toDate();
      return d>=dataInicio&&d<=dataFim;
    })());

    const contagem = {};
    filtrados.forEach(ag=>{
      const d=ag.horario.toDate();
      const mesAno=d.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
      contagem[mesAno]=(contagem[mesAno]||0)+1;
    });

    const labels = Object.keys(contagem).sort((a,b)=>{
      const [mesAStr,anoA]=a.split(' ');
      const [mesBStr,anoB]=b.split(' ');
      const meses={jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
      const mA=meses[mesAStr.replace('.','').toLowerCase()]??0;
      const mB=meses[mesBStr.replace('.','').toLowerCase()]??0;
      return new Date(Number(anoA),mA)-new Date(Number(anoB),mB);
    });
    const data = labels.map(l=>contagem[l]);

    if(graficoMensalInstance) graficoMensalInstance.destroy();
    const ctx=canvas.getContext('2d');
    graficoMensalInstance = new window.Chart(ctx, {
      type:'bar',
      data:{
        labels,
        datasets:[{
          label:'Total de Agendamentos',
          data,
          backgroundColor:'rgba(75,192,192,0.5)',
          borderColor:'rgb(75,192,192)',
          borderWidth:1
        }]
      },
      plugins: (typeof window.ChartDataLabels!=='undefined')?[window.ChartDataLabels]:[],
      options:{
        scales:{y:{beginAtZero:true,ticks:{stepSize:1}}},
        plugins:{
          legend:{display:false},
          datalabels:{anchor:'end',align:'top',formatter:Math.round,font:{weight:'bold'}}
        },
        responsive:true
      }
    });
  };

  [filtroMesInicio,filtroAnoInicio,filtroMesFim,filtroAnoFim].forEach(el=>{
    if(el) el.addEventListener('change', atualizarGrafico);
  });
  atualizarGrafico();
}

function gerarGraficoServicos(servicosMap, agendamentos){
  const canvas=document.getElementById('graficoServicos');
  if(!canvas) return;

  const contagem={};
  agendamentos.forEach(ag=>{
    const id=ag.servicoId;
    contagem[id]=(contagem[id]||0)+1;
  });

  const labels=Object.keys(contagem).map(id=>servicosMap.get(id)?.nome||'Desconhecido');
  const data=Object.values(contagem);

  if(graficoServicosInstance) graficoServicosInstance.destroy();
  const ctx=canvas.getContext('2d');
  graficoServicosInstance = new window.Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'Nº de Agendamentos',
        data,
        backgroundColor:'rgba(13,110,253,0.5)',
        borderColor:'rgba(13,110,253,1)',
        borderWidth:1
      }]
    },
    options:{
      scales:{y:{beginAtZero:true,ticks:{stepSize:1}}},
      responsive:true,
      plugins:{legend:{display:false}}
    }
  });
}

function gerarGraficoFaturamento(servicosMap, agendamentos){
  const canvas=document.getElementById('graficoFaturamento');
  if(!canvas) return;

  const fatur={};
  agendamentos.forEach(ag=>{
    const s=servicosMap.get(ag.servicoId);
    if(s&&s.preco!==undefined){
      const p=parseFloat(s.preco)||0;
      fatur[ag.servicoId]=(fatur[ag.servicoId]||0)+p;
    }
  });

  const labels=Object.keys(fatur).map(id=>servicosMap.get(id)?.nome||'Desconhecido');
  const data=Object.values(fatur);

  if(graficoFaturamentoInstance) graficoFaturamentoInstance.destroy();
  const ctx=canvas.getContext('2d');
  graficoFaturamentoInstance = new window.Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'Faturamento (R$)',
        data,
        backgroundColor:[
          'rgba(255,99,132,0.7)',
          'rgba(54,162,235,0.7)',
          'rgba(255,206,86,0.7)',
          'rgba(75,192,192,0.7)',
          'rgba(153,102,255,0.7)'
        ]
      }]
    },
    options:{
      indexAxis:'y',
      scales:{x:{beginAtZero:true,title:{display:true,text:'Faturamento (R$)'}}},
      responsive:true,
      plugins:{legend:{display:false}}
    }
  });
}

async function carregarDashboard(uid){
  try{
    const servicosCollection=collection(db,"users",uid,"servicos");
    const agendamentosCollection=collection(db,"users",uid,"agendamentos");

    const [servicosSnapshot,agendamentosSnapshot]=await Promise.all([
      getDocs(servicosCollection),
      getDocs(agendamentosCollection)
    ]);

    const agendamentos=agendamentosSnapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    const servicosMap=new Map();
    servicosSnapshot.forEach(doc=>servicosMap.set(doc.id,doc.data()));

    processarResumoIA(agendamentos,servicosMap);
    if(document.getElementById('graficoServicos')) gerarGraficoServicos(servicosMap,agendamentos);
    if(document.getElementById('graficoFaturamento')) gerarGraficoFaturamento(servicosMap,agendamentos);
    if(document.getElementById('graficoMensal')) gerarGraficoMensal(agendamentos);
  }catch(err){
    console.error("Erro ao carregar dados do dashboard:",err);
    const container=document.querySelector('.dashboard-grid')||document.querySelector('.main-content');
    if(container) container.innerHTML='<p style="color:red;">Não foi possível carregar os dados do dashboard.</p>';
  }
}

function processarResumoIA(todosAgendamentos,servicosMap){
  const container=document.getElementById('resumo-diario-container');
  if(!container) return;

  container.innerHTML='<p>🧠 Analisando seu dia...</p>';

  const hoje=new Date();
  const inicioDoDia=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate(),0,0,0,0);
  const fimDoDia=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate(),23,59,59,999);

  const agendamentosDeHoje=todosAgendamentos.filter(ag=>ag.horario&&typeof ag.horario.toDate==='function').filter(ag=>{
    const d=ag.horario.toDate();
    return d>=inicioDoDia&&d<=fimDoDia;
  });

  const agendamentosEnriquecidos=agendamentosDeHoje.map(ag=>{
    const servico=servicosMap.get(ag.servicoId);
    if(!servico) return null;
    const inicio=ag.horario.toDate();
    const durMin=Number(servico.duracao)||30;
    const fim=new Date(inicio.getTime()+durMin*60000);
    return {
      id:ag.id,
      cliente:{nome:ag.clienteNome||ag.cliente?.nome||'Cliente'},
      servico:{nome:servico.nome||'Serviço',preco:servico.preco||0,duracao:durMin},
      inicio,
      fim
    };
  }).filter(Boolean);

  const resumo=gerarResumoDiarioInteligente(agendamentosEnriquecidos);
  container.innerHTML=criarHTMLDoResumo(resumo);
}

document.addEventListener('DOMContentLoaded',()=>{
  onAuthStateChanged(auth,(user)=>{
    if(user){
      carregarDashboard(user.uid);
    }else{
      try{window.location.href='login.html';}
      catch(e){console.warn('Redirecionamento falhou:',e);}
    }
  });
});
