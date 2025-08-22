import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, salvarAgendamento, buscarAgendamentosDoCliente, cancelarAgendamento, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import * as UI from './vitrini-ui.js';

// --- INICIALIZAÇÃO (sem alterações) ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);
        const empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("ID da Empresa não encontrado na URL.");
        const [dados, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId), getProfissionaisDaEmpresa(empresaId), getTodosServicosDaEmpresa(empresaId)
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
    // NOVO: Listener para o botão de prosseguir
    document.getElementById('btn-prosseguir-data')?.addEventListener('click', handleProsseguirDataClick);
    document.getElementById('data-agendamento').addEventListener('change', handleDataChange);
    document.getElementById('grade-horarios').addEventListener('click', handleHorarioClick);
    document.getElementById('btn-login')?.addEventListener('click', fazerLogin);
    document.getElementById('modal-auth-btn-google')?.addEventListener('click', fazerLogin);
    document.getElementById('btn-logout').addEventListener('click', fazerLogout);
    document.getElementById('btn-confirmar-agendamento').addEventListener('click', handleConfirmarAgendamento);
    document.getElementById('botoes-agendamento').addEventListener('click', handleFiltroAgendamentos);
    document.getElementById('lista-agendamentos-visualizacao').addEventListener('click', handleCancelarClick);
}

// --- HANDLERS ---
function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    UI.toggleAgendamentoLoginPrompt(!user);
    if (user) {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        }
    } else {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
        }
    }
}

function handleMenuClick(e) {
    const menuButton = e.target.closest('[data-menu]');
    if (menuButton) {
        const menuKey = menuButton.getAttribute('data-menu');
        UI.trocarAba(`menu-${menuKey}`);
        if (menuKey === 'visualizacao') {
            if (state.currentUser) {
                handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
            } else {
                if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
            }
        }
    }
}

async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;
    resetarAgendamento();
    UI.limparSelecao('servico'); UI.limparSelecao('horario'); UI.desabilitarBotaoConfirmar();
    UI.mostrarContainerForm(false); UI.renderizarServicos([]); UI.renderizarHorarios([]);
    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    UI.selecionarCard('profissional', profissionalId, true);
    try {
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional);
        
        // NOVO: Verifica se o profissional permite múltiplos serviços
        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId => state.todosOsServicos.find(servico => servico.id === servicoId)).filter(Boolean);
        
        UI.mostrarContainerForm(true);
        // NOVO: Informa a UI qual modo de renderização usar
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos);
        UI.configurarModoAgendamento(permiteMultiplos);

    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        await UI.mostrarAlerta("Erro", "Não foi possível carregar os dados deste profissional.");
    } finally {
        UI.selecionarCard('profissional', profissionalId, false);
    }
}

async function handleServicoClick(e) {
    const card = e.target.closest('.card-servico');
    if (!card) return;

    if (!state.agendamento.profissional) {
        await UI.mostrarAlerta("Atenção", "Por favor, selecione um profissional antes de escolher um serviço.");
        return;
    }

    const permiteMultiplos = state.agendamento.profissional.horarios?.permitirAgendamentoMultiplo || false;
    const servicoId = card.dataset.id;

    if (permiteMultiplos) {
        // --- LÓGICA NOVA PARA MÚLTIPLOS SERVIÇOS ---
        card.classList.toggle('selecionado');
        const servicosSelecionadosIds = Array.from(document.querySelectorAll('.card-servico.selecionado')).map(el => el.dataset.id);
        const servicosSelecionados = servicosSelecionadosIds.map(id => state.todosOsServicos.find(s => s.id === id));
        setAgendamento('servicos', servicosSelecionados); // Guarda a lista de serviços
        UI.atualizarResumoAgendamento(servicosSelecionados);
    } else {
        // --- LÓGICA ANTIGA E INTACTA PARA SERVIÇO ÚNICO ---
        UI.selecionarCard('servico', servicoId);
        setAgendamento('data', null); setAgendamento('horario', null);
        UI.limparSelecao('horario'); UI.desabilitarBotaoConfirmar();
        const servico = state.todosOsServicos.find(s => s.id === servicoId);
        setAgendamento('servico', servico);
        document.getElementById('data-e-horario-container').style.display = 'block';
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
            await UI.mostrarAlerta("Erro", "Ocorreu um problema ao verificar a disponibilidade.");
            UI.atualizarStatusData(false);
        }
    }
}

