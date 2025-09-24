// ======================================================================
// ARQUIVO: novo-agendamento.js (VERSÃO FINAL COM PROMOÇÕES INTEGRADAS)
// ======================================================================

import { db, auth } from "./firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    query,
    where,
    serverTimestamp,
    Timestamp // ✅ Adicionado para verificações de data
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- Funções auxiliares (Seu código original mantido) ---
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
// ✅ NOVA FUNÇÃO AUXILIAR PARA FORMATAR PREÇO
function formatarMoeda(valor) {
    if (typeof valor !== 'number') return 'R$ 0,00';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Elementos do DOM ---
const formAgendamento = document.getElementById("form-agendamento");
const selectServico = document.getElementById("servico");
const selectProfissional = document.getElementById("profissional");
const inputData = document.getElementById("dia");
const gradeHorarios = document.getElementById("grade-horarios");
const inputHorarioFinal = document.getElementById("horario-final");
const inputClienteNome = document.getElementById("cliente");
// ✅ NOVOS ELEMENTOS DO RESUMO DE PREÇO
const resumoAgendamentoDiv = document.getElementById('resumo-agendamento');
const precoOriginalSpan = document.getElementById('preco-original');
const precoFinalSpan = document.getElementById('preco-final');
const linhaDescontoDiv = document.getElementById('linha-desconto');
const descontoNomeSpan = document.getElementById('desconto-nome');
const descontoValorSpan = document.getElementById('desconto-valor');

// --- Variáveis de Estado ---
let empresaId = null;
let servicosCache = [];
let profissionaisCache = [];
// ✅ NOVAS VARIÁVEIS PARA ARMAZENAR PREÇOS
let precoOriginalTotal = 0;
let precoFinalTotal = 0;


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
    
    // ✅ NOVOS LISTENERS PARA ATUALIZAR O PREÇO
    selectServico.addEventListener("change", atualizarResumoDePreco);
    inputData.addEventListener("change", atualizarResumoDePreco);
    
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

    profissionaisCache = [];
    for (const docProf of profissionaisSnapshot.docs) {
        let dadosProf = { id: docProf.id, ...docProf.data() };
        try {
            const horariosSnap = await getDoc(doc(
                db, "empresarios", empresaId, "profissionais", docProf.id, "configuracoes", "horarios"
            ));
            if (horariosSnap.exists()) {
                dadosProf.horarios = horariosSnap.data();
            }
        } catch (e) { /* Ignorar se não existir */ }
        profissionaisCache.push(dadosProf);
    }

    const permitirMultiplo = profissionaisCache.some(p => p.horarios && p.horarios.permitirAgendamentoMultiplo);
    if (permitirMultiplo) {
        selectServico.setAttribute("multiple", "multiple");
        document.getElementById('aviso-multiplo').style.display = 'block';
    } else {
        selectServico.removeAttribute("multiple");
        document.getElementById('aviso-multiplo').style.display = 'none';
    }

    selectServico.innerHTML = '<option value="">Selecione um serviço</option>';
    servicosCache.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(servico => {
        // ✅ Preço adicionado à opção para clareza
        const textoOpcao = `${servico.nome} (${servico.duracao} min) - ${formatarMoeda(servico.preco)}`;
        selectServico.appendChild(new Option(textoOpcao, servico.id));
    });
}

