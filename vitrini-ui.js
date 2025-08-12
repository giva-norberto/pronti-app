// vitrini-ui.js

/**
 * Mostra ou esconde o loader inicial da página.
 * @param {boolean} mostrar - True para mostrar o loader, false para mostrar o conteúdo.
 */
export function toggleLoader(mostrar) {
    document.getElementById('vitrine-loader').style.display = mostrar ? 'block' : 'none';
    document.getElementById('vitrine-content').style.display = mostrar ? 'none' : 'block';
}

/**
 * Preenche o cabeçalho e a aba de informações com os dados da empresa e serviços.
 * @param {object} dadosEmpresa - Objeto com os dados da empresa.
 * @param {Array} todosOsServicos - Array com todos os serviços da empresa.
 */
export function renderizarDadosIniciaisEmpresa(dadosEmpresa, todosOsServicos) {
    // Cabeçalho
    document.getElementById('logo-publico').src = dadosEmpresa.logoUrl || "https://placehold.co/100x100/e0e7ff/6366f1?text=Logo";
    document.getElementById('nome-negocio-publico').textContent = dadosEmpresa.nomeFantasia || "Nome do Negócio";

    // Aba "Informações"
    document.getElementById('info-negocio').innerHTML = `<p>${dadosEmpresa.descricao || "Descrição não informada."}</p>`;
    document.getElementById('info-servicos').innerHTML = todosOsServicos.map(s => `
        <div class="servico-info-item">
            <strong>${s.nome}</strong>
            <span>(Duração: ${s.duracao} min, Preço: R$ ${s.preco.toFixed(2)})</span>
        </div>
    `).join('');
}

/**
 * Renderiza os cards dos profissionais na tela.
 * @param {Array} profissionais - Lista de profissionais.
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
 * Renderiza os cards de serviços de um profissional.
 * @param {Array} servicos - Lista de serviços.
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
 * Renderiza os botões de horários disponíveis.
 * @param {Array} slots - Lista de horários (strings "HH:MM").
 * @param {string} [mensagem] - Uma mensagem opcional para exibir (ex: "Carregando...").
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
 * Atualiza a interface de autenticação (mostra/esconde botões de login/logout).
 * @param {object|null} user - O objeto do usuário do Firebase Auth.
 */
export function atualizarUIdeAuth(user) {
    const loginPromptAgendamento = document.getElementById('agendamento-login-prompt');
    const loginPromptVisualizacao = document.getElementById('agendamentos-login-prompt');
    const userInfo = document.getElementById('user-info');
    const loginContainer = document.getElementById('btn-login-container');
    const agendamentosContainer = document.getElementById('botoes-agendamento');

    if (user) {
        loginPromptAgendamento.style.display = 'none';
        loginPromptVisualizacao.style.display = 'none';
        agendamentosContainer.style.display = 'flex';
        userInfo.style.display = 'block';
        loginContainer.style.display = 'none';
        document.getElementById('user-photo').src = user.photoURL;
        document.getElementById('user-name').textContent = user.displayName;
    } else {
        loginPromptAgendamento.style.display = 'block';
        loginPromptVisualizacao.style.display = 'block';
        agendamentosContainer.style.display = 'none';
        userInfo.style.display = 'none';
        loginContainer.style.display = 'block';
        document.getElementById('lista-agendamentos-visualizacao').innerHTML = '';
    }
}

/**
 * Troca a aba de conteúdo principal visível.
 * @param {string} idDaAba - O ID do elemento de conteúdo a ser mostrado.
 */
export function trocarAba(idDaAba) {
    document.querySelectorAll('.menu-content').forEach(el => el.classList.remove('ativo'));
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('ativo'));
    
    document.getElementById(idDaAba).classList.add('ativo');
    document.querySelector(`.menu-btn[data-menu="${idDaAba.replace('menu-','')}"`).classList.add('ativo');
}

/**
 * Adiciona ou remove a classe 'selecionado' de um card.
 * @param {'profissional'|'servico'|'horario'} tipo - O tipo de card.
 * @param {string} id - O ID do item a ser selecionado.
 */
export function selecionarCard(tipo, id) {
    const seletor = `.card-${tipo}, .btn-${tipo}`;
    document.querySelectorAll(seletor).forEach(c => c.classList.remove('selecionado'));
    if (id) {
        document.querySelector(`${seletor}[data-id="${id}"], ${seletor}[data-horario="${id}"]`)?.classList.add('selecionado');
    }
}

/**
 * Limpa a seleção de um tipo de card.
 * @param {'profissional'|'servico'|'horario'} tipo
 */
export function limparSelecao(tipo) {
    selecionarCard(tipo, null);
}

/**
 * Mostra ou esconde a parte do formulário de agendamento.
 * @param {boolean} mostrar
 */
export function mostrarContainerForm(mostrar) {
    document.getElementById('agendamento-form-container').style.display = mostrar ? 'block' : 'none';
}

/**
 * Atualiza o campo de data e a mensagem de horários.
 * @param {boolean} desabilitarInput - Desabilita ou habilita o campo de data.
 * @param {string} mensagemHorarios - Mensagem para mostrar na grade de horários.
 */
export function atualizarStatusData(desabilitarInput, mensagemHorarios) {
    document.getElementById('data-agendamento').disabled = desabilitarInput;
    renderizarHorarios([], mensagemHorarios);
}

/**
 * Seleciona visualmente o filtro de agendamentos (Ativos vs. Histórico).
 * @param {'ativos'|'historico'} modo
 */
export function selecionarFiltro(modo) {
    document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('ativo'));
    const btnId = modo === 'ativos' ? 'btn-ver-ativos' : 'btn-ver-historico';
    document.getElementById(btnId).classList.add('ativo');
}

/**
 * Renderiza os agendamentos de um cliente como cards.
 * @param {Array} agendamentos - Lista de agendamentos.
 * @param {'ativos'|'historico'} modo - Para saber se mostra o botão de cancelar.
 */
export function renderizarAgendamentosComoCards(agendamentos, modo) {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    container.innerHTML = '';

    if (agendamentos.length === 0) {
        container.innerHTML = `<p>Você não tem agendamentos ${modo === 'ativos' ? 'futuros' : 'passados'}.</p>`;
        return;
    }

    agendamentos.sort((a, b) => new Date(a.data) - new Date(b.data));

    agendamentos.forEach(ag => {
        const dataFormatada = new Date(`${ag.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        container.innerHTML += `
            <div class="card-agendamento">
                <div class="agendamento-info">
                    <strong>${ag.servicoNome}</strong>
                    <span>com ${ag.profissionalNome}</span>
                    <small>${dataFormatada} às ${ag.horario}</small>
                </div>
                ${modo === 'ativos' ? `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>` : ''}
            </div>
        `;
    });
}
