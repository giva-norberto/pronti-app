// vitrini-ui.js

// Importações de outros módulos
import { cancelarAgendamento } from './vitrini-agendamento.js';
import { buscarEExibirAgendamentos } from './vitrini-agendamento.js';
import { currentUser } from './vitrini-auth.js';

/**
 * Renderiza os cards de agendamentos de um cliente.
 * @param {string} profissionalUid - O UID do profissional.
 * @param {Array} agendamentos - A lista de agendamentos para exibir.
 * @param {string} modo - 'ativos' ou 'historico'.
 */
export function renderizarAgendamentosComoCards(profissionalUid, agendamentos, modo = 'ativos') {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    if (!container) return;

    if (agendamentos.length === 0) {
        container.innerHTML = `<p>Não há agendamentos para exibir.</p>`;
        return;
    }

    // Este bloco de código foi movido para dentro da função
    container.innerHTML = agendamentos.map(ag => {
        const horarioDate = ag.horario.toDate();
        const horarioStr = horarioDate.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        });

        let btnCancelar = '';
        // Só mostra o botão de cancelar se o agendamento for futuro e pertencer ao usuário logado
        if (modo === 'ativos' && ag.status === 'agendado' && horarioDate > new Date()) {
            btnCancelar = `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>`;
        }

        return `
        <div class="agendamento-card status-${ag.status}">
            <h4>${ag.servicoNome}</h4>
            <p><strong>Data:</strong> ${horarioStr}</p>
            <p><strong>Status:</strong> ${ag.status}</p>
            ${btnCancelar}
        </div>`;
    }).join('');

    // Adiciona os event listeners aos novos botões de cancelar
    container.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', () => {
            const agendamentoId = btn.dataset.id;
            // A função de callback vai recarregar a lista de agendamentos após o cancelamento
            cancelarAgendamento(profissionalUid, agendamentoId, () => {
                buscarEExibirAgendamentos(profissionalUid, currentUser, 'ativos');
            });
        });
    });
}

/**
 * Renderiza as informações do perfil do profissional na tela.
 * @param {object} perfil - O objeto com os dados do perfil.
 */
export function renderizarDadosProfissional(perfil) {
    if (!perfil) return;
    document.getElementById('nome-negocio-publico').textContent = perfil.nomeNegocio || "Nome do Negócio";
    if (perfil.logoUrl) document.getElementById('logo-publico').src = perfil.logoUrl;
    document.getElementById('info-negocio').innerHTML = `<p>${perfil.descricao || 'Nenhuma descrição fornecida.'}</p>`;
    document.getElementById('info-contato').innerHTML = `
        ${perfil.telefone ? `<p><strong>Telefone:</strong> ${perfil.telefone}</p>` : ''}
        ${perfil.endereco ? `<p><strong>Endereço:</strong> ${perfil.endereco}</p>` : ''}
    `;
}

/**
 * Renderiza a lista de serviços oferecidos pelo profissional.
 * @param {Array} servicos - A lista de serviços.
 * @param {Function} onServiceSelect - A função a ser chamada quando um serviço é selecionado.
 */
export function renderizarServicos(servicos, onServiceSelect) {
    const container = document.getElementById('lista-servicos');
    if (!container) return;

    if (!servicos || servicos.length === 0) {
        container.innerHTML = '<p>Nenhum serviço disponível para agendamento.</p>';
        return;
    }

    container.innerHTML = servicos.map(s =>
        `<button class="service-item" data-id="${s.id}">
            ${s.nome} - R$ ${s.preco}
        </button>`
    ).join('');

    // Adiciona o evento de clique para cada serviço
    container.querySelectorAll('.service-item').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove a seleção de outros botões
            container.querySelectorAll('.service-item.selecionado').forEach(b => b.classList.remove('selecionado'));
            // Adiciona a classe ao botão clicado
            btn.classList.add('selecionado');
            // Encontra o objeto do serviço completo e chama a função de callback
            const servicoSelecionado = servicos.find(s => s.id === btn.dataset.id);
            onServiceSelect(servicoSelecionado);
        });
    });
}

/**
 * Atualiza a interface do usuário com base no status de autenticação.
 * @param {object|null} user - O objeto do usuário do Firebase ou null.
 * @param {string} profissionalUid - O UID do profissional para buscar agendamentos.
 */
export function updateUIOnAuthChange(user, profissionalUid) {
    const userInfo = document.getElementById('user-info');
    const btnLogin = document.getElementById('btn-login');
    const agendamentoForm = document.getElementById('agendamento-form-container');
    const agendamentoPrompt = document.getElementById('agendamento-login-prompt');
    const agendamentosPrompt = document.getElementById('agendamentos-login-prompt');
    const agendamentosBotoes = document.getElementById('botoes-agendamento');
    const agendamentosLista = document.getElementById('lista-agendamentos-visualizacao');

    if (user) { // Usuário LOGADO
        if (userInfo) {
            userInfo.style.display = 'flex';
            document.getElementById('user-name').textContent = user.displayName;
            document.getElementById('user-photo').src = user.photoURL;
        }
        if (btnLogin) btnLogin.style.display = 'none';
        if (agendamentoForm) agendamentoForm.style.display = 'block';
        if (agendamentoPrompt) agendamentoPrompt.style.display = 'none';
        if (agendamentosPrompt) agendamentosPrompt.style.display = 'none';
        if (agendamentosBotoes) agendamentosBotoes.style.display = 'flex';

        // Busca os agendamentos do usuário ao fazer login
        if (profissionalUid) {
            buscarEExibirAgendamentos(profissionalUid, user, 'ativos');
        }

    } else { // Usuário DESLOGADO
        if (userInfo) userInfo.style.display = 'none';
        if (btnLogin) btnLogin.style.display = 'block';
        if (agendamentoForm) agendamentoForm.style.display = 'none';
        if (agendamentoPrompt) agendamentoPrompt.style.display = 'block';
        if (agendamentosPrompt) agendamentosPrompt.style.display = 'block';
        if (agendamentosBotoes) agendamentosBotoes.style.display = 'none';
        if (agendamentosLista) agendamentosLista.innerHTML = '<p>Faça login para ver seus agendamentos.</p>';
    }
}
