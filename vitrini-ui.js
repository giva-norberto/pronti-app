/**
 * Mostra ou esconde o loader inicial da página.
 */
export function toggleLoader(mostrar) {
    document.getElementById('vitrine-loader').style.display = mostrar ? 'block' : 'none';
    document.getElementById('vitrine-content').style.display = mostrar ? 'none' : 'grid';
}

/**
 * Preenche os dados iniciais da empresa.
 */
export function renderizarDadosIniciaisEmpresa(dadosEmpresa, todosOsServicos) {
    document.getElementById('logo-publico').src = dadosEmpresa.logoUrl || "https://placehold.co/100x100/e0e7ff/6366f1?text=Logo";
    document.getElementById('nome-negocio-publico').textContent = dadosEmpresa.nomeFantasia || "Nome do Negócio";
    document.getElementById('info-negocio').innerHTML = `<p>${dadosEmpresa.descricao || "Descrição não informada."}</p>`;
    
    const servicosContainer = document.getElementById('info-servicos');
    if (todosOsServicos && todosOsServicos.length > 0) {
        servicosContainer.innerHTML = todosOsServicos.map(s => `
            <div class="servico-info-item">
                <strong>${s.nome}</strong>
                <span>R$ ${s.preco.toFixed(2)} (${s.duracao} min)</span>
            </div>
        `).join('');
    } else {
        servicosContainer.innerHTML = '<p>Nenhum serviço cadastrado.</p>';
    }
}

/**
 * Renderiza os cards dos profissionais.
 */
export function renderizarProfissionais(profissionais) {
    const container = document.getElementById('lista-profissionais');
    container.innerHTML = '';
    if (!profissionais || profissionais.length === 0) {
        container.innerHTML = '<p>Nenhum profissional encontrado.</p>';
        return;
    }
    profissionais.forEach(p => {
        container.innerHTML += `
            <div class="card-profissional" data-id="${p.id}">
                <img src="${p.fotoUrl || 'https://placehold.co/80x80/eef2ff/4f46e5?text=P'}" alt="${p.nome}">
                <span>${p.nome}</span>
            </div>
        `;
    });
}

/**
 * Renderiza os cards de serviços.
 */
export function renderizarServicos(servicos) {
    const container = document.getElementById('lista-servicos');
    container.innerHTML = '';
    if (!servicos || servicos.length === 0) {
        container.innerHTML = '<p>Este profissional não oferece serviços.</p>';
        return;
    }
    servicos.forEach(s => {
        container.innerHTML += `
            <div class="card-servico" data-id="${s.id}">
                <span class="servico-nome">${s.nome}</span>
                <span class="servico-detalhes">R$ ${s.preco.toFixed(2)} - ${s.duracao} min</span>
            </div>
        `;
    });
}

/**
 * Renderiza os horários disponíveis.
 */
export function renderizarHorarios(slots, mensagem = '') {
    const container = document.getElementById('grade-horarios');
    container.innerHTML = '';
    if (mensagem) {
        container.innerHTML = `<p class="aviso-horarios">${mensagem}</p>`;
        return;
    }
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p class="aviso-horarios">Nenhum horário disponível para esta data.</p>';
        return;
    }
    slots.forEach(horario => {
        container.innerHTML += `<button class="btn-horario" data-horario="${horario}">${horario}</button>`;
    });
}

/**
 * Atualiza a UI de autenticação (a função mais importante para o login).
 */
export function atualizarUIdeAuth(user) {
    const loginPromptAgendamento = document.getElementById('agendamento-login-prompt');
    const loginPromptVisualizacao = document.getElementById('agendamentos-login-prompt');
    const userInfo = document.getElementById('user-info');
    const loginContainer = document.getElementById('btn-login-container');
    const agendamentosContainer = document.getElementById('botoes-agendamento');

    if (user) {
        if(loginPromptAgendamento) loginPromptAgendamento.style.display = 'none';
        if(loginPromptVisualizacao) loginPromptVisualizacao.style.display = 'none';
        if(agendamentosContainer) agendamentosContainer.style.display = 'flex';
        if(userInfo) userInfo.style.display = 'block';
        if(loginContainer) loginContainer.style.display = 'none';
        document.getElementById('user-photo').src = user.photoURL || 'https://placehold.co/80x80/eef2ff/4f46e5?text=User';
        document.getElementById('user-name').textContent = user.displayName || 'Usuário';
    } else {
        if(loginPromptAgendamento) loginPromptAgendamento.style.display = 'block';
        if(loginPromptVisualizacao) loginPromptVisualizacao.style.display = 'block';
        if(agendamentosContainer) agendamentosContainer.style.display = 'none';
        if(userInfo) userInfo.style.display = 'none';
        if(loginContainer) loginContainer.style.display = 'block';
        const listaAgendamentos = document.getElementById('lista-agendamentos-visualizacao');
        if(listaAgendamentos) listaAgendamentos.innerHTML = '';
    }
}

/**
 * Troca a aba visível.
 */
export function trocarAba(idDaAba) {
    const menuKey = idDaAba.replace('menu-', '');
    document.querySelectorAll('.menu-content').forEach(el => el.classList.remove('ativo'));
    document.querySelectorAll('[data-menu]').forEach(el => el.classList.remove('ativo'));
    
    const tela = document.getElementById(idDaAba);
    if(tela) tela.classList.add('ativo');

    const botoes = document.querySelectorAll(`.menu-btn[data-menu="${menuKey}"], .bottom-nav-vitrine button[data-menu="${menuKey}"]`);
    botoes.forEach(btn => btn.classList.add('ativo'));
}

/**
 * Seleciona um card (profissional, serviço, horário).
 */
export function selecionarCard(tipo, id) {
    const seletorMap = { profissional: '.card-profissional', servico: '.card-servico', horario: '.btn-horario' };
    const seletor = seletorMap[tipo];
    if (!seletor) return;

    document.querySelectorAll(seletor).forEach(c => c.classList.remove('selecionado'));

    if (id) {
        const attribute = (tipo === 'horario') ? 'data-horario' : 'data-id';
        const element = document.querySelector(`${seletor}[${attribute}="${id}"]`);
        if (element) element.classList.add('selecionado');
    }
}

/**
 * Mostra o container do formulário de agendamento.
 */
export function mostrarContainerForm(mostrar) {
    const container = document.getElementById('agendamento-form-container');
    if(container) container.style.display = mostrar ? 'block' : 'none';
}

/**
 * Renderiza os agendamentos do cliente.
 */
export function renderizarAgendamentosComoCards(agendamentos, modo) {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    container.innerHTML = '';
    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `<p>Você não tem agendamentos ${modo === 'ativos' ? 'futuros' : 'passados'}.</p>`;
        return;
    }
    agendamentos.sort((a, b) => new Date(a.data) - new Date(b.data));
    agendamentos.forEach(ag => {
        const dataFormatada = new Date(`${ag.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        container.innerHTML += `
            <div class="card-agendamento status-${ag.status || 'ativo'}">
                <div class="agendamento-info">
                    <strong>${ag.servicoNome}</strong>
                    <span>com ${ag.profissionalNome}</span>
                    <small>${dataFormatada} às ${ag.horario}</small>
                </div>
                ${(modo === 'ativos' && ag.status !== 'cancelado_pelo_cliente') ? `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>` : ''}
            </div>
        `;
    });
}
