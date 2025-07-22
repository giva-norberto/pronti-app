/**
 * novo-agendamento.js (Painel do Dono - Corrigido para Multi-Usuário)
 * * Este script foi atualizado para carregar os serviços e salvar os agendamentos
 * * na pasta segura do utilizador que está autenticado.
 */

import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Elementos do formulário
const form = document.getElementById('form-agendamento');
const clienteInput = document.getElementById('cliente');
const servicoSelect = document.getElementById('servico');
const diaInput = document.getElementById('dia');
const gradeHorariosDiv = document.getElementById('grade-horarios');
const horarioFinalInput = document.getElementById('horario-final');

// Constantes de horário
const HORA_INICIO = 9;
const HORA_FIM = 18;
const INTERVALO_MINUTOS = 30;

// --- ESTRUTURA DE INICIALIZAÇÃO SEGURA ---
// Garante que o código só rode após a confirmação do login.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // O utilizador está autenticado.
        const uid = user.uid;
        inicializarPaginaDeAgendamento(uid);
    } else {
        // O utilizador não está autenticado.
        console.log("Nenhum utilizador autenticado. A redirecionar para o login...");
        window.location.href = 'login.html';
    }
});

/**
 * Função principal que inicializa a página.
 * Ela carrega os serviços e depois verifica se algum foi pré-selecionado.
 * @param {string} uid - O ID do utilizador autenticado.
 */
async function inicializarPaginaDeAgendamento(uid) {
  // Carrega os serviços no dropdown.
  await carregarServicosDoFirebase(uid);

  // Verifica a URL para pré-selecionar o serviço (vindo da vitrine).
  const urlParams = new URLSearchParams(window.location.search);
  const servicoIdFromUrl = urlParams.get('servico');

  if (servicoIdFromUrl) {
    servicoSelect.value = servicoIdFromUrl;
    // Dispara o evento 'change' para que a grelha de horários seja atualizada.
    servicoSelect.dispatchEvent(new Event('change'));
  }

  // Adiciona os listeners de eventos.
  servicoSelect.addEventListener('change', () => gerarEExibirHorarios(uid));
  diaInput.addEventListener('change', () => gerarEExibirHorarios(uid));
  form.addEventListener('submit', (event) => handleFormSubmit(event, uid));
}


// --- SUAS FUNÇÕES ORIGINAIS (ADAPTADAS PARA O UID) ---

async function carregarServicosDoFirebase(uid) {
  servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
  try {
    // MUDANÇA: Aponta para a coleção segura do utilizador.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${servico.nome} (duração: ${servico.duracao} min)`;
      servicoSelect.appendChild(option);
    });
  } catch (error) { console.error("Erro ao carregar serviços:", error); }
}

async function gerarEExibirHorarios(uid) {
  const diaSelecionado = diaInput.value;
  const servicoId = servicoSelect.value;
  if (!diaSelecionado || !servicoId) {
    gradeHorariosDiv.innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data.</p>';
    return;
  }
  gradeHorariosDiv.innerHTML = '<p class="aviso-horarios">A verificar horários...</p>';
  try {
    const inicioDoDia = new Date(`${diaSelecionado}T00:00:00`).toISOString();
    const fimDoDia = new Date(`${diaSelecionado}T23:59:59`).toISOString();
    
    // MUDANÇA: Aponta para a coleção segura do utilizador.
    const agendamentosUserCollection = collection(db, "users", uid, "agendamentos");
    const agendamentosQuery = query(agendamentosUserCollection, where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    
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

async function handleFormSubmit(event, uid) {
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
    // MUDANÇA: Aponta para a coleção segura do utilizador.
    const agendamentosUserCollection = collection(db, "users", uid, "agendamentos");
    await addDoc(agendamentosUserCollection, novoAgendamento);
    alert("Agendamento salvo com sucesso!");
    window.location.href = 'agenda.html';
  } catch (error) {
    console.error("Erro ao salvar agendamento: ", error);
    alert("Erro ao salvar o agendamento.");
  }
}


