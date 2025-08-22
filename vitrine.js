// O Maestro da Aplicação (Revisado e Corrigido)

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
        setupAuthListener(handleUserAuthStateChange); // garante login persistente

        UI.toggleLoader(false);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error.stack);
        document.getElementById("vitrine-loader").innerHTML = `<p style="text-align: center; color:red; padding: 20px;">${error.message}</p>`;
    }
});

// --- CONFIGURAÇÃO DE EVENTOS ---

function configurarEventosGerais() {
    document.querySelector('.sidebar-menu')?.addEventListener('click', handleMenuClick);
    document.querySelector('.bottom-nav-vitrine')?.addEventListener('click', handleMenuClick);
    document.getElementById('lista-profissionais').addEventListener('click', handleProfissionalClick);
    document.getElementById('lista-servicos').addEventListener('click', handleServicoClick);
    document.getElementById('data-agendamento').addEventListener('change', handleDataChange);
    document.getElementById('grade-horarios').addEventListener('click', handleHorarioClick);
    document.getElementById('btn-login')?.addEventListener('click', fazerLogin);
    document.getElementById('modal-auth-btn-google')?.addEventListener('click', fazerLogin);
    document.getElementById('btn-logout')?.addEventListener('click', fazerLogout);
    document.getElementById('btn-confirmar-agendamento').addEventListener('click', handleConfirmarAgendamento);
    document.getElementById('botoes-agendamento').addEventListener('click', handleFiltroAgendamentos);
    document.getElementById('lista-agendamentos-visualizacao').addEventListener('click', handleCancelarClick);
}

// --- HANDLERS (As Funções que os Eventos Chamam) ---

function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);

    // Atualiza visualização de agendamentos apenas se estiver na aba correta
    if (user && document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

function handleMenuClick(e) {
    const menuButton = e.target.closest('[data-menu]');
    if (!menuButton) return;

    const menuKey = menuButton.getAttribute('data-menu');
    UI.trocarAba(`menu-${menuKey}`);

    if (menuKey === 'visualizacao') {
        if (state.currentUser) {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        } else {
            if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
        }
    }

    if (menuKey === 'agendar') {
        UI.toggleAgendamentoLoginPrompt(false);
    }
}

async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;

    resetarAgendamento();
    UI.limparSelecao('servico');
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();
    UI.mostrarContainerForm(false);
    UI.renderizarServicos([]);
    UI.renderizarHorarios([]);

    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    
    UI.selecionarCard('profissional', profissionalId, true);

    try {
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional);

        const servicosDoProfissional = (profissional.servicos || []).map(servicoId => 
            state.todosOsServicos.find(servico => servico.id === servicoId)
        ).filter(Boolean);

        UI.mostrarContainerForm(true);
        UI.renderizarServicos(servicosDoProfissional);
    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        UI.showAlert("Erro", "Não foi possível carregar os dados deste profissional.");
    } finally {
        UI.selecionarCard('profissional', profissionalId, false);
    }
}

async function handleServicoClick(e) {
    const card = e.target.closest('.card-servico');
    if (!card) return;

    setAgendamento('data', null);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();
    
    const servicoId = card.dataset.id;
    const servico = state.todosOsServicos.find(s => s.id === servicoId);
    setAgendamento('servico', servico);
    
    UI.selecionarCard('servico', servicoId);
    UI.atualizarStatusData(true, 'A procurar a data mais próxima com vagas...');

    try {
        const primeiraDataDisponivel = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional, servico.duracao);

        if (primeiraDataDisponivel) {
            const dataInput = document.getElementById('data-agendamento');
            dataInput.value = primeiraDataDisponivel;
            dataInput.disabled = false;
            dataInput.dispatchEvent(new Event('change'));
        } else {
            UI.renderizarHorarios([], 'Nenhuma data disponível para este profissional nos próximos 3 meses.');
            UI.atualizarStatusData(false);
        }
    } catch(error) {
        console.error("Erro ao encontrar data disponível:", error);
        UI.showAlert("Erro", "Ocorreu um problema ao verificar a disponibilidade.");
        UI.atualizarStatusData(false);
    }
}

async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();

    const { profissional, servico, data } = state.agendamento;
    if (!profissional || !servico || !data) return;

    UI.renderizarHorarios([], 'A calcular horários...');
    try {
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);

        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, servico.duracao);
        UI.renderizarHorarios(slots);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        UI.renderizarHorarios([], 'Erro ao carregar horários. Tente outra data.');
    }
}

function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn || btn.disabled) return;
    
    setAgendamento('horario', btn.dataset.horario);
    UI.selecionarCard('horario', btn.dataset.horario);
    UI.habilitarBotaoConfirmar();
}

async function handleConfirmarAgendamento() {
    if (!state.currentUser) {
        UI.showAlert("Login Necessário", "Você precisa fazer login para confirmar o agendamento.", "info");
        if (UI.abrirModalLogin) UI.abrirModalLogin(); 
        return;
    }

    const { profissional, servico, data, horario } = state.agendamento;
    if (!profissional || !servico || !data || !horario) {
        UI.showAlert("Informação Incompleta", "Por favor, selecione profissional, serviço, data e horário.", "warning");
        return;
    }
    
    const btn = document.getElementById('btn-confirmar-agendamento');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'A agendar...';
    
    try {
        await salvarAgendamento(state.empresaId, state.currentUser, state.agendamento);
        UI.showAlert("Sucesso", "Seu agendamento foi realizado com sucesso!");
        resetarAgendamento();
        UI.limparSelecao('profissional');
        UI.limparSelecao('servico');
        UI.limparSelecao('horario');
        UI.mostrarContainerForm(false);
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        UI.showAlert("Erro", `Não foi possível confirmar o agendamento. ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle')) return;
    if (!state.currentUser) {
        if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
        return;
    }

    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
    
    UI.selecionarFiltro(modo);
    UI.renderizarAgendamentosComoCards([], 'Buscando agendamentos...');
    try {
        const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
        UI.renderizarAgendamentosComoCards(agendamentos, modo);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        UI.renderizarAgendamentosComoCards([], 'Ocorreu um erro ao buscar seus agendamentos.');
    }
}

async function handleCancelarClick(e) {
    const btnCancelar = e.target.closest('.btn-cancelar');
    if (!btnCancelar) return;

    if (!state.currentUser) {
        UI.showAlert("Login Necessário", "Você precisa fazer login para cancelar um agendamento.", "info");
        if (UI.abrirModalLogin) UI.abrirModalLogin(); 
        return;
    }

    const agendamentoId = btnCancelar.dataset.id;
    const confirmou = await UI.mostrarConfirmacao("Cancelar Agendamento", "Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.");
    
    if (!confirmou) return;

    btnCancelar.disabled = true;
    btnCancelar.textContent = "A cancelar...";
    try {
        await cancelarAgendamento(state.empresaId, agendamentoId);
        UI.showAlert("Sucesso", "Agendamento cancelado com sucesso!");
        handleFiltroAgendamentos({ target: document.querySelector('#botoes-agendamento .btn-toggle.ativo') });
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        UI.showAlert("Erro", `Não foi possível cancelar o agendamento. ${error.message}`);
    } finally {
        btnCancelar.disabled = false;
        btnCancelar.textContent = "Cancelar";
    }
}
