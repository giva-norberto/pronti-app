import { db, auth } from "./firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- Funções auxiliares ---
function timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}
function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
function mostrarToast(texto, cor = '#38bdf8') {
    if (typeof Toastify !== "undefined") {
        Toastify({
            text: texto,
            duration: 4000,
            gravity: "top",
            position: "center",
            style: { background: cor, color: "white", borderRadius: "8px" }
        }).showToast();
    } else {
        alert(texto);
    }
}
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

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

// --- Lógica principal ---
onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "login.html";
    empresaId = getEmpresaIdAtiva();
    if (!empresaId) {
        document.body.innerHTML = "<h1>Nenhuma empresa ativa selecionada.</h1>";
        return;
    }
    await carregarDadosIniciais();
    selectServico.addEventListener("change", popularSelectProfissionais);
    selectProfissional.addEventListener("change", buscarHorariosDisponiveis);
    inputData.addEventListener("change", buscarHorariosDisponiveis);
    gradeHorarios.addEventListener("click", selecionarHorarioSlot);
    formAgendamento.addEventListener("submit", salvarAgendamento);
});

async function carregarDadosIniciais() {
    const servicosRef = collection(db, "empresarios", empresaId, "servicos");
    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
    const [servicosSnapshot, profissionaisSnapshot] = await Promise.all([
        getDocs(servicosRef),
        getDocs(profissionaisRef)
    ]);
    servicosCache = servicosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Carrega profissionais e também busca os horários de cada um no subdocumento "configuracoes/horarios"
    profissionaisCache = [];
    for (const docProf of profissionaisSnapshot.docs) {
        let dadosProf = { id: docProf.id, ...docProf.data() };
        // Busca o subdocumento 'configuracoes/horarios'
        try {
            const horariosSnap = await getDoc(doc(
                db,
                "empresarios", empresaId,
                "profissionais", docProf.id,
                "configuracoes", "horarios"
            ));
            if (horariosSnap.exists()) {
                dadosProf.horarios = horariosSnap.data();
            }
        } catch (e) {
            // Ignorar se não existir
        }
        profissionaisCache.push(dadosProf);
    }

    // Permitir seleção múltipla de serviços se qualquer profissional permitir
    const permitirMultiplo = profissionaisCache.some(p => p.horarios && p.horarios.permitirAgendamentoMultiplo);
    if (permitirMultiplo) selectServico.setAttribute("multiple", "multiple");
    else selectServico.removeAttribute("multiple");

    selectServico.innerHTML = '<option value="">Selecione um serviço</option>';
    servicosCache.forEach(servico => {
        selectServico.appendChild(new Option(`${servico.nome} (${servico.duracao} min)`, servico.id));
    });
}

function popularSelectProfissionais() {
    // Para múltiplos serviços, mostra todos profissionais que fazem pelo menos um deles
    const servicoIds = Array.from(selectServico.selectedOptions).map(opt => opt.value);
    selectProfissional.innerHTML = '<option value="">Primeiro, selecione um serviço</option>';
    selectProfissional.disabled = true;
    gradeHorarios.innerHTML = '<p class="aviso-horarios">Preencha os campos acima para ver os horários.</p>';
    if (!servicoIds.length || servicoIds[0] === "") return;

    const profissionaisFiltrados = profissionaisCache.filter(p =>
        p.servicos && servicoIds.some(sid => p.servicos.includes(sid))
    );
    if (profissionaisFiltrados.length > 0) {
        selectProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
        profissionaisFiltrados.forEach(p => {
            selectProfissional.appendChild(new Option(p.nome, p.id));
        });
        selectProfissional.disabled = false;
    } else {
        selectProfissional.innerHTML = '<option value="">Nenhum profissional para estes serviços</option>';
    }
}

async function buscarHorariosDisponiveis() {
    const servicoIds = Array.from(selectServico.selectedOptions).map(opt => opt.value);
    const profissionalId = selectProfissional.value;
    const dataSelecionada = inputData.value;
    if (!servicoIds.length || !profissionalId || !dataSelecionada) {
        gradeHorarios.innerHTML = `<p class="aviso-horarios">Preencha os campos acima para ver os horários.</p>`;
        return;
    }

    gradeHorarios.innerHTML = `<p class="aviso-horarios">A verificar horários...</p>`;

    const profissional = profissionaisCache.find(p => p.id === profissionalId);
    const servicosSelecionados = servicosCache.filter(s => servicoIds.includes(s.id));
    if (!profissional || !profissional.horarios) {
        gradeHorarios.innerHTML = `<p class="aviso-horarios" style="color: red;">Este profissional não tem horários configurados.</p>`;
        return;
    }

    // Calcular duração total dos serviços selecionados
    let duracaoTotal = 0;
    if (profissional.horarios.permitirAgendamentoMultiplo) {
        duracaoTotal = servicosSelecionados.reduce((total, s) => total + (s.duracao || 0), 0);
    } else {
        duracaoTotal = servicosSelecionados[0]?.duracao || 0;
    }

    const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataSelecionada, profissionalId);
    const slotsDisponiveis = calcularSlotsDisponiveis(
        dataSelecionada,
        agendamentosDoDia,
        profissional.horarios,
        duracaoTotal
    );

    gradeHorarios.innerHTML = '';
    if (slotsDisponiveis.length === 0) {
        gradeHorarios.innerHTML = `<p class="aviso-horarios">Nenhum horário disponível para esta data.</p>`;
        return;
    }

    slotsDisponiveis.forEach(horario => {
        const slot = document.createElement('div');
        slot.className = 'slot-horario';
        slot.textContent = horario;
        slot.setAttribute('data-hora', horario);
        gradeHorarios.appendChild(slot);
    });
    inputHorarioFinal.value = '';
}

