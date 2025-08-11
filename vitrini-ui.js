import { cancelarAgendamento, buscarEExibirAgendamentos } from './vitrini-agendamento.js';
import { currentUser } from './vitrini-auth.js';

/**
 * Renderiza a barra de menu no topo.
 * @param {string} ativo - Nome do menu ativo.
 */
export function renderizarMenuTopo(ativo = 'informacoes') {
    const menus = [
        { id: 'informacoes', label: 'Informações' },
        { id: 'agendar', label: 'Agendar' },
        { id: 'meus-agendamentos', label: 'Meus Agendamentos' },
        { id: 'perfil', label: 'Perfil' }
    ];
    const nav = document.getElementById('menu-topo');
    if (!nav) return;
    nav.innerHTML = menus.map(m => `
        <button class="menu-topo-btn${ativo === m.id ? ' ativo' : ''}" data-menu="${m.id}">${m.label}</button>
    `).join('');
    nav.querySelectorAll('.menu-topo-btn').forEach(btn => {
        btn.onclick = () => {
            renderizarMenuTopo(btn.dataset.menu);
            // Aqui você pode disparar navegação/troca de tela
            document.querySelectorAll('.main-content').forEach(el => {
                el.style.display = el.id === `conteudo-${btn.dataset.menu}` ? 'block' : 'none';
            });
        };
    });
}

/**
 * Renderiza serviços da empresa/profissionais (dados do Firebase, tratamento total).
 * @param {Array} servicos - Array de serviços vindos do Firebase
 * @param {HTMLElement|string} container - Container onde serão exibidos os cards ou seu id
 * @param {Function} [onClick] - Função chamada ao clicar em um card (opcional)
 */
export function renderizarServicos(servicos, container, onClick) {
    // Suporta receber o id do container como string
    if (typeof container === "string") {
        container = document.getElementById(container);
    }
    if (!container || typeof container.querySelectorAll !== "function") return;
    if (!Array.isArray(servicos) || servicos.length === 0) {
        container.innerHTML = '<p style="color:#f87171;">Nenhum serviço cadastrado.</p>';
        return;
    }
    container.innerHTML = servicos
        .filter(s => s && s.visivelNaVitrine !== false)
        .map((s, idx) => `
            <div class="service-item-card" data-idx="${idx}">
                <div class="service-card-header">
                    ${s.icone ? `<span class="service-icon">${s.icone}</span>` : ""}
                    <h4>${s.nome ? s.nome : '<span style="color:#ef4444">Sem nome</span>'}</h4>
                </div>
                <p class="service-desc">${(typeof s.descricao === 'string' && s.descricao.trim()) ? s.descricao : "Sem descrição."}</p>
                <div class="service-card-footer">
                    <span class="service-duracao">${s.duracao ? s.duracao + ' min' : 'Duração não informada'}</span>
                    <span class="service-preco">
                        ${typeof s.preco === "number" ? 'R$ ' + parseFloat(s.preco).toFixed(2).replace('.', ',') : 'Preço não informado'}
                    </span>
                </div>
            </div>
        `).join('');
    // Corrige: só chama querySelectorAll se container for um HTMLElement válido
    Array.from(container.querySelectorAll('.service-item-card')).forEach(card => {
        card.onclick = () => {
            Array.from(container.querySelectorAll('.service-item-card.selecionado')).forEach(c => c.classList.remove('selecionado'));
            card.classList.add('selecionado');
            if (onClick) onClick(servicos[parseInt(card.dataset.idx)]);
        };
    });
}

/**
 * Renderiza profissionais (cards bonitos).
 * @param {Array} profissionais
 * @param {HTMLElement|string} container
 * @param {Function} [onClick]
 */
export function renderizarProfissionais(profissionais, container, onClick) {
    if (typeof container === "string") {
        container = document.getElementById(container);
    }
    if (!container || typeof container.querySelectorAll !== "function") return;
    if (!Array.isArray(profissionais) || profissionais.length === 0) {
        container.innerHTML = '<p style="color:#f87171;">Nenhum profissional cadastrado.</p>';
        return;
    }
    container.innerHTML = profissionais.map((prof, idx) => `
        <div class="card-profissional" data-idx="${idx}">
            <img src="${prof.fotoUrl || 'https://placehold.co/100x100/e0e7ff/6366f1?text=Foto'}" alt="Foto de ${prof.nome}">
            <h3>${prof.nome || '<span style="color:#ef4444">Sem nome</span>'}</h3>
        </div>
    `).join('');
    Array.from(container.querySelectorAll('.card-profissional')).forEach(card => {
        card.onclick = () => {
            Array.from(container.querySelectorAll('.card-profissional.selecionado')).forEach(c => c.classList.remove('selecionado'));
            card.classList.add('selecionado');
            if (onClick) onClick(profissionais[parseInt(card.dataset.idx)]);
        };
    });
}

/**
 * Atualiza interface conforme login/logout.
 */
export function updateUIOnAuthChange(user, empresaId) {
    const userInfo = document.getElementById('user-info');
    const btnLogin = document.getElementById('btn-login');
    const agendamentosPrompt = document.getElementById('agendamentos-login-prompt');
    const agendamentosBotoes = document.getElementById('botoes-agendamento');
    const agendamentosLista = document.getElementById('lista-agendamentos-visualizacao');
    if (user) {
        if (userInfo) {
            userInfo.style.display = 'flex';
            document.getElementById('user-name').textContent = user.displayName || user.email || 'Usuário';
            document.getElementById('user-photo').src = user.photoURL || 'https://placehold.co/80x80/e0e7ff/6366f1?text=Usuário';
        }
        if (btnLogin) btnLogin.style.display = 'none';
        if (agendamentosPrompt) agendamentosPrompt.style.display = 'none';
        if (agendamentosBotoes) agendamentosBotoes.style.display = 'flex';
        if (empresaId) {
            buscarEExibirAgendamentos(empresaId, user, 'ativos');
        }
    } else {
        if (userInfo) userInfo.style.display = 'none';
        if (btnLogin) btnLogin.style.display = 'block';
        if (agendamentosPrompt) agendamentosPrompt.style.display = 'block';
        if (agendamentosBotoes) agendamentosBotoes.style.display = 'none';
        if (agendamentosLista) agendamentosLista.innerHTML = '';
    }
}
