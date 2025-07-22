import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

// Elementos do HTML
const form = document.getElementById('form-agendamento');
const clienteInput = document.getElementById('cliente');
const servicoSelect = document.getElementById('servico');
const diaInput = document.getElementById('dia');
const gradeHorariosDiv = document.getElementById('grade-horarios');
const horarioFinalInput = document.getElementById('horario-final');

const HORA_INICIO = 9;
const HORA_FIM = 18;
const INTERVALO_MINUTOS = 30;

// FUNÇÃO PARA PEGAR O UID do empresário (você pode adaptar de acordo com seu contexto)
// Se estiver passando na URL, descomente essa linha:
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid'); // Certifique-se de passar isso na URL ou definir de outra forma

if (!uid) {
  alert("UID do empresário não fornecido. Verifique a URL.");
  throw new Error("UID do empresário não fornecido.");
}

// Carrega os serviços do Firestore na coleção do usuário
async function carregarServicosDoFirebase() {
  servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
  try {
    const servicosCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosCollection);
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${servico.nome} (duração: ${servico.duracao} min)`;
      servicoSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
  }
}

async function gerarEExibirHorarios() {
  const diaSelecionado = diaInput.value;
  const servicoId = servicoSelect.value;
  if (!diaSelecionado || !servicoId) {
    gradeHorariosDiv.innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data.</p>';
    return;
  }
  gradeHorariosDiv.innerHTML = '<p class="aviso-horarios">Verificando horários...</p>';
  try {
    const inicioDoDia = new Date(`${diaSelecionado}T00:00:00`).toISOString();
    const fimDoDia = new Date(`${diaSelecionado}T23:59:59`).toISOString();
    const agendamentosCollection = collection(db, "users", uid, "agendamentos"); // buscar agendamentos do empresário
    const agendamentosQuery = query(agendamentosCollection, where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const querySnapshot = await getDocs(agendamentosQuery);
    const agendamentosDoDia = querySnapshot.docs.map(doc => doc.data());

    // Pega horários já ocupados
    const horariosOcupados = agendamentosDoDia.map(ag => {
      const dataLocal = new Date(ag.horario);
      return `${String(dataLocal.getHours()).padStart(2, '0')}:${String(dataLocal.getMinutes()).padStart(2, '0')}`;
    });

    gradeHorariosDiv.innerHTML = '';

    for (let hora = HORA_INICIO; hora < HORA_FIM; hora++) {
      for (let min = 0; min < 60; min += INTERVALO_MINUTOS) {
        const horarioParaVerificar = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const estaOcupado = horariosOcupados.includes(horarioParaVerificar);
        const slotButton = document.createElement('button');
        slotButton.type = 'button';
        slotButton.classList.add('slot-horario');
        slotButton.textContent = horarioParaVerificar;
        if (estaOcupado) {
          slotButton.classList.add('desabilitado');
          slotButton.disabled = true;
        } else {
          slotButton.addEventListener('click', () => {
            document.querySelectorAll('.slot-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            slotButton.classList.add('selecionado');
            const horarioFinalISO = new Date(`${diaSelecionado}T${horarioParaVerificar}:00`).toISOString();
            horarioFinalInput.value = horarioFinalISO;
          });
        }
        gradeHorariosDiv.appendChild(slotButton);
      }
    }
  } catch (error) {
    console.error("Erro ao buscar horários:", error);
  }
}

// Submissão do formulário
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!horarioFinalInput.value) {
    alert("Por favor, selecione um horário.");
    return;
  }

  const novoAgendamento = {
    cliente: clienteInput.value,
    servicoId: servicoSelect.value,
    horario: horarioFinalInput.value
  };

  try {
    const agendamentosCollection = collection(db, "users", uid, "agendamentos");
    await addDoc(agendamentosCollection, novoAgendamento);
    alert("Agendamento salvo com sucesso!");
    window.location.href = 'agenda.html'; // ou outra página de confirmação
  } catch (error) {
    console.error("Erro ao salvar agendamento: ", error);
    alert("Erro ao salvar o agendamento.");
  }
});

// Inicialização da página
async function inicializarPaginaDeAgendamento() {
  await carregarServicosDoFirebase();

  const servicoIdFromUrl = urlParams.get('servico');
  if (servicoIdFromUrl) {
    console.log("Serviço pré-selecionado:", servicoIdFromUrl);
    servicoSelect.value = servicoIdFromUrl;
    servicoSelect.dispatchEvent(new Event('change'));
  }
}

// Listeners para atualizar horários
servicoSelect.addEventListener('change', gerarEExibirHorarios);
diaInput.addEventListener('change', gerarEExibirHorarios);

// Chama a inicialização
inicializarPaginaDeAgendamento();
