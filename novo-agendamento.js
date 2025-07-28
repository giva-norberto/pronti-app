/**
 * novo-agendamento.js (Painel do Dono - Versão com UTC)
 */

import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-agendamento');
    const clienteInput = document.getElementById('cliente');
    const servicoSelect = document.getElementById('servico');
    const diaInput = document.getElementById('dia');
    const gradeHorariosDiv = document.getElementById('grade-horarios');
    const horarioFinalInput = document.getElementById('horario-final');

    if (!form || !servicoSelect || !diaInput || !gradeHorariosDiv) {
        console.error("Erro Crítico: Elementos do formulário não encontrados.");
        return;
    }

    let isInitialized = false;

    onAuthStateChanged(auth, (user) => {
        if (user && !isInitialized) {
            isInitialized = true;
            const uid = user.uid;
            inicializarPaginaDeAgendamento(uid, { form, clienteInput, servicoSelect, diaInput, gradeHorariosDiv, horarioFinalInput });
        } else if (!user && !isInitialized) {
            window.location.href = 'login.html';
        }
    });
});

async function inicializarPaginaDeAgendamento(uid, elements) {
  const { form, clienteInput, servicoSelect, diaInput, gradeHorariosDiv, horarioFinalInput } = elements;
  
  await carregarServicosDoFirebase(uid, servicoSelect);

  const urlParams = new URLSearchParams(window.location.search);
  const servicoIdFromUrl = urlParams.get('servico');

  if (servicoIdFromUrl) {
    servicoSelect.value = servicoIdFromUrl;
  }
  
  if (!diaInput.value) {
    diaInput.value = new Date().toISOString().split("T")[0];
  }
  gerarEExibirHorarios(uid, { diaInput, servicoSelect, gradeHorariosDiv, horarioFinalInput });

  servicoSelect.addEventListener('change', () => gerarEExibirHorarios(uid, { diaInput, servicoSelect, gradeHorariosDiv, horarioFinalInput }));
  diaInput.addEventListener('change', () => gerarEExibirHorarios(uid, { diaInput, servicoSelect, gradeHorariosDiv, horarioFinalInput }));
  form.addEventListener('submit', (event) => handleFormSubmit(event, uid, { clienteInput, servicoSelect, horarioFinalInput }));
}

async function carregarServicosDoFirebase(uid, servicoSelect) {
  servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
  try {
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);
    
    querySnapshot.forEach(docSnapshot => {
      const servico = docSnapshot.data();
      const option = document.createElement('option');
      option.value = docSnapshot.id;
      option.textContent = `${servico.nome} (duração: ${servico.duracao} min)`;
      option.dataset.servicoNome = servico.nome;
      servicoSelect.appendChild(option);
    });
  } catch (error) { 
    console.error("Erro ao carregar serviços:", error); 
  }
}

async function gerarEExibirHorarios(uid, elements) {
  const { diaInput, servicoSelect, gradeHorariosDiv, horarioFinalInput } = elements;
  const diaSelecionado = diaInput.value;
  const servicoId = servicoSelect.value;
  const HORA_INICIO = 9;
  const HORA_FIM = 18;
  const INTERVALO_MINUTOS = 30;

  if (!diaSelecionado || !servicoId) {
    gradeHorariosDiv.innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data.</p>';
    return;
  }
  gradeHorariosDiv.innerHTML = '<p class="aviso-horarios">A verificar horários...</p>';
  try {
    const inicioDoDia = new Date(`${diaSelecionado}T00:00:00.000Z`);
    const fimDoDia = new Date(`${diaSelecionado}T23:59:59.999Z`);
    
    const agendamentosUserCollection = collection(db, "users", uid, "agendamentos");
    const agendamentosQuery = query(agendamentosUserCollection, 
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)), 
        where("horario", "<=", Timestamp.fromDate(fimDoDia))
    );
    
    const querySnapshot = await getDocs(agendamentosQuery);
    const horariosOcupados = querySnapshot.docs.map(doc => {
        const dataUtc = doc.data().horario.toDate();
        return `${String(dataUtc.getUTCHours()).padStart(2, '0')}:${String(dataUtc.getUTCMinutes()).padStart(2, '0')}`;
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
            horarioFinalInput.value = horarioParaVerificar;
          });
        }
        gradeHorariosDiv.appendChild(slotButton);
      }
    }
  } catch (error) { console.error("Erro ao buscar horários:", error); }
}

async function handleFormSubmit(event, uid, elements) {
  const { clienteInput, servicoSelect, horarioFinalInput } = elements;
  event.preventDefault();

  const horarioSelecionado = horarioFinalInput.value;
  if (!horarioSelecionado) {
    alert("Por favor, selecione um horário.");
    return;
  }

  // CORREÇÃO UTC: Garante que a data salva seja universal
  const dataSelecionada = document.getElementById('dia').value;
  const [hora, minuto] = horarioSelecionado.split(':');
  
  const dataHoraCompleta = new Date(dataSelecionada + 'T00:00:00.000Z');
  dataHoraCompleta.setUTCHours(hora, minuto, 0, 0);

  const opcaoServicoSelecionado = servicoSelect.options[servicoSelect.selectedIndex];
  const nomeServico = opcaoServicoSelecionado.dataset.servicoNome;

  const novoAgendamento = {
    clienteNome: clienteInput.value,
    servicoId: servicoSelect.value,
    servicoNome: nomeServico,
    horario: Timestamp.fromDate(dataHoraCompleta),
    status: 'agendado',
    criadoEm: Timestamp.now()
  };

  try {
    const agendamentosUserCollection = collection(db, "users", uid, "agendamentos");
    await addDoc(agendamentosUserCollection, novoAgendamento);
    alert("Agendamento salvo com sucesso!");
    window.location.href = 'agenda.html';
  } catch (error) {
    console.error("Erro ao salvar agendamento: ", error);
    alert("Erro ao salvar o agendamento.");
  }
}
