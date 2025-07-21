import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const agendamentosCollection = collection(db, "agendamentos");
const servicosCollection = collection(db, "servicos");
const listaAgendamentosDiv = document.getElementById('lista-agendamentos');

// (A função carregarAgendamentosDoFirebase continua a mesma)
async function carregarAgendamentosDoFirebase() {
  listaAgendamentosDiv.innerHTML = "<p>Carregando agenda...</p>";
  try {
    const servicosSnapshot = await getDocs(servicosCollection);
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => { servicosMap.set(doc.id, doc.data()); });
    const agendamentosQuery = query(agendamentosCollection, orderBy("horario", "desc"));
    const agendamentosSnapshot = await getDocs(agendamentosQuery);
    if (agendamentosSnapshot.empty) {
      listaAgendamentosDiv.innerHTML = '<p>Nenhum agendamento encontrado.</p>';
      return;
    }
    listaAgendamentosDiv.innerHTML = '';
    agendamentosSnapshot.forEach(doc => {
      const agendamento = doc.data();
      const agendamentoId = doc.id;
      const servicoDoAgendamento = servicosMap.get(agendamento.servicoId);
      const nomeServico = servicoDoAgendamento ? servicoDoAgendamento.nome : 'Serviço Inválido';
      const dataHora = new Date(agendamento.horario);
      const dataFormatada = dataHora.toLocaleDateString('pt-BR');
      const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const agendamentoElemento = document.createElement('div');
      agendamentoElemento.classList.add('agendamento-item');
      if (!servicoDoAgendamento) { agendamentoElemento.style.borderLeftColor = '#dc3545'; }
      agendamentoElemento.innerHTML = `
        <div class="agendamento-info">
          <h3 style="${!servicoDoAgendamento ? 'color:#dc3545;' : ''}">${nomeServico}</h3>
          <p><strong>Cliente:</strong> ${agendamento.cliente}</p>
          <p><strong>Data:</strong> ${dataFormatada} às ${horaFormatada}</p>
        </div>
        <div class="agendamento-acoes">
          <button class="btn-cancelar" data-id="${agendamentoId}">Cancelar</button>
        </div>
      `;
      listaAgendamentosDiv.appendChild(agendamentoElemento);
    });
  } catch (error) { console.error("Erro ao buscar agendamentos:", error); }
}


// Função de cancelar, AGORA COM NOTIFICAÇÃO
async function cancelarAgendamento(idDoDocumento) {
  if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
    try {
      await deleteDoc(doc(db, "agendamentos", idDoDocumento));
      Toastify({ text: "Agendamento cancelado com sucesso!", style: { background: "#dc3545" } }).showToast();
      carregarAgendamentosDoFirebase();
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      Toastify({ text: "Erro ao cancelar o agendamento.", style: { background: "red" } }).showToast();
    }
  }
}

listaAgendamentosDiv.addEventListener('click', (event) => {
  if (event.target && event.target.classList.contains('btn-cancelar')) {
    cancelarAgendamento(event.target.dataset.id);
  }
});

carregarAgendamentosDoFirebase();