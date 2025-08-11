// vitrini-ui.js
// RESPONSABILIDADE ÚNICA: Manipular o DOM (desenhar na tela) e nada mais.
// Este arquivo não busca dados nem controla o fluxo da aplicação.

/**
 * Exibe as informações gerais da empresa no cabeçalho e na aba "Informações".
 * Combina os dados da empresa e a lista de todos os serviços únicos.
 * @param {object} dadosEmpresa - O objeto com os dados da empresa.
 * @param {Array} listaProfissionais - A lista completa de profissionais para extrair os serviços.
 */
export function renderizarDadosIniciaisEmpresa(dadosEmpresa, listaProfissionais) {
    // Cabeçalho da página
    document.title = dadosEmpresa.nomeFantasia || "Agendamento Online";
    document.getElementById('nome-negocio-publico').textContent = dadosEmpresa.nomeFantasia || "Nome do Negócio";
    if (dadosEmpresa.logoUrl) {
        document.getElementById('logo-publico').src = dadosEmpresa.logoUrl;
    }
    
    // Preenche a aba "Informações"
    const infoNegocioDiv = document.getElementById('info-negocio');
    infoNegocioDiv.innerHTML = dadosEmpresa.descricao ? `<p>${dadosEmpresa.descricao.replace(/\n/g, '<br>')}</p>` : `<p>Bem-vindo!</p>`;
    
    const infoContatoDiv = document.getElementById('info-contato');
    infoContatoDiv.innerHTML = `
        <p><strong>Endereço:</strong> ${dadosEmpresa.enderecoCompleto || 'Não informado'}</p>
        <p><strong>Telefone:</strong> ${dadosEmpresa.telefone || 'Não informado'}</p>
    `;

    // Extrai e renderiza a lista de todos os serviços únicos
    const todosOsServicos = new Map();
    listaProfissionais.forEach(prof => {
        (prof.servicos || []).forEach(servico => {
            if (servico && servico.visivelNaVitrine !== false && !todosOsServicos.has(servico.nome)) {
                todosOsServicos.set(servico.nome, servico);
            }
        });
    });
    
    const listaDeServicos = Array.from(todosOsServicos.values());
    const infoServicosDiv = document.getElementById('info-servicos');
    if (listaDeServicos.length > 0) {
        infoServicosDiv.innerHTML = listaDeServicos.map(s => `
            <div class="servico-info-card">
                ${s.icone ? `<span class="service-icon">${s.icone}</span>` : ""}
                <h4>${s.nome || '<span style="color:#ef4444">Sem nome</span>'}</h4>
                <div class="servico-card-footer">
                    <span class="service-duracao">${s.duracao ? s.duracao + ' min' : ''}</span>
                    <span class="service-preco">${typeof s.preco === "number" ? 'R$ ' + parseFloat(s.preco).toFixed(2).replace('.', ',') : ''}</span>
                </div>
            </div>
        `).join('');
    } else {
        infoServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado.</p>';
    }
}

/**
 * Renderiza os cards de profissionais para seleção na aba de agendamento.
 * @param {Array} profissionais - A lista de profissionais da empresa.
 */
export function renderizarProfissionais(profissionais) {
    const container = document.getElementById('lista-profissionais');
    if (!profissionais || profissionais.length === 0) {
        container.innerHTML = "<p>Nenhum profissional disponível no momento.</p>";
        return;
    }
    container.innerHTML = profissionais.map(prof => `
        <div class="card-profissional" data-id="${prof.id}">
            <img src="${prof.fotoURL || 'https://placehold.co/100x100/e0e7ff/6366f1?text=Foto'}" alt="Foto de ${prof.nome}">
            <h3>${prof.nome || '<span style="color:#ef4444">Sem nome</span>'}</h3>
        </div>
    `).join('');
}

/**
 * Renderiza os cards de serviços do profissional que foi selecionado.
 * @param {Array} servicos - A lista de serviços do profissional.
 */
