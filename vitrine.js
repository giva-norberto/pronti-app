// vitrine.js - O Maestro da Aplicação (Revisado e Confirmado)

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

        UI.toggleLoader(false);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        document.getElementById("vitrine-loader").innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
});

// --- CONFIGURAÇÃO DE EVENTOS ---

function configurarEventosGerais() {
    document.querySelector('.sidebar-menu').addEventListener('click', handleMenuClick);
    document.getElementById('lista-profissionais').addEventListener('click', handleProfissionalClick);
    document.getElementById('lista-servicos').addEventListener('click', handleServicoClick);
    document.getElementById('data-agendamento').addEventListener('change', handleDataChange);
    document.getElementById('grade-horarios').addEventListener('click', handleHorarioClick);
    document.getElementById('btn-login').addEventListener('click', fazerLogin);
    document.getElementById('btn-logout').addEventListener('click', fazerLogout);
    document.getElementById('btn-confirmar-agendamento').addEventListener('click', handleConfirmarAgendamento);
    document.getElementById('botoes-agendamento').addEventListener('click', handleFiltroAgendamentos);
    document.getElementById('lista-agendamentos-visualizacao').addEventListener('click', handleCancelarClick);
}

// --- HANDLERS (As Funções que os Eventos Chamam) ---

function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    if(user && document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

function handleMenuClick(e) {
    if (e.target.matches('.menu-btn')) {
        const menuKey = e.target.getAttribute('data-menu');
        UI.trocarAba(`menu-${menuKey}`);
        if (menuKey === 'visualizacao' && state.currentUser) {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        }
    }
}

async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;

    resetarAgendamento();
    UI.limparSelecao('servico');
    UI.limparSelecao('horario');
    UI.mostrarContainerForm(false);
    UI.renderizarServicos([]);
    UI.renderizarHorarios([]);

    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    
    profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
    setAgendamento('profissional', profissional);

    const servicosDoProfissional = (profissional.servicos || []).map(servicoId => 
        state.todosOsServicos.find(servico => servico.id === servicoId)
    ).filter(Boolean);

    UI.selecionarCard('profissional', profissionalId);
    UI.mostrarContainerForm(true);
    UI.renderizarServicos(servicosDoProfissional);
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
    
    UI.atualizarStatusData(true, 'A procurar a data mais próxima com vagas...');

    const primeiraDataDisponivel = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional);

    if (primeiraDataDisponivel) {
        const dataInput = document.getElementById('data-agendamento');
        dataInput.value = primeiraDataDisponivel;
        dataInput.disabled = false;
        dataInput.dispatchEvent(new Event('change')); // Dispara o evento para carregar os horários
    } else {
        UI.renderizarHorarios([], 'Nenhuma data disponível para este profissional nos próximos 3 meses.');
    }
}

async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');

    const { profissional, servico, data } = state.agendamento;
    if (!profissional || !servico || !data) return;

    UI.renderizarHorarios([], 'A calcular horários...');
    const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
    const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);

    const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, servico.duracao);
    UI.renderizarHorarios(slots);
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
    btn.textContent = 'A agendar...';
    
    await salvarAgendamento(state.empresaId, state.currentUser, state.agendamento);
    btn.textContent = 'Confirmar Agendamento'; // Em caso de erro, volta ao normal
}

async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle')) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
    
    UI.selecionarFiltro(modo);

    UI.renderizarAgendamentosComoCards([], 'Buscando agendamentos...');
    const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
    UI.renderizarAgendamentosComoCards(agendamentos, modo);
}

async function handleCancelarClick(e) {
    if (e.target.matches('.btn-cancelar')) {
        const agendamentoId = e.target.dataset.id;
        const confirmou = confirm("Tem certeza que deseja cancelar este agendamento?");
        if (confirmou) {
            await cancelarAgendamento(state.empresaId, agendamentoId, () => {
                handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
            });
        }
    }
}
