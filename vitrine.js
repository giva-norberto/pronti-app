// ======================================================================
//          VITRINE.JS - O Maestro da Aplicação
//      Responsabilidade: Orquestrar o estado, os dados, a UI
//      e as interações do usuário na página da vitrine.
// ======================================================================

// --- MÓDULOS IMPORTADOS ---
import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, salvarAgendamento, buscarAgendamentosDoCliente, cancelarAgendamento, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import * as UI from './vitrini-ui.js';

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true, "A carregar informações...");

        const empresaId = getEmpresaIdFromURL();
        console.log("ID da Empresa extraído da URL:", empresaId); // Log de depuração

        if (!empresaId) {
            throw new Error("ID da Empresa não encontrado na URL. Verifique o link.");
        }

        // Carrega dados essenciais em paralelo para mais performance
        const [dados, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId),
            getProfissionaisDaEmpresa(empresaId),
            getTodosServicosDaEmpresa(empresaId)
        ]);

        console.log("Dados da empresa recebidos:", dados); // Log de depuração

        if (!dados) {
            // Este erro é frequentemente causado por regras de segurança que bloqueiam a leitura.
            // Verifique as suas regras do Firestore para garantir que a coleção 'empresarios' pode ser lida publicamente.
            throw new Error("Empresa não encontrada ou indisponível. Verifique o link ou as permissões de acesso.");
        }
        
        // Armazena os dados no estado global da aplicação
        setEmpresa(empresaId, dados);
        setProfissionais(profissionais);
        setTodosOsServicos(todosServicos);
        
        // Renderiza os componentes iniciais da UI
        UI.renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos);
        UI.renderizarProfissionais(state.listaProfissionais);
        
        // Configura todos os listeners de eventos e o listener de autenticação
        configurarEventosGerais();
        setupAuthListener(handleUserAuthStateChange);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        
        let userMessage = error.message;
        // Verifica se o erro é especificamente de permissão do Firebase
        if (error.code === 'permission-denied' || (error.message && error.message.includes("permission"))) {
            userMessage = "Não foi possível carregar os dados da empresa por falta de permissão. Verifique as regras de segurança do Firestore para garantir que a leitura pública da coleção 'empresarios' está permitida.";
        }

        // Exibe uma mensagem de erro clara para o usuário final
        const loaderElement = document.getElementById("vitrine-loader");
        if (loaderElement) {
            loaderElement.innerHTML = `<p style="color:red; text-align:center; padding: 20px;"><b>Ocorreu um erro:</b><br>${userMessage}</p>`;
        }
    } finally {
        UI.toggleLoader(false);
    }
});

// --- CONFIGURAÇÃO DE EVENTOS (Delegação centralizada) ---
function configurarEventosGerais() {
    document.addEventListener('click', async (e) => {
        try {
            if (e.target.matches('.sidebar-menu .menu-btn')) handleMenuClick(e);
            else if (e.target.closest('#lista-profissionais .card-profissional')) await handleProfissionalClick(e);
            else if (e.target.closest('#lista-servicos .card-servico')) await handleServicoClick(e);
            else if (e.target.closest('#grade-horarios .btn-horario')) handleHorarioClick(e);
            else if (e.target.matches('#btn-login')) await fazerLogin();
            else if (e.target.matches('#btn-logout')) await fazerLogout();
            else if (e.target.matches('#btn-confirmar-agendamento')) await handleConfirmarAgendamento();
            else if (e.target.matches('#botoes-agendamento .btn-toggle')) await handleFiltroAgendamentos(e);
            else if (e.target.matches('#lista-agendamentos-visualizacao .btn-cancelar')) await handleCancelarClick(e);
        } catch (err) {
            console.error("Erro durante o processamento do clique:", err);
            // Opcional: Adicionar um feedback visual de erro para o usuário
        }
    });

    // Adiciona um debounce ao input de data para evitar múltiplas chamadas
    let dataTimeout;
    const dataInput = document.getElementById('data-agendamento');
    if (dataInput) {
        dataInput.addEventListener('change', (e) => {
            clearTimeout(dataTimeout);
            dataTimeout = setTimeout(() => handleDataChange(e), 200);
        });
    }
}

// --- HANDLERS (Funções que respondem a eventos) ---

