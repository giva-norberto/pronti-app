// vitrini-ui.js (VERSÃO COMPLETA E CORRIGIDA)

import { cancelarAgendamento, buscarEExibirAgendamentos } from './vitrini-agendamento.js';
import { currentUser } from './vitrini-auth.js';

/**
 * [NOVA FUNÇÃO PRINCIPAL]
 * Renderiza toda a página de "Informações", incluindo dados da empresa,
 * serviços e contato.
 * @param {object} empresa - Dados do documento da empresa.
 * @param {Array} profissionais - Lista de profissionais da empresa.
 */
export function renderizarPaginaInformacoes(empresa, profissionais) {
    if (!empresa) return;

    // Preenche o topo (nome e logo)
    document.title = empresa.nomeFantasia || "Agendamento Online";
    document.getElementById('nome-negocio-publico').textContent = empresa.nomeFantasia || "Nome do Negócio";
    if (empresa.logoUrl) {
        document.getElementById('logo-publico').src = empresa.logoUrl;
    }

    // Preenche o card "Sobre o Negócio"
    const infoNegocioDiv = document.getElementById('info-negocio');
    if (infoNegocioDiv) {
        infoNegocioDiv.innerHTML = `<p>${empresa.descricao || 'Nenhuma descrição fornecida.'}</p>`;
    }

    // Preenche o card "Contato" (pegando os dados do profissional que é o dono)
    const dono = profissionais.find(p => p.id === empresa.donoId);
    const containerContato = document.getElementById('info-contato');
    if (containerContato) {
        if (dono) {
            containerContato.innerHTML = `
                ${dono.telefone ? `<p><strong>Telefone:</strong> ${dono.telefone}</p>` : ''}
                ${dono.email ? `<p><strong>Email:</strong> ${dono.email}</p>` : ''}
                ${dono.endereco ? `<p><strong>Endereço:</strong> ${dono.endereco}</p>` : ''}
            `;
        } else {
            containerContato.innerHTML = "<p>Informações de contato não disponíveis.</p>";
        }
    }

    // Preenche o card "Serviços Oferecidos"
    const todosOsServicos = new Map();
    profissionais.forEach(prof => {
        if (prof.servicos && prof.visivelNaVitrine !== false) {
            prof.servicos.forEach(servico => {
                if (servico.visivelNaVitrine !== false) {
                    todosOsServicos.set(servico.nome, servico);
                }
            });
        }
    });
    
    const containerServicos = document.getElementById('info-servicos');
    if (containerServicos) {
        if (todosOsServicos.size > 0) {
            containerServicos.innerHTML = [...todosOsServicos.values()]
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(s => `
                    <div class="servico-info-item">
                        <strong>${s.nome}</strong>
                        <span>R$ ${parseFloat(s.preco || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                `).join('');
        } else {
            containerServicos.innerHTML = "<p>Nenhum serviço oferecido no momento.</p>";
        }
    }
}

/**
 * Renderiza os cards de todos os profissionais disponíveis para seleção na aba "Agendar".
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
                onSelectProfissional(profissional);
            }
        });
    });
}

/**
 * Renderiza a lista de serviços de um profissional selecionado na aba "Agendar".
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
        .map(s => `<button class="service-item" data-id="${s.id}">${s.nome} - R$ ${s.preco}</button>`)
        .join('');
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
    const agendamentosPrompt = document.getElementById('agendamentos-login-prompt');
    const agendamentosBotoes = document.getElementById('botoes-agendamento');
    const agendamentosLista = document.getElementById('lista-agendamentos-visualizacao');

    if (user) {
        if (userInfo) {
            userInfo.style.display = 'flex';
            document.getElementById('user-name').textContent = user.displayName;
            document.getElementById('user-photo').src = user.photoURL;
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
