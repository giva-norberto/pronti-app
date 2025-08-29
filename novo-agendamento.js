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
                dadosProf.horarios = horariosSnap.data(); // <- esse é seu JSON de horários!
            }
        } catch (e) {
            // Ignorar se não existir
        }
        profissionaisCache.push(dadosProf);
    }

    selectServico.innerHTML = '<option value="">Selecione um serviço</option>';
    servicosCache.forEach(servico => {
        selectServico.appendChild(new Option(`${servico.nome} (${servico.duracao} min)`, servico.id));
    });
}

function popularSelectProfissionais() {
    const servicoId = selectServico.value;
    selectProfissional.innerHTML = '<option value="">Primeiro, selecione um serviço</option>';
    selectProfissional.disabled = true;
    gradeHorarios.innerHTML = '<p class="aviso-horarios">Preencha os campos acima para ver os horários.</p>';
    if (!servicoId) return;

    // Profissionais que executam o serviço
    const profissionaisFiltrados = profissionaisCache.filter(p => p.servicos && p.servicos.includes(servicoId));
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

    // Busca profissional no cache, busca horários no campo .horarios do profissional
    const profissional = profissionaisCache.find(p => p.id === profissionalId);
    const servico = servicosCache.find(s => s.id === servicoId);

    if (!profissional || !profissional.horarios) {
        gradeHorarios.innerHTML = `<p class="aviso-horarios" style="color: red;">Este profissional não tem horários configurados.</p>`;
        return;
    }

    const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataSelecionada, profissionalId);
    const slotsDisponiveis = calcularSlotsDisponiveis(dataSelecionada, agendamentosDoDia, profissional.horarios, servico.duracao);

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
    if (!diaDeTrabalho || !diaDeTrabalho.ativo || !diaDeTrabalho.blocos || diaDeTrabalho.blocos.length === 0) {
        return [];
    }
    const intervaloEntreSessoes = horariosTrabalho.intervalo || 0;
    const slotsDisponiveis = [];
    const horariosOcupados = agendamentosDoDia.map(ag => {
        const inicio = timeStringToMinutes(ag.horario);
        const fim = inicio + (ag.servicoDuracao || duracaoServico);
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
    const servicoId = selectServico.value;
    const profissionalId = selectProfissional.value;
    const servico = servicosCache.find(s => s.id === servicoId);
    const profissional = profissionaisCache.find(p => p.id === profissionalId);

    // Checagem extra: profissional precisa ter horários ativos
    if (!profissional || !profissional.horarios) {
        mostrarToast("Este profissional não tem horários configurados.", "#ef4444");
        return;
    }

    const novoAgendamento = {
        clienteNome: inputClienteNome.value,
        servicoId,
        servicoNome: servico.nome,
        servicoDuracao: servico.duracao,
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
