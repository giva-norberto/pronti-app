// vitrini-ui.js (VERSÃO FINAL E COMPLETA - MÚLTIPLOS PROFISSIONAIS)

import { cancelarAgendamento, buscarEExibirAgendamentos } from './vitrini-agendamento.js';
import { currentUser } from './vitrini-auth.js';

/**
 * Renderiza os dados gerais da empresa na tela (nome, logo, descrição).
 * @param {object} empresa - Dados do documento da empresa.
 */
export function renderizarDadosEmpresa(empresa) {
    if (!empresa) return;
    document.getElementById('nome-negocio-publico').textContent = empresa.nomeFantasia || "Nome do Negócio";
    if (empresa.logoUrl) {
        document.getElementById('logo-publico').src = empresa.logoUrl;
    }
    document.getElementById('info-negocio').innerHTML = `<p>${empresa.descricao || 'Nenhuma descrição fornecida.'}</p>`;
    // Você pode adicionar o preenchimento do card de contato aqui se os dados estiverem na empresa
}

/**
 * Renderiza os cards de todos os profissionais disponíveis para seleção.
 * @param {Array} profissionais - Lista de profissionais da empresa.
 * @param {Function} onSelectProfissional - Callback a ser chamado quando um profissional é selecionado.
 */
export function renderizarProfissionais(profissionais, onSelectProfissional) {
    const container = document.getElementById('lista-profissionais');
    if (!container) return;

    container.innerHTML = profissionais.map(prof => `
        <div class="card-profissional" data-id="${prof.id}">
            <img src="${prof.fotoUrl || 'https://placehold.co/100x100/e0e7ff/6366f1?text=Foto'}" alt="Foto de ${prof.nome}">
            <h3>${prof.nome}</h3>
        </div>
    `).join('');

    document.querySelectorAll('.card-profissional').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const profissional = profissionais.find(p => p.id === id);
            if (profissional) {
                onSelectProfissional(profissional); // Chama a função principal para lidar com a seleção
            }
        });
    });
}

/**
 * Renderiza os cards de agendamentos de um cliente.
 * @param {string} empresaId - O ID da empresa.
 * @param {Array} agendamentos - A lista de agendamentos para exibir.
 * @param {string} modo - 'ativos' ou 'historico'.
 */
export function renderizarAgendamentosComoCards(empresaId, agendamentos, modo = 'ativos') {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    if (!container) return;

    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `<p>Não há agendamentos para exibir.</p>`;
        return;
    }

    container.innerHTML = agendamentos.map(ag => {
        const horarioDate = ag.horario.toDate();
        const horarioStr = horarioDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const btnCancelar = (modo === 'ativos' && ag.status === 'agendado' && horarioDate > new Date())
            ? `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>` : '';
        const statusExibido = (modo !== 'ativos' && ag.status === 'agendado') ? 'Concluído' : ag.status.replace(/_/g, ' ');

        return `
        <div class="agendamento-card status-${ag.status}">
            <h4>${ag.servicoNome}</h4>
            <p><strong>Profissional:</strong> ${ag.profissionalNome || 'N/A'}</p>
            <p><strong>Data:</strong> ${horarioStr}</p>
            <p><strong>Status:</strong> <span class="status">${statusExibido}</span></p>
            <div class="agendamento-acao">${btnCancelar}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', () => {
            const agendamentoId = btn.dataset.id;
            cancelarAgendamento(empresaId, agendamentoId, () => {
                buscarEExibirAgendamentos(empresaId, currentUser, 'ativos');
            });
        });
    });
}

/**
 * Renderiza a lista de serviços de um profissional selecionado.
 * @param {Array} servicos - A lista de serviços.
 * @param {Function} onServiceSelect - A função a ser chamada quando um serviço é selecionado.
 */
export function renderizarServicos(servicos, onServiceSelect) {
    const container = document.getElementById('lista-servicos');
    if (!container) return;

    if (!servicos || servicos.length === 0) {
        container.innerHTML = '<p>Este profissional não oferece serviços no momento.</p>';
        return;
    }

    container.innerHTML = servicos
        .filter(s => s.visivelNaVitrine !== false)
        .map(s =>
            `<button class="service-item" data-id="${s.id}">
                ${s.nome} - R$ ${s.preco}
            </button>`
        ).join('');

    container.querySelectorAll('.service-item').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.service-item.selecionado').forEach(b => b.classList.remove('selecionado'));
            btn.classList.add('selecionado');
            const servicoSelecionado = servicos.find(s => String(s.id) === btn.dataset.id);
            if(servicoSelecionado) {
                onServiceSelect(servicoSelecionado);
            }
        });
    });
}

/**
 * Atualiza a interface do usuário com base no status de autenticação.
 * @param {object|null} user - O objeto do usuário do Firebase ou null.
 * @param {string} empresaId - O ID da empresa para buscar agendamentos.
 */
export function updateUIOnAuthChange(user, empresaId) {
    const userInfo = document.getElementById('user-info');
    const btnLogin = document.getElementById('btn-login');
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
        
        if (agendamentoPrompt) agendamentoPrompt.style.display = 'none';
        if (agendamentosPrompt) agendamentosPrompt.style.display = 'none';
        if (agendamentosBotoes) agendamentosBotoes.style.display = 'flex';

        if (empresaId) {
            buscarEExibirAgendamentos(empresaId, user, 'ativos');
        }

    } else { // Usuário DESLOGADO
        if (userInfo) userInfo.style.display = 'none';
        if (btnLogin) btnLogin.style.display = 'block';
        
        if (agendamentoPrompt) agendamentoPrompt.style.display = 'block';
        if (agendamentosPrompt) agendamentosPrompt.style.display = 'block';
        if (agendamentosBotoes) agendamentosBotoes.style.display = 'none';
        if (agendamentosLista) agendamentosLista.innerHTML = '';
    }
}
