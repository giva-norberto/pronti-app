/**
 * novo-agendamento.js
 * Gerencia a criação de agendamentos, vinculando a profissionais específicos.
 * Busca serviços, profissionais que os executam e horários de trabalho para calcular a disponibilidade.
 * Firebase Modular v10+
 */

import { db, auth } from "./firebase-config.js";
import { collection, getDocs, query, where, doc, addDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- Elementos do DOM ---
const formAgendamento = document.getElementById("form-agendamento");
const selectServico = document.getElementById("servico");
const selectProfissional = document.getElementById("profissional");
const inputData = document.getElementById("dia");
const gradeHorarios = document.getElementById("grade-horarios");
const inputHorarioFinal = document.getElementById("horario-final");
const inputClienteNome = document.getElementById("cliente");

let empresaId = null;
let servicosCache = [];
let profissionaisCache = [];

// --- MULTIEMPRESA: Pega empresaId da empresa ativa do localStorage ---
function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId") || null;
}

// --- FUNÇÕES UTILITÁRIAS ---
function mostrarToast(texto, cor = '#38bdf8') {
  if (typeof Toastify !== "undefined") {
    Toastify({ text: texto, duration: 4000, gravity: "top", position: "center", style: { background: cor, color: "white", borderRadius: "8px" } }).showToast();
  } else {
    alert(texto);
  }
}

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// --- LÓGICA PRINCIPAL DA PÁGINA ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      empresaId = getEmpresaIdAtiva();
      if (empresaId) await inicializarFormulario();
      else document.body.innerHTML = "<h1>Nenhuma empresa ativa selecionada.</h1>";
    } catch (error) {
      console.error("Erro na inicialização:", error);
      document.body.innerHTML = "<h1>Ocorreu um erro ao iniciar.</h1>";
    }
  } else {
    window.location.href = "login.html";
  }
});

async function inicializarFormulario() {
    await carregarDadosIniciais();

    selectServico.addEventListener("change", popularSelectProfissionais);
    selectProfissional.addEventListener("change", buscarHorariosDisponiveis);
    inputData.addEventListener("change", buscarHorariosDisponiveis);

    // Clique em slot de horário - revisado para garantir funcionalidade e visual
    gradeHorarios.addEventListener("click", (e) => {
        // Só permite selecionar se for realmente um slot habilitado
        if (e.target.classList.contains("slot-horario") && !e.target.classList.contains("desabilitado")) {
            // Remove seleção anterior
            document.querySelectorAll('.slot-horario.selecionado').forEach(slot => slot.classList.remove('selecionado'));
            // Marca o slot clicado
            e.target.classList.add('selecionado');
            // Seta o valor no campo oculto (ou visível) do horário
            inputHorarioFinal.value = e.target.dataset.hora || e.target.textContent;
        }
    });

    formAgendamento.addEventListener("submit", salvarAgendamento);
}

async function carregarDadosIniciais() {
    try {
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");

        const [servicosSnapshot, profissionaisSnapshot] = await Promise.all([
            getDocs(servicosRef),
            getDocs(profissionaisRef)
        ]);

        servicosCache = servicosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        profissionaisCache = profissionaisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Popula o select de serviços
        selectServico.innerHTML = '<option value="">Selecione um serviço</option>';
        servicosCache.forEach(servico => {
            selectServico.appendChild(new Option(`${servico.nome} (${servico.duracao} min)`, servico.id));
        });

    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        mostrarToast("Erro ao carregar serviços e profissionais.", "#ef4444");
    }
}

function popularSelectProfissionais() {
    const servicoId = selectServico.value;
    selectProfissional.innerHTML = '<option value="">Primeiro, selecione um serviço</option>';
    selectProfissional.disabled = true;
    gradeHorarios.innerHTML = '<p class="aviso-horarios">Preencha os campos acima para ver os horários.</p>';

    if (!servicoId) return;

    // Filtra os profissionais que oferecem o serviço selecionado
    const profissionaisFiltrados = profissionaisCache.filter(p =>
        p.servicos && p.servicos.includes(servicoId)
    );

    if (profissionaisFiltrados.length > 0) {
        selectProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
        profissionaisFiltrados.forEach(p => {
            selectProfissional.appendChild(new Option(p.nome, p.id));
        });
        selectProfissional.disabled = false;
    } else {
        selectProfissional.innerHTML = '<option value="">Nenhum profissional para este serviço</option>';
    }
}

