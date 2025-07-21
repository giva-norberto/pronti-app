import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const servicosCollection = collection(db, "servicos");
const agendamentosCollection = collection(db, "agendamentos");

const form = document.getElementById('form-agendamento');
const clienteInput = document.getElementById('cliente');
const servicoSelect = document.getElementById('servico');
const diaInput = document.getElementById('dia');
const gradeHorariosDiv = document.getElementById('grade-horarios');
const horarioFinalInput = document.getElementById('horario-final');

const HORA_INICIO = 9;
const HORA_FIM = 18;
const INTERVALO_MINUTOS = 30;

// (A função carregarServicosDoFirebase continua a mesma)
async function carregarServicosDoFirebase() {
  servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
  try {
    const querySnapshot = await getDocs(servicosCollection);
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${servico.nome} (duração: ${servico.duracao} min)`;
      servicoSelect.appendChild(option);
    });
  } catch (error) { console.error("Erro ao carregar serviços:", error); }
}

// (A função gerarEExibirHorarios continua a mesma)
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
    const agendamentosQuery = query(agendamentosCollection, where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const querySnapshot = await getDocs(agendamentosQuery);
    const agendamentosDoDia = querySnapshot.docs.map(doc => doc.data());
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
  } catch (error) { console.error("Erro ao buscar horários:", error); }
}

// Lida com o envio do formulário, AGORA COM NOTIFICAÇÃO
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!horarioFinalInput.value) {
    Toastify({ text: "Por favor, selecione um horário.", style: { background: "#f59e0b" } }).showToast();
    return;
  }
  const novoAgendamento = {
    cliente: clienteInput.value,
    servicoId: servicoSelect.value,
    horario: horarioFinalInput.value
  };
  try {
    await addDoc(agendamentosCollection, novoAgendamento);
    Toastify({ text: "Agendamento salvo com sucesso!", style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } }).showToast();
    setTimeout(() => { window.location.href = 'agenda.html'; }, 2000);
  } catch (error) {
    console.error("Erro ao salvar agendamento: ", error);
    Toastify({ text: "Erro ao salvar o agendamento.", style: { background: "#dc3545" } }).showToast();
  }
});

carregarServicosDoFirebase();
servicoSelect.addEventListener('change', gerarEExibirHorarios);
diaInput.addEventListener('change', gerarEExibirHorarios);