/** Lida com a mudança de estado do usuário (login/logout). */
function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    // Se o usuário estiver logado e na aba de visualização, atualiza a lista de agendamentos
    if (user && document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

/** Lida com o clique nos botões do menu principal. */
function handleMenuClick(e) {
    const menuKey = e.target.getAttribute('data-menu');
    UI.trocarAba(`menu-${menuKey}`);
    if (menuKey === 'visualizacao' && state.currentUser) {
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
    }
}

/** Lida com o clique na seleção de um profissional. */
async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;

    resetarAgendamento();
    UI.resetFormSelecoes(); // Função unificada para limpar a UI

    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);

    try {
        UI.toggleLoader(true, "A carregar horários...");
        // Busca os horários do profissional apenas quando ele é selecionado
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional);

        // Filtra os serviços que este profissional específico oferece
        const servicosDoProfissional = (profissional.servicos || [])
            .map(id => state.todosOsServicos.find(s => s.id === id))
            .filter(Boolean); // Garante que não há serviços nulos

        UI.selecionarCard('profissional', profissionalId);
        UI.mostrarContainerForm(true);
        UI.renderizarServicos(servicosDoProfissional);
    } catch (err) {
        console.error("Erro ao carregar dados do profissional:", err);
    } finally {
        UI.toggleLoader(false);
    }
}

/** Lida com o clique na seleção de um serviço. */
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
    UI.atualizarStatusData(true, 'A procurar data disponível...');

    try {
        const primeiraDataDisponivel = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional);
        const dataInput = document.getElementById('data-agendamento');

        if (primeiraDataDisponivel) {
            dataInput.value = primeiraDataDisponivel;
            dataInput.disabled = false;
            // Dispara o evento 'change' para carregar os horários do dia encontrado
            dataInput.dispatchEvent(new Event('change'));
        } else {
            UI.renderizarHorarios([], 'Nenhuma data disponível nos próximos 3 meses.');
        }
    } catch (err) {
        console.error("Erro ao buscar primeira data disponível:", err);
        UI.renderizarHorarios([], 'Erro ao carregar datas.');
    }
}

/** Lida com a mudança de data no seletor. */
async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');

    const { profissional, servico, data } = state.agendamento;
    if (!profissional || !servico || !data) return;

    try {
        UI.renderizarHorarios([], 'A carregar horários...');
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);

        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, servico.duracao);
        UI.renderizarHorarios(slots);
    } catch (err) {
        console.error("Erro ao calcular slots de horários:", err);
        UI.renderizarHorarios([], 'Erro ao calcular horários.');
    }
}

/** Lida com o clique na seleção de um horário. */
function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn) return;
    
    setAgendamento('horario', btn.dataset.horario);
    UI.selecionarCard('horario', btn.dataset.horario);
    document.getElementById('btn-confirmar-agendamento').disabled = false;
}

/** Lida com o clique no botão de confirmar agendamento. */
async function handleConfirmarAgendamento() {
    if (!state.currentUser) {
        UI.trocarAba('menu-perfil');
        alert("Você precisa de fazer login para confirmar o agendamento.");
        return;
    }
    const { profissional, servico, data, horario } = state.agendamento;
    if (!profissional || !servico || !data || !horario) return;
    
    const btn = document.getElementById('btn-confirmar-agendamento');
    btn.disabled = true;
    btn.textContent = 'A agendar...';

    try {
        await salvarAgendamento(state.empresaId, state.currentUser, state.agendamento);
        // Após salvar, pode-se mostrar uma mensagem de sucesso e limpar o formulário
    } catch (err) {
        console.error("Erro ao salvar agendamento:", err);
        alert("Ocorreu um erro ao tentar salvar o seu agendamento. Por favor, tente novamente.");
    } finally {
        btn.textContent = 'Confirmar Agendamento';
        btn.disabled = false;
    }
}

/** Lida com a filtragem de agendamentos (ativos vs. histórico). */
async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle')) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';

    UI.selecionarFiltro(modo);
    UI.renderizarAgendamentosComoCards([], 'A buscar...');

    try {
        const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
        UI.renderizarAgendamentosComoCards(agendamentos, modo);
    } catch (err) {
        console.error("Erro ao buscar agendamentos do cliente:", err);
        UI.renderizarAgendamentosComoCards([], 'Erro ao carregar.');
    }
}

/** Lida com o clique no botão de cancelar um agendamento. */
async function handleCancelarClick(e) {
    const agendamentoId = e.target.dataset.id;
    if (!agendamentoId) return;

    const confirmou = confirm("Tem a certeza de que deseja cancelar este agendamento?");
    if (!confirmou) return;

    try {
        // Passa uma função de callback para ser executada após o cancelamento
        await cancelarAgendamento(state.empresaId, agendamentoId, () => {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        });
    } catch (err) {
        console.error("Erro ao cancelar agendamento:", err);
        alert("Ocorreu um erro ao cancelar o agendamento.");
    }
}