// Sua função original mantida
function popularSelectProfissionais() {
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

// Sua função original mantida
async function buscarHorariosDisponiveis() {
    const servicoIds = Array.from(selectServico.selectedOptions).map(opt => opt.value);
    const profissionalId = selectProfissional.value;
    const dataSelecionada = inputData.value;
    if (!servicoIds.length || servicoIds[0] === "" || !profissionalId || !dataSelecionada) {
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
    
    let duracaoTotal = servicosSelecionados.reduce((total, s) => total + (s.duracao || 0), 0);
    // Se não permite multiplo, considera apenas o primeiro
    if (!profissional.horarios.permitirAgendamentoMultiplo && servicosSelecionados.length > 0) {
        duracaoTotal = servicosSelecionados[0].duracao || 0;
    }

    const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataSelecionada, profissionalId);
    const slotsDisponiveis = calcularSlotsDisponiveis(
        dataSelecionada, agendamentosDoDia, profissional.horarios, duracaoTotal
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

// Sua função original mantida
function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00Z`);
    const nomeDia = diaDaSemana[dataObj.getUTCDay()];
    const diaDeTrabalho = horariosTrabalho?.[nomeDia];
    const intervaloEntreSessoes = diaDeTrabalho?.intervalo || horariosTrabalho.intervalo || 0;

    if (!diaDeTrabalho || !diaDeTrabalho.ativo || !diaDeTrabalho.blocos || diaDeTrabalho.blocos.length === 0) return [];

    const slotsDisponiveis = [];
    const horariosOcupados = agendamentosDoDia.map(ag => {
        const inicio = timeStringToMinutes(ag.horario);
        const fim = inicio + (ag.duracaoTotal || duracaoServico);
        return { inicio, fim };
    });

    const hoje = new Date();
    const ehHoje = hoje.toISOString().split('T')[0] === data;
    const minutosAgora = timeStringToMinutes(`${hoje.getHours().toString().padStart(2, '0')}:${hoje.getMinutes().toString().padStart(2, '0')}`);

    for (const bloco of diaDeTrabalho.blocos) {
        let slotAtualEmMinutos = timeStringToMinutes(bloco.inicio);
        const fimDoBlocoEmMinutos = timeStringToMinutes(bloco.fim);

        while (slotAtualEmMinutos + duracaoServico <= fimDoBlocoEmMinutos) {
            const fimDoSlotProposto = slotAtualEmMinutos + duracaoServico;
            let temConflito = horariosOcupados.some(ocupado =>
                slotAtualEmMinutos < ocupado.fim && fimDoSlotProposto > ocupado.inicio
            );
            if (!temConflito && (!ehHoje || slotAtualEmMinutos > minutosAgora)) {
                slotsDisponiveis.push(minutesToTimeString(slotAtualEmMinutos));
            }
            slotAtualEmMinutos += intervaloEntreSessoes || duracaoServico;
        }
    }
    return slotsDisponiveis;
}

// Sua função original mantida
async function buscarAgendamentosDoDia(empresaId, data, profissionalId) {
    const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
    const q = query(
        agendamentosRef,
        where("data", "==", data),
        where("profissionalId", "==", profissionalId),
        where("status", "in", ["agendado", "confirmado", "ativo"]) // Considera múltiplos status
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Sua função original mantida
function selecionarHorarioSlot(e) {
    if (e.target.classList.contains("slot-horario")) {
        document.querySelectorAll('.slot-horario.selecionado').forEach(slot => slot.classList.remove('selecionado'));
        e.target.classList.add('selecionado');
        inputHorarioFinal.value = e.target.dataset.hora || e.target.textContent;
    }
}

// ✅ --- LÓGICA DE PROMOÇÕES E PREÇOS (SEÇÃO NOVA) ---

async function atualizarResumoDePreco() {
    const servicoIds = Array.from(selectServico.selectedOptions).map(opt => opt.value).filter(Boolean);
    const diaSelecionado = inputData.value;

    if (servicoIds.length === 0 || !diaSelecionado) {
        resumoAgendamentoDiv.style.display = 'none';
        return;
    }
    
    const dataObj = new Date(diaSelecionado + 'T12:00:00Z');
    const diaDaSemana = dataObj.getUTCDay();

    const promocoesDoDia = await buscarPromocoesAtivas(empresaId, diaDaSemana);

    let totalOriginal = 0;
    let totalFinal = 0;
    let descontoAplicado = false;
    let nomesPromocoes = new Set(); // Para evitar nomes duplicados

    for (const servicoId of servicoIds) {
        const servico = servicosCache.find(s => s.id === servicoId);
        if (servico) {
            const infoPreco = calcularPrecoComDesconto(servico, promocoesDoDia);
            totalOriginal += servico.preco;
            totalFinal += infoPreco.precoFinal;
            if(infoPreco.temDesconto) {
                descontoAplicado = true;
                nomesPromocoes.add(infoPreco.promocaoAplicada.nome || 'Promoção');
            }
        }
    }

    exibirResumo(totalOriginal, totalFinal, descontoAplicado, Array.from(nomesPromocoes));
}

async function buscarPromocoesAtivas(empresaId, diaDaSemana) {
    try {
        const promocoesRef = collection(db, "empresarios", empresaId, "precos_especiais");
        const q = query(promocoesRef, where("diasSemana", "array-contains", diaDaSemana), where("ativo", "==", true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar promoções:", error);
        return [];
    }
}

function calcularPrecoComDesconto(servico, promocoesDoDia) {
    const precoOriginal = servico.preco;
    const promocaoEspecifica = promocoesDoDia.find(p => p.servicoIds && p.servicoIds.includes(servico.id));
    const promocaoGeral = promocoesDoDia.find(p => p.servicoIds === null);
    const promocaoAplicavel = promocaoEspecifica || promocaoGeral;

    if (!promocaoAplicavel) {
        return { precoFinal: precoOriginal, temDesconto: false };
    }

    let precoFinal = precoOriginal;
    if (promocaoAplicavel.tipoDesconto === 'percentual') {
        precoFinal = precoOriginal * (1 - promocaoAplicavel.valor / 100);
    } else if (promocaoAplicavel.tipoDesconto === 'valorFixo') {
        precoFinal = precoOriginal - promocaoAplicavel.valor;
    }
    precoFinal = Math.max(0, precoFinal);

    return { precoFinal, temDesconto: true, promocaoAplicada: promocaoAplicavel };
}

function exibirResumo(totalOriginal, totalFinal, temDesconto, nomesDasPromos) {
    precoOriginalSpan.textContent = formatarMoeda(totalOriginal);
    precoFinalSpan.textContent = formatarMoeda(totalFinal);
    precoOriginalTotal = totalOriginal; // Salva para uso no submit
    precoFinalTotal = totalFinal; // Salva para uso no submit

    if (temDesconto) {
        const valorDoDesconto = totalOriginal - totalFinal;
        descontoNomeSpan.textContent = `Desconto (${nomesDasPromos.join(', ')})`;
        descontoValorSpan.textContent = `-${formatarMoeda(valorDoDesconto)}`;
        linhaDescontoDiv.style.display = 'flex';
    } else {
        linhaDescontoDiv.style.display = 'none';
    }
    resumoAgendamentoDiv.style.display = 'block';
}

// --- Salvar Agendamento (Sua função original MODIFICADA) ---
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

    let duracaoTotal = servicosSelecionados.reduce((total, s) => total + (s.duracao || 0), 0);
    if (!profissional.horarios.permitirAgendamentoMultiplo && servicosSelecionados.length > 0) {
        duracaoTotal = servicosSelecionados[0].duracao || 0;
    }

    // ✅ MODIFICAÇÃO: Inclusão dos campos de preço no objeto a ser salvo
    const novoAgendamento = {
        clienteNome: inputClienteNome.value,
        servicos: servicosSelecionados.map(s => ({
            id: s.id,
            nome: s.nome,
            duracao: s.duracao,
            preco: s.preco // Salva o preço original de cada serviço
        })),
        duracaoTotal,
        profissionalId,
        profissionalNome: profissional.nome,
        data: inputData.value,
        horario: inputHorarioFinal.value,
        status: 'ativo',
        criadoEm: serverTimestamp(),
        // ✅ NOVOS CAMPOS DE PREÇO
        precoOriginal: precoOriginalTotal,
        precoFinal: precoFinalTotal,
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
        // ✅ Esconder o resumo após salvar
        resumoAgendamentoDiv.style.display = 'none';
        setTimeout(() => { window.location.href = 'agenda.html'; }, 1500);
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        mostrarToast("Erro ao salvar agendamento.", "#ef4444");
    }
}
