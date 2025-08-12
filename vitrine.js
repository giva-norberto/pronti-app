// vitrine.js - O Maestro da Aplicação
// VERSÃO FINAL, COMPLETA E CORRIGIDA - Firebase v10.12.2

// 1. Importa o gerenciador de estado
import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';

// 2. Importa as funções de busca de dados
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, salvarAgendamento, buscarAgendamentosDoCliente, cancelarAgendamento, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';

// 3. Importa as funções de autenticação
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';

// 4. Importa TODAS as funções de UI como um único objeto "UI"
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
    if(user && document.getElementById('menu-visualizacao').classList.contains('ativo')) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

function handleMenuClick(e) {
    if (e.target.matches('.menu-btn')) { // CORREÇÃO: A classe correta é 'menu-btn'
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
    document.getElementById('agendamento-form-container').style.display = 'none';
    document.getElementById('lista-servicos').innerHTML = '';
    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione um profissional, serviço e data.</p>';

    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    
    // Busca os horários sob demanda para melhorar a performance inicial
    profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
    setAgendamento('profissional', profissional);

    // "Hidrata" os IDs de serviço do profissional para objetos de serviço completos
    const servicosDoProfissional = (profissional.servicos || []).map(servicoId => {
        return state.todosOsServicos.find(servico => servico.id === servicoId);
    }).filter(Boolean); // .filter(Boolean) remove 'undefined'

    // Atualiza a UI
    document.querySelectorAll('.card-profissional.selecionado').forEach(c => c.classList.remove('selecionado'));
    card.classList.add('selecionado');
    document.getElementById('agendamento-form-container').style.display = 'block';
    
    UI.renderizarServicos(servicosDoProfissional);
}

async function handleServicoClick(e) {
    const card = e.target.closest('.card-servico');
    if (!card) return;

    setAgendamento('data', null);
    setAgendamento('horario', null);

    const servicoId = card.dataset.id;
    const servico = state.todosOsServicos.find(s => s.id === servicoId);
    setAgendamento('servico', servico);
    
    document.querySelectorAll('.card-servico.selecionado').forEach(c => c.classList.remove('selecionado'));
    card.classList.add('selecionado');
    
    const dataInput = document.getElementById('data-agendamento');
    const horariosContainer = document.getElementById('grade-horarios');
    
    dataInput.disabled = true;
    horariosContainer.innerHTML = '<p class="aviso-horarios">A procurar a data mais próxima com vagas...</p>';

    const primeiraDataDisponivel = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional);

    if (primeiraDataDisponivel) {
        dataInput.value = primeiraDataDisponivel;
        dataInput.disabled = false;
        dataInput.dispatchEvent(new Event('change')); 
    } else {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Nenhuma data disponível para este profissional nos próximos 3 meses.</p>';
    }
}

async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);

    const { profissional, servico, data } = state.agendamento;
    if (!profissional || !servico || !data) return;

    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">A calcular horários...</p>';
    const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
    const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);

    const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, servico.duracao);
    UI.renderizarHorarios(slots);
}

function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn) return;
    
    setAgendamento('horario', btn.dataset.horario);
    document.querySelectorAll('.btn-horario.selecionado').forEach(b => b.classList.remove('selecionado'));
    btn.classList.add('selecionado');
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
    btn.textContent = 'Confirmar Agendamento';
}

async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle')) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
    
    document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('ativo'));
    e.target.classList.add('ativo');

    const container = document.getElementById('lista-agendamentos-visualizacao');
    container.innerHTML = '<p>Buscando agendamentos...</p>';
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