export function renderizarServicos(servicos) {
    const container = document.getElementById('lista-servicos');
    if (!servicos || servicos.length === 0) {
        container.innerHTML = '<p class="aviso-horarios">Este profissional não possui serviços disponíveis.</p>';
        return;
    }
    container.innerHTML = servicos
        .filter(s => s && s.visivelNaVitrine !== false)
        .map(s => `
        <div class="card-servico" data-id="${s.id}">
            <div class="servico-nome">${s.nome}</div>
            <div class="servico-detalhes">${s.duracao || '?'} min - R$ ${parseFloat(s.preco || 0).toFixed(2)}</div>
        </div>
    `).join('');
}

/**
 * Renderiza os botões de horários disponíveis para agendamento.
 * @param {Array<string>} slots - Uma lista de strings de horários, ex: ['09:00', '09:30'].
 */
export function renderizarHorarios(slots) {
    const container = document.getElementById('grade-horarios');
    // Limpa o botão de confirmação sempre que novos horários são renderizados
    document.getElementById('btn-confirmar-agendamento').disabled = true;

    if (!slots || slots.length === 0) {
        container.innerHTML = '<p class="aviso-horarios">Nenhum horário disponível para esta data.</p>';
        return;
    }
    container.innerHTML = slots.map(horario => `<button class="btn-horario" data-horario="${horario}">${horario}</button>`).join('');
}

/**
 * Atualiza a interface (abas de perfil, agendamento) com base no estado de login do usuário.
 * @param {object|null} user - O objeto do usuário do Firebase, ou nulo se deslogado.
 */
export function atualizarUIdeAuth(user) {
    const userInfo = document.getElementById('user-info');
    const loginContainer = document.getElementById('btn-login-container');
    const loginPromptAgendamento = document.getElementById('agendamento-login-prompt');
    const loginPromptVisualizacao = document.getElementById('agendamentos-login-prompt');
    const botoesVisualizacao = document.getElementById('botoes-agendamento');
    const listaAgendamentos = document.getElementById('lista-agendamentos-visualizacao');

    if (user) {
        // --- USUÁRIO LOGADO ---
        userInfo.style.display = 'flex';
        document.getElementById('user-name').textContent = user.displayName || user.email;
        document.getElementById('user-photo').src = user.photoURL || 'https://placehold.co/80x80/e0e7ff/6366f1?text=👤';
        loginContainer.style.display = 'none';
        
        loginPromptAgendamento.style.display = 'none';
        loginPromptVisualizacao.style.display = 'none';
        botoesVisualizacao.style.display = 'flex';
    } else {
        // --- USUÁRIO DESLOGADO ---
        userInfo.style.display = 'none';
        loginContainer.style.display = 'block';
        
        loginPromptAgendamento.style.display = 'block';
        loginPromptVisualizacao.style.display = 'block';
        botoesVisualizacao.style.display = 'none';
        if (listaAgendamentos) listaAgendamentos.innerHTML = ''; // Limpa a lista de agendamentos
    }
}

/**
 * Altera a aba de conteúdo visível na seção principal.
 * @param {string} menuId - O ID do conteúdo do menu a ser exibido (ex: 'menu-agendamento').
 */
export function trocarAba(menuId) {
    // Esconde todos os conteúdos
    document.querySelectorAll('.menu-content').forEach(el => el.classList.remove('ativo'));
    // Mostra o conteúdo correto
    const abaAtiva = document.getElementById(menuId);
    if(abaAtiva) abaAtiva.classList.add('ativo');

    // Atualiza o estado visual do botão do menu
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('ativo'));
    const botaoAtivo = document.querySelector(`.menu-btn[data-menu="${menuId.replace('menu-','')}"]`);
    if(botaoAtivo) botaoAtivo.classList.add('ativo');
}

/**
 * Controla a visibilidade do loader principal da página.
 * @param {boolean} mostrar - True para mostrar o loader, false para mostrar o conteúdo.
 */
export function toggleLoader(mostrar) {
    document.getElementById('vitrine-loader').style.display = mostrar ? 'block' : 'none';
    document.getElementById('vitrine-content').style.display = mostrar ? 'none' : 'flex';
}