// --- Funções de slots (igual vitrine) ---
function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00Z`);
    const nomeDia = diaDaSemana[dataObj.getUTCDay()];
    const diaDeTrabalho = horariosTrabalho?.[nomeDia];
    // Intervalo pode estar no objeto do dia OU no principal:
    const intervaloEntreSessoes = diaDeTrabalho?.intervalo || horariosTrabalho.intervalo || 0;

    if (!diaDeTrabalho || !diaDeTrabalho.ativo || !diaDeTrabalho.blocos || diaDeTrabalho.blocos.length === 0) {
        return [];
    }
    const slotsDisponiveis = [];
    const horariosOcupados = agendamentosDoDia.map(ag => {
        const inicio = timeStringToMinutes(ag.horario);
        const fim = inicio + (ag.servicoDuracao || ag.duracaoTotal || duracaoServico);
        return { inicio, fim };
    });

    const hoje = new Date();
    const ehHoje = hoje.toISOString().split('T')[0] === data;
    const minutosAgora = timeStringToMinutes(
        `${hoje.getHours().toString().padStart(2, '0')}:${hoje.getMinutes().toString().padStart(2, '0')}`
    );

    for (const bloco of diaDeTrabalho.blocos) {
        let slotAtualEmMinutos = timeStringToMinutes(bloco.inicio);
        const fimDoBlocoEmMinutos = timeStringToMinutes(bloco.fim);

        while (slotAtualEmMinutos + duracaoServico <= fimDoBlocoEmMinutos) {
            const fimDoSlotProposto = slotAtualEmMinutos + duracaoServico;
            let temConflito = horariosOcupados.some(ocupado =>
                slotAtualEmMinutos < ocupado.fim && fimDoSlotProposto > ocupado.inicio
            );
            if (
                !temConflito &&
                (!ehHoje || slotAtualEmMinutos > minutosAgora)
            ) {
                slotsDisponiveis.push(minutesToTimeString(slotAtualEmMinutos));
            }
            slotAtualEmMinutos += intervaloEntreSessoes || duracaoServico;
        }
    }
    return slotsDisponiveis;
}

async function buscarAgendamentosDoDia(empresaId, data, profissionalId) {
    const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
    const q = query(
        agendamentosRef,
        where("data", "==", data),
        where("profissionalId", "==", profissionalId),
        where("status", "==", "ativo")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Slot de horário selecionável (igual vitrine) ---
function selecionarHorarioSlot(e) {
    if (e.target.classList.contains("slot-horario")) {
        document.querySelectorAll('.slot-horario.selecionado').forEach(slot => slot.classList.remove('selecionado'));
        e.target.classList.add('selecionado');
        inputHorarioFinal.value = e.target.dataset.hora || e.target.textContent;
    }
}

// --- Salvar Agendamento ---
async function salvarAgendamento(e) {
    e.preventDefault();
    const servicoIds = Array.from(selectServico.selectedOptions).map(opt => opt.value);
    const profissionalId = selectProfissional.value;
    const profissional = profissionaisCache.find(p => p.id === profissionalId);
    const servicosSelecionados = servicosCache.filter(s => servicoIds.includes(s.id));

    if (!profissional || !profissional.horarios) {
        mostrarToast("Este profissional não tem horários configurados.", "#ef4444");
        return;
    }
    if (!servicosSelecionados.length) {
        mostrarToast("Selecione pelo menos um serviço.", "#ef4444");
        return;
    }

    let duracaoTotal = 0;
    if (profissional.horarios.permitirAgendamentoMultiplo) {
        duracaoTotal = servicosSelecionados.reduce((total, s) => total + (s.duracao || 0), 0);
    } else {
        duracaoTotal = servicosSelecionados[0]?.duracao || 0;
    }

    const novoAgendamento = {
        clienteNome: inputClienteNome.value,
        servicos: servicosSelecionados.map(s => ({
            id: s.id,
            nome: s.nome,
            duracao: s.duracao
        })),
        duracaoTotal,
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
