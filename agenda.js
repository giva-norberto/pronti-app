import { getFirestore, collection, getDocs, query, where, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const agendamentosCollection = collection(db, "agendamentos");
const servicosCollection = collection(db, "servicos");

const listaAgendamentosDiv = document.getElementById('lista-agendamentos');
const dataInput = document.getElementById('data-agenda');
const modal = document.getElementById('modal-confirmacao');
const modalTitulo = document.getElementById('modal-titulo');
const modalMensagem = document.getElementById('modal-mensagem');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');

function mostrarConfirmacao(titulo, mensagem) {
  modalTitulo.textContent = titulo;
  modalMensagem.textContent = mensagem;
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('visivel'), 10);
  return new Promise((resolve) => {
    btnModalConfirmar.onclick = () => {
      modal.classList.remove('visivel');
      setTimeout(() => modal.style.display = 'none', 300);
      resolve(true);
    };
    btnModalCancelar.onclick = () => {
      modal.classList.remove('visivel');
      setTimeout(() => modal.style.display = 'none', 300);
      resolve(false);
    };
  });
}

async function carregarAgendamentosDoFirebase(dataFiltro) {
  listaAgendamentosDiv.innerHTML = `<p>Buscando agendamentos para ${new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-BR')}...</p>`;

  try {
    // Carrega serviços
    const servicosSnapshot = await getDocs(servicosCollection);
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => servicosMap.set(doc.id, doc.data()));

    // Strings ISO para filtro (UTC)
    const dataInicio = `${dataFiltro}T00:00:00.000Z`;
    const dataFim = `${dataFiltro}T23:59:59.999Z`;

    const q = query(
      agendamentosCollection,
      where("horario", ">=", dataInicio),
      where("horario", "<=", dataFim),
      orderBy("horario", "asc")
    );

    const agendamentosSnapshot = await getDocs(q);

    if (agendamentosSnapshot.empty) {
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para o dia ${new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-BR')}.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    agendamentosSnapshot.forEach(doc => {
      const agendamento = doc.data();
      const agendamentoId = doc.id;

      const servico = servicosMap.get(agendamento.servicoId);
      const nomeServico = servico ? servico.nome : 'Serviço Inválido';

      // Como horario é string ISO, converte para Date para exibir hora legível
      const dataHora = new Date(agendamento.horario);
      const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const el = document.createElement('div');
      el.classList.add('agendamento-item');
      el.dataset.id = agendamentoId;
      el.innerHTML = `
        <div class="agendamento-info">
          <h3>${nomeServico}</h3>
          <p><strong>Cliente:</strong> ${agendamento.cliente}</p>
          <p><strong>Horário:</strong> ${horaFormatada}</p>
        </div>
        <div class="agendamento-acoes">
          <button class="btn-cancelar" data-id="${agendamentoId}">Cancelar</button>
        </div>
      `;
      listaAgendamentosDiv.appendChild(el);
    });
  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    listaAgendamentosDiv.innerHTML = '<p style="color:red;">Erro ao carregar agendamentos.</p>';
  }
}

async function cancelarAgendamento(id) {
  const confirmado = await mostrarConfirmacao("Cancelar Agendamento", "Tem certeza? Esta ação é permanente.");
  if (confirmado) {
    try {
      await deleteDoc(doc(db, "agendamentos", id));
      alert("Agendamento cancelado.");
      carregarAgendamentosDoFirebase(dataInput.value);
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      alert("Falha ao cancelar o agendamento.");
    }
  }
}

listaAgendamentosDiv.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-cancelar')) {
    cancelarAgendamento(e.target.dataset.id);
  }
});

dataInput.addEventListener('change', () => {
  if (dataInput.value) carregarAgendamentosDoFirebase(dataInput.value);
});

function getHojeFormatado() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

const hoje = getHojeFormatado();
dataInput.value = hoje;
carregarAgendamentosDoFirebase(hoje);