async function buscarHorariosDisponiveis() {
    const servicoId = selectServico.value;
    const profissionalId = selectProfissional.value;
    const dataSelecionada = inputData.value;

    if (!servicoId || !profissionalId || !dataSelecionada) {
        gradeHorarios.innerHTML = `<p class="aviso-horarios">Preencha os campos acima para ver os horários.</p>`;
        return;
    }

    gradeHorarios.innerHTML = `<p class="aviso-horarios">A verificar horários...</p>`;

    try {
        const profissional = profissionaisCache.find(p => p.id === profissionalId);
        const servico = servicosCache.find(s => s.id === servicoId);

        // Busca os horários de trabalho do profissional
        const horariosTrabalhoRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId, "configuracoes", "horarios");
        const horariosTrabalhoSnap = await getDoc(horariosTrabalhoRef);
        const horariosTrabalho = horariosTrabalhoSnap.exists() ? horariosTrabalhoSnap.data() : null;

        if (!horariosTrabalho) {
            gradeHorarios.innerHTML = `<p class="aviso-horarios" style="color: red;">Este profissional não tem horários configurados.</p>`;
            return;
        }

        const agendamentosDoDia = await getAgendamentosDoDia(dataSelecionada, profissionalId);
        const slotsDisponiveis = calcularSlotsDisponiveis(dataSelecionada, agendamentosDoDia, horariosTrabalho, servico.duracao);

        gradeHorarios.innerHTML = '';
        if (slotsDisponiveis.length === 0) {
            gradeHorarios.innerHTML = `<p class="aviso-horarios">Nenhum horário disponível para esta data.</p>`;
            return;
        }

        // Cria slots clicáveis e deixa o valor do horário também como data-hora (mais robusto)
        slotsDisponiveis.forEach(horario => {
            const slot = document.createElement('div');
            slot.className = 'slot-horario';
            slot.textContent = horario;
            slot.setAttribute('data-hora', horario);
            gradeHorarios.appendChild(slot);
        });

        // Limpa seleção anterior e campo oculto
        inputHorarioFinal.value = '';

    } catch (error) {
        console.error("Erro ao buscar horários:", error);
        gradeHorarios.innerHTML = `<p class="aviso-horarios" style="color: red;">Erro ao carregar horários.</p>`;
    }
}

async function salvarAgendamento(e) {
    e.preventDefault();
    const servicoId = selectServico.value;
    const profissionalId = selectProfissional.value;
    const servico = servicosCache.find(s => s.id === servicoId);
    const profissional = profissionaisCache.find(p => p.id === profissionalId);

    const novoAgendamento = {
        clienteNome: inputClienteNome.value,
        servicoId,
        servicoNome: servico.nome,
        profissionalId,
        profissionalNome: profissional.nome,
        data: inputData.value,
        horario: inputHorarioFinal.value,
        status: 'ativo',
        criadoEm: serverTimestamp()
    };

    if (!novoAgendamento.horario) {
        mostrarToast("Por favor, selecione um horário.", "#ef4444");
        return;
    }

    try {
        await addDoc(collection(db, "empresarios", empresaId, "agendamentos"), novoAgendamento);
        mostrarToast("Agendamento salvo com sucesso!", "#34d399");
        formAgendamento.reset();
        gradeHorarios.innerHTML = `<p class="aviso-horarios">Preencha os campos acima para ver os horários.</p>`;
        selectProfissional.innerHTML = '<option value="">Primeiro, selecione um serviço</option>';
        selectProfissional.disabled = true;
        setTimeout(() => { window.location.href = 'agenda.html'; }, 1500);
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        mostrarToast("Erro ao salvar agendamento.", "#ef4444");
    }
}

// --- Funções de Apoio ---

async function getAgendamentosDoDia(data, profissionalId) {
    const q = query(collection(db, "empresarios", empresaId, "agendamentos"),
        where("data", "==", data),
        where("profissionalId", "==", profissionalId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
}

function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00`);
    const nomeDia = diaDaSemana[dataObj.getDay()];
    const diaDeTrabalho = horariosTrabalho?.[nomeDia];

    if (!diaDeTrabalho || !diaDeTrabalho.ativo || !diaDeTrabalho.blocos) return [];

    const slotsDisponiveis = [];
    const horariosOcupados = agendamentosDoDia.map(ag => {
        const inicio = timeStringToMinutes(ag.horario);
        const fim = inicio + (ag.servicoDuracao || duracaoServico);
        return { inicio, fim };
    });

    diaDeTrabalho.blocos.forEach(bloco => {
        let slotAtual = timeStringToMinutes(bloco.inicio);
        const fimBloco = timeStringToMinutes(bloco.fim);

        while (slotAtual + duracaoServico <= fimBloco) {
            const fimSlotProposto = slotAtual + duracaoServico;
            let temConflito = horariosOcupados.some(ocupado =>
                slotAtual < ocupado.fim && fimSlotProposto > ocupado.inicio
            );

            if (!temConflito) {
                slotsDisponiveis.push(minutesToTimeString(slotAtual));
            }
            slotAtual += (horariosTrabalho.intervalo || duracaoServico);
        }
    });
    return slotsDisponiveis;
}
