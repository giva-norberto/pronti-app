// vitrine.js

// ==========================================================================
// IMPORTS DOS MÓDULOS
// ==========================================================================
import { currentUser, initializeAuth, fazerLogin as login, fazerLogout as logout } from './vitrini-auth.js';
import { getSlugFromURL, getProfissionalUidBySlug, getDadosProfissional } from './vitrini-profissionais.js';
import { buscarEExibirAgendamentos, salvarAgendamento, cancelarAgendamento, buscarAgendamentosDoDia, calcularSlotsDisponiveis, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { renderizarServicos, renderizarDadosProfissional, updateUIOnAuthChange } from './vitrini-ui.js';
// [MODIFICAÇÃO] Importamos a nova função de confirmação.
import { showNotification, showCustomConfirm } from './vitrini-utils.js';

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
    agendamentoState.horario = null;
    showNotification(`Serviço selecionado: ${servico.nome}`);
    document.getElementById('data-agendamento').dispatchEvent(new Event('change'));
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
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

    // [MODIFICAÇÃO] Adicionada a confirmação ao agendar.
    document.getElementById('btn-confirmar-agendamento')?.addEventListener('click', async () => {
        if (!currentUser) {
            showNotification("Você precisa fazer login para agendar.", true);
            return;
        }
        if (!agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
            showNotification("Por favor, selecione serviço, data e horário.", true);
            return;
        }

        const confirmado = await showCustomConfirm(
            "Confirmar Agendamento",
            `Deseja agendar "${agendamentoState.servico.nome}" para ${new Date(agendamentoState.data + 'T00:00:00').toLocaleDateString()} às ${agendamentoState.horario}?`
        );

        if (confirmado) {
            document.getElementById('btn-confirmar-agendamento').disabled = true;
            await salvarAgendamento(profissionalUid, currentUser, agendamentoState);
        }
    });

    // [MODIFICAÇÃO] Adicionada a confirmação ao cancelar e o 'async' no evento.
    document.getElementById('lista-agendamentos-visualizacao')?.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-cancelar')) {
            const agendamentoId = e.target.dataset.id;
            
            const confirmado = await showCustomConfirm(
                "Cancelar Agendamento",
                "Tem certeza que deseja cancelar este agendamento?"
            );

            if (confirmado && agendamentoId) {
                cancelarAgendamento(profissionalUid, agendamentoId, () => {
                    buscarEExibirAgendamentos(profissionalUid, currentUser, 'ativos');
                });
            }
        }
    });

    document.getElementById('data-agendamento')?.addEventListener('change', async (e) => {
        const dataSelecionada = e.target.value;
        agendamentoState.data = dataSelecionada;
        agendamentoState.horario = null;
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
        updateConfirmButtonState();
    });

    document.getElementById('grade-horarios')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            agendamentoState.horario = e.target.textContent;
            updateConfirmButtonState();
        }
    });
    
    document.getElementById('btn-ver-ativos')?.addEventListener('click', (e) => {
        if (!currentUser) return;
        document.querySelector('.botoes-agendamento .btn-toggle.ativo')?.classList.remove('ativo');
        e.target.classList.add('ativo');
        buscarEExibirAgendamentos(profissionalUid, currentUser, 'ativos');
    });

    document.getElementById('btn-ver-historico')?.addEventListener('click', (e) => {
        if (!currentUser) return;
        document.querySelector('.botoes-agendamento .btn-toggle.ativo')?.classList.remove('ativo');
        e.target.classList.add('ativo');
        buscarEExibirAgendamentos(profissionalUid, currentUser, 'historico');
    });
}

document.addEventListener('DOMContentLoaded', init);
