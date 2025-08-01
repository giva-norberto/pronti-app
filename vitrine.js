// vitrine.js

// ==========================================================================
// IMPORTS DOS MÓDULOS
// ==========================================================================
import { currentUser, initializeAuth, fazerLogin as login, fazerLogout as logout } from './vitrini-auth.js';
import {
    getSlugFromURL,
    getProfissionalUidBySlug,
    getDadosProfissional
} from './vitrini-profissionais.js';

import {
    buscarEExibirAgendamentos,
    salvarAgendamento,
    cancelarAgendamento,
    buscarAgendamentosDoDia,
    calcularSlotsDisponiveis
} from './vitrini-agendamento.js';

import { renderizarServicos, renderizarDadosProfissional, updateUIOnAuthChange } from './vitrini-ui.js';
import { showNotification } from './vitrini-utils.js';


// ==========================================================================
// ESTADO DA APLICAÇÃO
// ==========================================================================
let profissionalUid = null;
let professionalData = { perfil: {}, servicos: [], horarios: {} };
let agendamentoState = {
    data: null,
    horario: null,
    servico: null
};


// ==========================================================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
// ==========================================================================
async function init() {
    try {
        // Configura listener de autenticação que atualiza a UI
        initializeAuth((user) => {
            updateUIOnAuthChange(user, profissionalUid);
        });

        // Pega slug da URL
        const slug = getSlugFromURL();
        if (!slug) {
            throw new Error("URL inválida: slug do profissional não encontrado.");
        }

        // Busca UID do profissional
        profissionalUid = await getProfissionalUidBySlug(slug);
        if (!profissionalUid) {
            throw new Error("Profissional não encontrado.");
        }

        // Busca dados e serviços do profissional
        professionalData = await getDadosProfissional(profissionalUid);
        if (!professionalData) {
            throw new Error("Falha ao carregar dados do profissional.");
        }

        // Renderiza informações na tela
        renderizarDadosProfissional(professionalData.perfil);
        renderizarServicos(professionalData.servicos, selecionarServico);

        // Configura todos os botões e eventos da página
        configurarEventos();

    } catch (error) {
        console.error("Erro na inicialização:", error);
        showNotification(error.message, true);
    }
}


// ==========================================================================
// LÓGICA E MANIPULADORES DE EVENTOS
// ==========================================================================

/**
 * Guarda o serviço selecionado no estado da aplicação.
 * @param {object} servico - O objeto do serviço clicado.
 */
function selecionarServico(servico) {
    agendamentoState.servico = servico;
    showNotification(`Serviço selecionado: ${servico.nome}`);
    // Ao selecionar um novo serviço, limpa os horários e força o usuário a buscar novamente
    document.getElementById('data-agendamento').value = '';
    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione uma data para ver os horários.</p>';
}

/**
 * Configura todos os event listeners da aplicação.
 */
function configurarEventos() {
    // Botão de login
    document.getElementById('btn-login')?.addEventListener('click', login);

    // Botão de logout
    document.getElementById('btn-logout')?.addEventListener('click', logout);

    // Botão de confirmar agendamento
    document.getElementById('btn-confirmar-agendamento')?.addEventListener('click', async () => {
        if (!currentUser) {
            showNotification("Você precisa fazer login para agendar.", true);
            return;
        }
        if (!agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
            showNotification("Por favor, selecione serviço, data e horário.", true);
            return;
        }
        await salvarAgendamento(profissionalUid, currentUser, agendamentoState);
    });

    // Delegação de evento para os botões de cancelar
    document.getElementById('lista-agendamentos-visualizacao')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-cancelar')) {
            const agendamentoId = e.target.dataset.id;
            if (agendamentoId) {
                cancelarAgendamento(profissionalUid, agendamentoId, () => {
                    buscarEExibirAgendamentos(profissionalUid, currentUser, 'ativos');
                });
            }
        }
    });

    // Input de data
    document.getElementById('data-agendamento')?.addEventListener('change', async (e) => {
        const dataSelecionada = e.target.value;
        if (!agendamentoState.servico) {
            showNotification("Primeiro, selecione um serviço.", true);
            e.target.value = ''; // Limpa a data
            return;
        }
        if (!dataSelecionada) return;

        agendamentoState.data = dataSelecionada;
        const horariosContainer = document.getElementById('grade-horarios');
        horariosContainer.innerHTML = '<p>Verificando horários...</p>';

        const agendamentosDoDia = await buscarAgendamentosDoDia(profissionalUid, dataSelecionada);
        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataSelecionada,
            agendamentosDoDia,
            professionalData.horarios,
            agendamentoState.servico.duracao
        );

        if (slotsDisponiveis.length > 0) {
            horariosContainer.innerHTML = slotsDisponiveis.map(horario =>
                `<button class="btn-horario">${horario}</button>`
            ).join('');
        } else {
            horariosContainer.innerHTML = '<p>Nenhum horário disponível para esta data.</p>';
        }
    });

    // Delegação de evento para os botões de horário
    document.getElementById('grade-horarios')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            // Remove a seleção de outros botões
            document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            // Adiciona a classe ao botão clicado
            e.target.classList.add('selecionado');
            agendamentoState.horario = e.target.textContent;
        }
    });
}

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
