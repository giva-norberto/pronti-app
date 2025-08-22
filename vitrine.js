// O Maestro da Aplicação (Versão otimizada para Mobile)

import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, salvarAgendamento, buscarAgendamentosDoCliente, cancelarAgendamento, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import * as UI from './vitrini-ui.js';

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);

        const empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("ID da Empresa não encontrado na URL.");

        const [dados, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId),
            getProfissionaisDaEmpresa(empresaId),
            getTodosServicosDaEmpresa(empresaId)
        ]);

        if (!dados) throw new Error("Empresa não encontrada.");
        
        setEmpresa(empresaId, dados);
        setProfissionais(profissionais);
        setTodosOsServicos(todosServicos);
        
        UI.renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos);
        UI.renderizarProfissionais(state.listaProfissionais);
        
        configurarEventosGerais();
        setupAuthListener(handleUserAuthStateChange);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        document.getElementById("vitrine-loader").innerHTML = `<p style="color:red;">${error.message}</p>`;
    } finally {
        UI.toggleLoader(false);
    }
});

// --- CONFIGURAÇÃO DE EVENTOS (Delegação centralizada) ---
function configurarEventosGerais() {
    document.addEventListener('click', async (e) => {
        try {
            if (e.target.matches('.sidebar-menu .menu-btn')) handleMenuClick(e);
            else if (e.target.closest('#lista-profissionais .card-profissional')) handleProfissionalClick(e);
            else if (e.target.closest('#lista-servicos .card-servico')) handleServicoClick(e);
            else if (e.target.closest('#grade-horarios .btn-horario')) handleHorarioClick(e);
            else if (e.target.matches('#btn-login')) await fazerLogin();
            else if (e.target.matches('#btn-logout')) await fazerLogout();
            else if (e.target.matches('#btn-confirmar-agendamento')) await handleConfirmarAgendamento();
            else if (e.target.matches('#botoes-agendamento .btn-toggle')) await handleFiltroAgendamentos(e);
            else if (e.target.matches('#lista-agendamentos-visualizacao .btn-cancelar')) await handleCancelarClick(e);
        } catch (err) {
            console.error("Erro em evento:", err);
        }
    });

    // debounce para input de data
    let dataTimeout;
    document.getElementById('data-agendamento').addEventListener('change', (e) => {
        clearTimeout(dataTimeout);
        dataTimeout = setTimeout(() => handleDataChange(e), 200);
    });
}

// --- HANDLERS ---
function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    if (user && document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

function handleMenuClick(e) {
    const menuKey = e.target.getAttribute('data-menu');
    UI.trocarAba(`menu-${menuKey}`);
    if (menuKey === 'visualizacao' && state.currentUser) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;

    resetarAgendamento();
    UI.resetFormSelecoes();

    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);

    try {
        UI.toggleLoader(true, "Carregando horários...");
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional);

        const servicosDoProfissional = (profissional.servicos || [])
            .map(id => state.todosOsServicos.find(s => s.id === id))
            .filter(Boolean);

        UI.selecionarCard('profissional', profissionalId);
        UI.mostrarContainerForm(true);
        UI.renderizarServicos(servicosDoProfissional);
    } catch (err) {
        console.error("Erro ao carregar profissional:", err);
    } finally {
        UI.toggleLoader(false);
    }
}

async function handleServicoClick(e) {
    const card = e.target.closest('.card-servico');
    if (!card) return;

    setAgendamento('data', null);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');

    const servicoId = card.dataset.id;
    const servico = state.todosOsServicos.find(s => s.id === servicoId);
    setAgendamento('servico', servico);

    UI.selecionarCard('servico', servicoId);
    UI.atualizarStatusData(true, 'Procurando data disponível...');

    try {
        const primeiraDataDisponivel = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional);
        const dataInput = document.getElementById('data-agendamento');

        if (primeiraDataDisponivel) {
            dataInput.value = primeiraDataDisponivel;
            dataInput.disabled = false;
            dataInput.dispatchEvent(new Event('change'));
        } else {
            UI.renderizarHorarios([], 'Nenhuma data disponível nos próximos 3 meses.');
        }
    } catch (err) {
        console.error("Erro ao buscar datas:", err);
        UI.renderizarHorarios([], 'Erro ao carregar datas.');
    }
}

async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');

    const { profissional, servico, data } = state.agendamento;
    if (!profissional || !servico || !data) return;

    try {
        UI.renderizarHorarios([], 'Carregando horários...');
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);

        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, servico.duracao);
        UI.renderizarHorarios(slots);
    } catch (err) {
        console.error("Erro ao calcular horários:", err);
        UI.renderizarHorarios([], 'Erro ao calcular horários.');
    }
}

function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn) return;
    
    setAgendamento('horario', btn.dataset.horario);
    UI.selecionarCard('horario', btn.dataset.horario);
    document.getElementById('btn-confirmar-agendamento').disabled = false;
}

async function handleConfirmarAgendamento() {
    if (!state.currentUser) {
        UI.trocarAba('menu-perfil');
        alert("Você precisa fazer login para confirmar o agendamento.");
        return;
    }
    const { profissional, servico, data, horario } = state.agendamento;
    if (!profissional || !servico || !data || !horario) return;
    
    const btn = document.getElementById('btn-confirmar-agendamento');
    btn.disabled = true;
    btn.textContent = 'Agendando...';

    try {
        await salvarAgendamento(state.empresaId, state.currentUser, state.agendamento);
    } catch (err) {
        console.error("Erro ao salvar agendamento:", err);
    } finally {
        btn.textContent = 'Confirmar Agendamento';
        btn.disabled = false;
    }
}

async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle')) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';

    UI.selecionarFiltro(modo);
    UI.renderizarAgendamentosComoCards([], 'Buscando...');

    try {
        const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
        UI.renderizarAgendamentosComoCards(agendamentos, modo);
    } catch (err) {
        console.error("Erro ao buscar agendamentos:", err);
        UI.renderizarAgendamentosComoCards([], 'Erro ao carregar.');
    }
}

async function handleCancelarClick(e) {
    const agendamentoId = e.target.dataset.id;
    if (!agendamentoId) return;

    const confirmou = confirm("Tem certeza que deseja cancelar este agendamento?");
    if (!confirmou) return;

    try {
        await cancelarAgendamento(state.empresaId, agendamentoId, () => {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        });
    } catch (err) {
        console.error("Erro ao cancelar:", err);
    }
}
