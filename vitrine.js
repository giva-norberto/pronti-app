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
    encontrarPrimeiraDataComSlots
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
        initializeAuth((user) => {
            updateUIOnAuthChange(user, profissionalUid);
        });

        const slug = getSlugFromURL();
        if (!slug) throw new Error("URL inválida: slug do profissional não encontrado.");

        profissionalUid = await getProfissionalUidBySlug(slug);
        if (!profissionalUid) throw new Error("Profissional não encontrado.");

        professionalData = await getDadosProfissional(profissionalUid);
        if (!professionalData) throw new Error("Falha ao carregar dados do profissional.");

        renderizarDadosProfissional(professionalData.perfil);
        renderizarServicos(professionalData.servicos, selecionarServico);
        renderizarInfoServicos(professionalData.servicos);

        configurarEventos();

        const primeiraData = await encontrarPrimeiraDataComSlots(profissionalUid, professionalData);
        const dataInput = document.getElementById('data-agendamento');
        if (dataInput) {
            dataInput.value = primeiraData;
            dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        }

        document.getElementById("vitrine-loader").style.display = 'none';
        document.getElementById("vitrine-content").style.display = 'flex';

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

function renderizarInfoServicos(servicos) {
    const container = document.getElementById('info-servicos');
    if (!container || !servicos) return;
    container.innerHTML = servicos.length > 0 ? servicos.map(s => `
        <div class="servico-info-card">
            <h4>${s.nome}</h4>
            <p>${s.duracao || 'N/A'} min</p>
            <p>R$ ${s.preco || 'N/A'}</p>
        </div>
    `).join('') : '<p>Nenhum serviço oferecido no momento.</p>';
}

function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null; // Limpa o horário ao trocar de serviço
    showNotification(`Serviço selecionado: ${servico.nome}`);
    document.getElementById('data-agendamento').dispatchEvent(new Event('change'));
    updateConfirmButtonState(); // Verifica o estado do botão
}

/**
 * Função central para controlar o estado do botão de confirmação.
 * O botão só é ativado se todas as 3 condições forem verdadeiras.
 */
function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;

    const servicoOk = !!agendamentoState.servico;
    const dataOk = !!agendamentoState.data;
    const horarioOk = !!agendamentoState.horario;

    // Linhas de Debug para vermos o estado no console
    console.log(`Verificando botão: Serviço? ${servicoOk}, Data? ${dataOk}, Horário? ${horarioOk}`);

    if (servicoOk && dataOk && horarioOk) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

function configurarEventos() {
    document.querySelectorAll('.sidebar-menu .menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-menu .menu-btn.ativo, .main-content-vitrine .menu-content.ativo').forEach(el => el.classList.remove('ativo'));
            button.classList.add('ativo');
            const menuContent = document.getElementById(`menu-${button.dataset.menu}`);
            if (menuContent) menuContent.classList.add('ativo');
            if (button.dataset.menu === 'visualizacao' && currentUser) {
                buscarEExibirAgendamentos(profissionalUid, currentUser, 'ativos');
            }
        });
    });

    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('login-link-agendamento')?.addEventListener('click', login);
    document.getElementById('login-link-visualizacao')?.addEventListener('click', login);
    document.getElementById('btn-logout')?.addEventListener('click', logout);

    document.getElementById('btn-confirmar-agendamento')?.addEventListener('click', async () => {
        // Dupla verificação antes de salvar
        if (!agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
            showNotification("Por favor, selecione serviço, data e horário.", true);
            return;
        }
        document.getElementById('btn-confirmar-agendamento').disabled = true;
        await salvarAgendamento(profissionalUid, currentUser, agendamentoState);
        // Não reativamos o botão aqui, pois o utilizador será redirecionado
    });

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

    document.getElementById('data-agendamento')?.addEventListener('change', async (e) => {
        const dataSelecionada = e.target.value;
        agendamentoState.data = dataSelecionada; // Guarda a data
        agendamentoState.horario = null; // Limpa o horário ao mudar a data

        if (!agendamentoState.servico) {
            if (dataSelecionada) showNotification("Primeiro, selecione um serviço.", true);
            return;
        }
        if (!dataSelecionada) return;

        const horariosContainer = document.getElementById('grade-horarios');
        horariosContainer.innerHTML = '<p>Verificando horários...</p>';

        const agendamentosDoDia = await buscarAgendamentosDoDia(profissionalUid, dataSelecionada);
        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataSelecionada,
            agendamentosDoDia,
            professionalData.horarios,
            agendamentoState.servico.duracao
        );

        horariosContainer.innerHTML = slotsDisponiveis.length > 0 ? slotsDisponiveis.map(horario =>
            `<button class="btn-horario">${horario}</button>`
        ).join('') : '<p>Nenhum horário disponível para esta data.</p>';
        
        updateConfirmButtonState(); // Verifica o estado do botão
    });

    document.getElementById('grade-horarios')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            agendamentoState.horario = e.target.textContent; // Guarda o horário
            updateConfirmButtonState(); // Verifica o estado do botão
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
