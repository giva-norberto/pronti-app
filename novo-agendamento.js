/**
 * novo-agendamento.js (Versão Inteligente)
 * * Este script agora detecta se um serviço foi pré-selecionado
 * a partir da página da vitrine e o seleciona automaticamente.
 * Nenhuma lógica de cálculo existente foi alterada.
 */

import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const servicosCollection = collection(db, "servicos");
const agendamentosCollection = collection(db, "agendamentos");

// Seus elementos do HTML originais
const form = document.getElementById('form-agendamento');
const clienteInput = document.getElementById('cliente');
const servicoSelect = document.getElementById('servico');
const diaInput = document.getElementById('dia');
const gradeHorariosDiv = document.getElementById('grade-horarios');
const horarioFinalInput = document.getElementById('horario-final');

// Suas constantes originais
const HORA_INICIO = 9;
const HORA_FIM = 18;
const INTERVALO_MINUTOS = 30;

// =======================================================
// SUAS FUNÇÕES ORIGINAIS (INTACTAS)
// =======================================================

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

// Seu listener de formulário original (INTACTO)
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!horarioFinalInput.value) {
    // Supondo que você use uma biblioteca como Toastify.js
    alert("Por favor, selecione um horário.");
    return;
  }
  const novoAgendamento = {
    cliente: clienteInput.value,
    servicoId: servicoSelect.value,
    horario: horarioFinalInput.value
  };
  try {
    await addDoc(agendamentosCollection, novoAgendamento);
    alert("Agendamento salvo com sucesso!");
    window.location.href = 'agenda.html';
  } catch (error) {
    console.error("Erro ao salvar agendamento: ", error);
    alert("Erro ao salvar o agendamento.");
  }
});


// =======================================================
// NOVA LÓGICA DE INICIALIZAÇÃO (ACRESCENTADA)
// =======================================================

/**
 * Função principal que inicializa a página.
 * Ela carrega os serviços e depois verifica se algum foi pré-selecionado.
 */
async function inicializarPaginaDeAgendamento() {
  // Passo 1: Carrega os serviços no dropdown (sua função original)
  await carregarServicosDoFirebase();

  // Passo 2: Verifica a URL para pré-selecionar o serviço
  const urlParams = new URLSearchParams(window.location.search);
  const servicoIdFromUrl = urlParams.get('servico');

  if (servicoIdFromUrl) {
    console.log("Serviço pré-selecionado da vitrine:", servicoIdFromUrl);
    
    // Define o valor do select para o ID do serviço vindo da URL
    servicoSelect.value = servicoIdFromUrl;

    // Dispara o evento 'change' para que a grade de horários seja atualizada
    // como se o próprio usuário tivesse selecionado o serviço.
    servicoSelect.dispatchEvent(new Event('change'));
  }
}

// Seus listeners de eventos originais (INTACTOS)
servicoSelect.addEventListener('change', gerarEExibirHorarios);
diaInput.addEventListener('change', gerarEExibirHorarios);

// Inicia a página chamando a nova função de inicialização
inicializarPaginaDeAgendamento();
