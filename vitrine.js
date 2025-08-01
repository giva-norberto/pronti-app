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
    calcularSlotsDisponiveis,
    encontrarPrimeiraDataComSlots // Importa a nova função
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
    console.log("[Debug vitrine.js] Iniciando a aplicação...");
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
        console.log(`[Debug vitrine.js] Slug encontrado: ${slug}`);

        // Busca UID do profissional
        profissionalUid = await getProfissionalUidBySlug(slug);
        if (!profissionalUid) {
            throw new Error("Profissional não encontrado.");
        }
        console.log(`[Debug vitrine.js] UID do profissional encontrado: ${profissionalUid}`);

        // Busca dados e serviços do profissional
        professionalData = await getDadosProfissional(profissionalUid);
        if (!professionalData) {
            throw new Error("Falha ao carregar dados do profissional.");
        }
        console.log("[Debug vitrine.js] Dados do profissional carregados com sucesso.");

        // Renderiza informações na tela
        renderizarDadosProfissional(professionalData.perfil);
        renderizarServicos(professionalData.servicos, selecionarServico);
        renderizarInfoServicos(professionalData.servicos);
        console.log("[Debug vitrine.js] Informações iniciais renderizadas.");

        // Configura todos os botões e eventos da página
        configurarEventos();
        console.log("[Debug vitrine.js] Eventos configurados.");

        // CORREÇÃO: Encontra e preenche a primeira data com horários disponíveis
        console.log("[Debug] A procurar a primeira data com horários...");
        const primeiraData = await encontrarPrimeiraDataComSlots(profissionalUid, professionalData);
        const dataInput = document.getElementById('data-agendamento');
        if (dataInput) {
            dataInput.value = primeiraData;
            // Define a data mínima como hoje para não permitir agendamentos no passado
            dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            console.log(`[Debug] Data inicial definida para: ${primeiraData}`);
        }

        // Esconde o loader e mostra o conteúdo principal
        document.getElementById("vitrine-loader").style.display = 'none';
        document.getElementById("vitrine-content").style.display = 'flex';
        console.log("[Debug vitrine.js] Loader escondido, conteúdo principal visível. Inicialização completa!");

    } catch (error) {
        console.error("Erro na inicialização:", error);
        showNotification(error.message, true);
        const loader = document.getElementById("vitrine-loader");
        if(loader) loader.innerHTML = `<p style="color:red; text-align: center;">${error.message}</p>`;
    }
}


// ==========================================================================
// LÓGICA E MANIPULADORES DE EVENTOS
// ==========================================================================

/**
 * Renderiza os cards de informação dos serviços.
 * @param {Array} servicos - A lista de serviços do profissional.
 */
function renderizarInfoServicos(servicos) {
    const container = document.getElementById('info-servicos');
    if (!container) return;

    if (!servicos || servicos.length === 0) {
        container.innerHTML = '<p>Nenhum serviço oferecido no momento.</p>';
        return;
    }
    
    container.innerHTML = servicos.map(s => `
        <div class="servico-info-card">
            <h4>${s.nome}</h4>
            <p>${s.duracao || 'N/A'} min</p>
            <p>R$ ${s.preco || 'N/A'}</p>
        </div>
    `).join('');
}

/**
 * Guarda o serviço selecionado no estado da aplicação e atualiza os horários.
 * @param {object} servico - O objeto do serviço clicado.
 */
function selecionarServico(servico) {
    agendamentoState.servico = servico;
    showNotification(`Serviço selecionado: ${servico.nome}`);
    // Dispara o evento 'change' no input da data para recarregar os horários
    // com o novo serviço selecionado e a data já preenchida.
    document.getElementById('data-agendamento').dispatchEvent(new Event('change'));
}

/**
 * Configura todos os event listeners da aplicação.
 */
function configurarEventos() {
    // Navegação do menu principal
    document.querySelectorAll('.sidebar-menu .menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-menu .menu-btn.ativo').forEach(btn => btn.classList.remove('ativo'));
            document.querySelectorAll('.main-content-vitrine .menu-content.ativo').forEach(content => content.classList.remove('ativo'));

            button.classList.add('ativo');
            const menuTargetId = `menu-${button.dataset.menu}`;
            const menuContent = document.getElementById(menuTargetId);
            if (menuContent) {
                menuContent.classList.add('ativo');
            }

            if (button.dataset.menu === 'visualizacao' && currentUser) {
                buscarEExibirAgendamentos(profissionalUid, currentUser, 'ativos');
            }
        });
    });

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
            if (dataSelecionada) {
                 showNotification("Primeiro, selecione um serviço.", true);
            }
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
            document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            agendamentoState.horario = e.target.textContent;
        }
    });
}

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