// NOVO: Handler para o botão "Escolher Data e Horário"
async function handleProsseguirDataClick() {
    const servicos = state.agendamento.servicos;
    if (!servicos || servicos.length === 0) {
        await UI.mostrarAlerta("Atenção", "Selecione pelo menos um serviço para continuar.");
        return;
    }
    
    document.getElementById('data-e-horario-container').style.display = 'block';
    UI.atualizarStatusData(true, 'A procurar a data mais próxima com vagas...');

    const duracaoTotal = servicos.reduce((total, s) => total + s.duracao, 0);

    try {
        const primeiraDataDisponivel = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional, duracaoTotal);
        if (primeiraDataDisponivel) {
            const dataInput = document.getElementById('data-agendamento');
            dataInput.value = primeiraDataDisponivel;
            dataInput.disabled = false;
            dataInput.dispatchEvent(new Event('change'));
        } else {
            UI.renderizarHorarios([], 'Nenhuma data disponível para os serviços selecionados nos próximos 3 meses.');
            UI.atualizarStatusData(false);
        }
    } catch(error) {
        console.error("Erro ao encontrar data disponível:", error);
        await UI.mostrarAlerta("Erro", "Ocorreu um problema ao verificar a disponibilidade.");
        UI.atualizarStatusData(false);
    }
}


async function handleDataChange(e) {
    setAgendamento('data', e.target.value); setAgendamento('horario', null);
    UI.limparSelecao('horario'); UI.desabilitarBotaoConfirmar();
    
    const { profissional, servico, servicos, data } = state.agendamento;
    const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
    
    // Calcula a duração total, seja de um serviço ou de vários
    const duracaoTotal = permiteMultiplos 
        ? servicos.reduce((total, s) => total + s.duracao, 0)
        : servico.duracao;

    if (!profissional || duracaoTotal === 0 || !data) return;

    UI.renderizarHorarios([], 'A calcular horários...');
    try {
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);
        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, duracaoTotal);
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
        await UI.mostrarAlerta("Login Necessário", "Você precisa fazer login para confirmar o agendamento.");
        if (UI.abrirModalLogin) UI.abrirModalLogin(); 
        return;
    }

    const { profissional, servico, servicos, data, horario } = state.agendamento;
    const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
    
    // Validação para os dois modos
    const servicoValido = permiteMultiplos ? (servicos && servicos.length > 0) : servico;

    if (!profissional || !servicoValido || !data || !horario) {
        await UI.mostrarAlerta("Informação Incompleta", "Por favor, selecione profissional, serviço(s), data e horário.");
        return;
    }

    const btn = document.getElementById('btn-confirmar-agendamento');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'A agendar...';
    try {
        // NOVO: Cria um "serviço combinado" para salvar no Firebase
        let servicoParaSalvar;
        if (permiteMultiplos) {
            servicoParaSalvar = {
                id: servicos.map(s => s.id).join(','),
                nome: servicos.map(s => s.nome).join(' + '),
                duracao: servicos.reduce((total, s) => total + s.duracao, 0),
                preco: servicos.reduce((total, s) => total + s.preco, 0)
            };
        } else {
            servicoParaSalvar = servico;
        }

        const agendamentoParaSalvar = { ...state.agendamento, servico: servicoParaSalvar };

        await salvarAgendamento(state.empresaId, state.currentUser, agendamentoParaSalvar);
        
        const nomeEmpresa = state.dadosEmpresa.nomeFantasia || "A empresa";
        await UI.mostrarAlerta("Agendamento Confirmado!", `${nomeEmpresa} agradece pelo seu agendamento.`);
        resetarAgendamento();
        handleMenuClick({ target: document.querySelector('[data-menu="visualizacao"]') });
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        await UI.mostrarAlerta("Erro", `Não foi possível confirmar o agendamento. ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle') || !state.currentUser) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
    UI.selecionarFiltro(modo);
    UI.renderizarAgendamentosComoCards([], 'Buscando agendamentos...');
    try {
        const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
        UI.renderizarAgendamentosComoCards(agendamentos, modo);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        await UI.mostrarAlerta("Erro de Busca", "Ocorreu um erro ao buscar seus agendamentos.");
        UI.renderizarAgendamentosComoCards([], 'Não foi possível carregar seus agendamentos.');
    }
}

async function handleCancelarClick(e) {
    const btnCancelar = e.target.closest('.btn-cancelar');
    if (btnCancelar) {
        const agendamentoId = btnCancelar.dataset.id;
        const confirmou = await UI.mostrarConfirmacao("Cancelar Agendamento", "Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.");
        if (confirmou) {
            btnCancelar.disabled = true;
            btnCancelar.textContent = "A cancelar...";
            try {
                await cancelarAgendamento(state.empresaId, agendamentoId);
                await UI.mostrarAlerta("Sucesso", "Agendamento cancelado com sucesso!");
                handleFiltroAgendamentos({ target: document.querySelector('#botoes-agendamento .btn-toggle.ativo') });
            } catch (error) {
                console.error("Erro ao cancelar agendamento:", error);
                await UI.mostrarAlerta("Erro", `Não foi possível cancelar o agendamento. ${error.message}`);
                btnCancelar.disabled = false;
                btnCancelar.textContent = "Cancelar";
            }
        }
    }
}
