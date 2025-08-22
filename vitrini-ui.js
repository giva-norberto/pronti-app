/**
 * Mostra ou esconde o loader inicial da página.
 * @param {boolean} mostrar - True para mostrar o loader, false para mostrar o conteúdo.
 * @param {string} [mensagem] - Mensagem opcional para o loader.
 */
export function toggleLoader(mostrar, mensagem = 'A carregar informações do negócio...') {
    const loader = document.getElementById('vitrine-loader');
    if (loader && loader.querySelector('p')) {
        loader.querySelector('p').textContent = mensagem;
    }
    if (loader) loader.style.display = mostrar ? 'block' : 'none';
    
    const content = document.getElementById('vitrine-content');
    if(content) content.style.display = mostrar ? 'none' : 'grid';
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
 * Atualiza a UI de autenticação.
 */
export function atualizarUIdeAuth(user) {
    const userInfo = document.getElementById('user-info');
    const loginContainer = document.getElementById('btn-login-container');
    const agendamentosContainer = document.getElementById('botoes-agendamento');
    
    if (user) {
        if(agendamentosContainer) agendamentosContainer.style.display = 'flex';
        if(userInfo) userInfo.style.display = 'block';
        if(loginContainer) loginContainer.style.display = 'none';
        document.getElementById('user-photo').src = user.photoURL || 'https://placehold.co/80x80/eef2ff/4f46e5?text=User';
        document.getElementById('user-name').textContent = user.displayName || 'Usuário';
    } else {
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
 * Seleciona um card e opcionalmente mostra um estado de 'loading'.
 */
export function selecionarCard(tipo, id, isLoading = false) {
    const seletorMap = { profissional: '.card-profissional', servico: '.card-servico', horario: '.btn-horario' };
    const seletor = seletorMap[tipo];
    if (!seletor) return;

    document.querySelectorAll(seletor).forEach(c => c.classList.remove('selecionado', 'loading'));

    if (id) {
        const attribute = (tipo === 'horario') ? 'data-horario' : 'data-id';
        const element = document.querySelector(`${seletor}[${attribute}="${id}"]`);
        if (element) {
            element.classList.add('selecionado');
            if (isLoading) element.classList.add('loading');
        }
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
    if (!container) return;
    container.innerHTML = '';
    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `<p>Você não tem agendamentos ${modo === 'ativos' ? 'futuros' : 'passados'}.</p>`;
        return;
    }
    agendamentos.sort((a, b) => new Date(`${a.data}T${a.horario}`) - new Date(`${b.data}T${b.horario}`));
    agendamentos.forEach(ag => {
        const dataFormatada = new Date(`${ag.data}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

/**
 * Limpa a seleção de um tipo de card.
 */
export function limparSelecao(tipo) {
    selecionarCard(tipo, null);
}

/**
 * Atualiza o status do input de data.
 */
export function atualizarStatusData(desabilitarInput, mensagemHorarios = '') {
    const dataInput = document.getElementById('data-agendamento');
    if(dataInput) dataInput.disabled = desabilitarInput;
    renderizarHorarios([], mensagemHorarios);
}

/**
 * Seleciona o filtro (Ativos/Histórico).
 */
export function selecionarFiltro(modo) {
    document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('ativo'));
    const btnId = modo === 'ativos' ? 'btn-ver-ativos' : 'btn-ver-historico';
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('ativo');
}

/**
 * Desabilita o botão de confirmar agendamento.
 */
export function desabilitarBotaoConfirmar() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (btn) btn.disabled = true;
}

/**
 * Habilita o botão de confirmar agendamento.
 */
export function habilitarBotaoConfirmar() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (btn) btn.disabled = false;
}

/**
 * Mostra/esconde a mensagem de login na tela de agendamento.
 */
export function toggleAgendamentoLoginPrompt(mostrar) {
    const prompt = document.getElementById('agendamento-login-prompt');
    if (prompt) prompt.style.display = mostrar ? 'block' : 'none';
}

/**
 * Mostra a mensagem de login na aba "Meus Agendamentos".
 */
export function exibirMensagemDeLoginAgendamentos() {
    const promptLogin = document.querySelector('#menu-visualizacao #agendamentos-login-prompt');
    const listaAgendamentos = document.getElementById('lista-agendamentos-visualizacao');
    const botoesFiltro = document.getElementById('botoes-agendamento');
    if (promptLogin) promptLogin.style.display = 'block';
    if (listaAgendamentos) listaAgendamentos.innerHTML = '';
    if (botoesFiltro) botoesFiltro.style.display = 'none';
}

/**
 * Força a abertura do modal de login.
 */
export function abrirModalLogin() {
    const modal = document.getElementById('modal-auth-janela');
    if (modal) {
        document.getElementById('modal-auth-cadastro').style.display = 'none';
        document.getElementById('modal-auth-login').style.display = 'block';
        modal.style.display = 'flex';
    }
}

/**
 * Mostra um alerta com uma mensagem de sucesso, usando o modal customizado.
 */
export async function mostrarAlerta(titulo, mensagem) {
    return new Promise(resolve => {
        const modal = document.getElementById('custom-confirm-modal');
        const tituloEl = document.getElementById('modal-titulo');
        const mensagemEl = document.getElementById('modal-mensagem');
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        const btnCancelar = document.getElementById('modal-btn-cancelar');

        if (!modal || !tituloEl || !mensagemEl || !btnConfirmar || !btnCancelar) {
            alert(mensagem);
            resolve();
            return;
        }

        tituloEl.textContent = titulo;
        mensagemEl.textContent = mensagem;
        btnCancelar.style.display = 'none';
        btnConfirmar.textContent = 'OK';
        modal.style.display = 'flex';

        const onConfirmar = () => {
            modal.style.display = 'none';
            btnCancelar.style.display = 'inline-block';
            btnConfirmar.textContent = 'Confirmar';
            resolve();
        };

        const novoBtnConfirmar = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(novoBtnConfirmar, btnConfirmar);
        novoBtnConfirmar.addEventListener('click', onConfirmar, { once: true });
    });
}

/**
 * Mostra um modal de confirmação customizado (Sim/Não).
 */
export function mostrarConfirmacao(titulo, mensagem) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const tituloEl = document.getElementById('modal-titulo');
        const mensagemEl = document.getElementById('modal-mensagem');
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        const btnCancelar = document.getElementById('modal-btn-cancelar');

        if (!modal || !tituloEl || !mensagemEl || !btnConfirmar || !btnCancelar) {
            resolve(confirm(mensagem));
            return;
        }

        tituloEl.textContent = titulo;
        mensagemEl.textContent = mensagem;
        btnCancelar.style.display = 'inline-block';
        btnConfirmar.textContent = 'Confirmar';
        modal.style.display = 'flex';
        
        const onConfirmar = () => {
            modal.style.display = 'none';
            resolve(true);
        };

        const onCancelar = () => {
            modal.style.display = 'none';
            resolve(false);
        };
        
        const novoBtnConfirmar = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(novoBtnConfirmar, btnConfirmar);
        novoBtnConfirmar.addEventListener('click', onConfirmar, { once: true });
        
        const novoBtnCancelar = btnCancelar.cloneNode(true);
        btnCancelar.parentNode.replaceChild(novoBtnCancelar, btnCancelar);
        novoBtnCancelar.addEventListener('click', onCancelar, { once: true });
    });
}
