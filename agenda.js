import { getFirestore, collection, getDocs, query, where, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const agendamentosCollection = collection(db, "agendamentos");
const servicosCollection = collection(db, "servicos");

// ELEMENTOS DA PÁGINA
const listaAgendamentosDiv = document.getElementById('lista-agendamentos');
const dataInput = document.getElementById('data-agenda');
const modal = document.getElementById('modal-confirmacao');
const modalTitulo = document.getElementById('modal-titulo');
const modalMensagem = document.getElementById('modal-mensagem');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');

// Função para mostrar a confirmação personalizada
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

// FUNÇÃO PRINCIPAL COM FILTRO POR DATA (campo 'horario' como Timestamp Firestore)
async function carregarAgendamentosDoFirebase(dataFiltro) {
  listaAgendamentosDiv.innerHTML = `<p>Buscando agendamentos para ${new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-BR')}...</p>`;

  try {
    // Carrega serviços para mostrar nome do serviço no agendamento
    const servicosSnapshot = await getDocs(servicosCollection);
    const servicosMap = new Map();
    servicosSnapshot.forEach(doc => { servicosMap.set(doc.id, doc.data()); });

    // Cria objetos Date para início e fim do dia (UTC)
    const inicioDoDia = new Date(`${dataFiltro}T00:00:00.000Z`);
    const fimDoDia = new Date(`${dataFiltro}T23:59:59.999Z`);

    // Consulta com filtro por campo Timestamp 'horario'
    const agendamentosQuery = query(
      agendamentosCollection, 
      where("horario", ">=", inicioDoDia), 
      where("horario", "<=", fimDoDia),
      orderBy("horario", "asc")
    );

    const agendamentosSnapshot = await getDocs(agendamentosQuery);

    if (agendamentosSnapshot.empty) {
      listaAgendamentosDiv.innerHTML = `<p>Nenhum agendamento encontrado para o dia ${new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-BR')}.</p>`;
      return;
    }

    listaAgendamentosDiv.innerHTML = '';
    agendamentosSnapshot.forEach(doc => {
      const agendamento = doc.data();
      const agendamentoId = doc.id;

      const servicoDoAgendamento = servicosMap.get(agendamento.servicoId);
      const nomeServico = servicoDoAgendamento ? servicoDoAgendamento.nome : 'Serviço Inválido';

      // Converte Timestamp para Date
      const dataHora = agendamento.horario.toDate(); 
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
    if (error.code === 'failed-precondition') {
        alert("IMPORTANTE: O banco de dados precisa de um índice para a busca por data. Verifique o Console do Desenvolvedor para o link de criação automática.");
        listaAgendamentosDiv.innerHTML = '<p style="color:red;">É necessário criar um índice no Firebase. Siga as instruções no console.</p>';
    } else {
        listaAgendamentosDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar a agenda.</p>';
    }
  }
}

async function cancelarAgendamento(id) {
  const confirmado = await mostrarConfirmacao("Cancelar Agendamento", "Tem certeza? Esta ação é permanente.");
  if (confirmado) {
    try {
      await deleteDoc(doc(db, "agendamentos", id));
      Toastify({ text: "Agendamento cancelado.", style: { background: "var(--cor-perigo)" } }).showToast();
      carregarAgendamentosDoFirebase(dataInput.value); // Recarrega a lista para a data atual
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      Toastify({ text: "Falha ao cancelar o agendamento.", style: { background: "var(--cor-perigo)" } }).showToast();
    }
  }
}

// Ouvinte para botão cancelar
listaAgendamentosDiv.addEventListener('click', (event) => {
  if (event.target && event.target.classList.contains('btn-cancelar')) {
    cancelarAgendamento(event.target.dataset.id);
  }
});

// Ouvinte para mudança da data do filtro
dataInput.addEventListener('change', () => {
  const dataSelecionada = dataInput.value;
  if (dataSelecionada) {
    carregarAgendamentosDoFirebase(dataSelecionada);
  }
});

// Função para formatar data de hoje no formato YYYY-MM-DD
function getHojeFormatado() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Inicializa a página com a data de hoje e carrega os agendamentos
const hoje = getHojeFormatado();
dataInput.value = hoje;
carregarAgendamentosDoFirebase(hoje);
