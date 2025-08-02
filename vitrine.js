// vitrine.js (VERSÃO FINAL E COMPLETA - MÚLTIPLOS PROFISSIONAIS COM ABA DE INFORMAÇÕES)

// ==========================================================================
// IMPORTS DOS MÓDULOS
// ==========================================================================
import { currentUser, initializeAuth, fazerLogin as login, fazerLogout as logout } from './vitrini-auth.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa } from './vitrini-profissionais.js';
import { buscarEExibirAgendamentos, salvarAgendamento, cancelarAgendamento, buscarAgendamentosDoDia, calcularSlotsDisponiveis, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { renderizarServicos, updateUIOnAuthChange } from './vitrini-ui.js';
import { showAlert, showCustomConfirm } from './vitrini-utils.js';

// ==========================================================================
// ESTADO DA APLICAÇÃO
// ==========================================================================
let empresaId = null;
let dadosEmpresa = {};
let listaProfissionais = [];
let profissionalSelecionado = null;
let agendamentoState = { data: null, horario: null, servico: null, profissional: null };

// ==========================================================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
// ==========================================================================
async function init() {
    try {
        document.getElementById('agendamento-form-container').style.display = 'none';

        initializeAuth((user) => {
            updateUIOnAuthChange(user, profissionalSelecionado?.id);
        });

        empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        dadosEmpresa = await getDadosEmpresa(empresaId);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        // Usa os dados da empresa para preencher o topo da página
        renderizarDadosEmpresa(dadosEmpresa);

        listaProfissionais = await getProfissionaisDaEmpresa(empresaId);

        // [NOVO] Chama a função para preencher a aba "Informações"
        renderizarInformacoesDaEmpresa(dadosEmpresa, listaProfissionais);
        
        if (listaProfissionais.length === 0) {
            const containerProfissionais = document.getElementById('lista-profissionais');
            if(containerProfissionais) containerProfissionais.innerHTML = "<p>Nenhum profissional cadastrado no momento.</p>";
        } else {
            // Desenha os cards dos profissionais na tela para o usuário escolher
            renderizarProfissionais(listaProfissionais);
        }
        
        configurarEventosGerais(); 

        document.getElementById("vitrine-loader").style.display = 'none';
        document.getElementById("vitrine-content").style.display = 'flex';

    } catch (error) {
        console.error("Erro na inicialização:", error);
        await showAlert("Erro", error.message);
        const loader = document.getElementById("vitrine-loader");
        if(loader) loader.innerHTML = `<p style="color:red; text-align: center;">${error.message}</p>`;
    }
}

// ==========================================================================
// FUNÇÕES DE RENDERIZAÇÃO E SELEÇÃO
// ==========================================================================

/**
 * Renderiza os dados gerais da empresa na tela (título, nome, logo).
 */
function renderizarDadosEmpresa(empresa) {
    document.title = empresa.nomeFantasia || "Agendamento Online";
    document.getElementById('nome-negocio-publico').textContent = empresa.nomeFantasia || "Nome do Negócio";
    if (empresa.logoUrl) {
        document.getElementById('logo-publico').src = empresa.logoUrl;
    }
}

/**
 * [NOVA FUNÇÃO]
 * Preenche a aba "Informações" com os dados da empresa e uma lista de serviços.
 * @param {object} empresa - Os dados do documento da empresa.
 * @param {Array} profissionais - A lista de todos os profissionais da empresa.
 */
function renderizarInformacoesDaEmpresa(empresa, profissionais) {
    const infoNegocioDiv = document.getElementById('info-negocio');
    const infoServicosDiv = document.getElementById('info-servicos');

    // 1. Renderiza a descrição do negócio, se existir.
    if (infoNegocioDiv) {
        infoNegocioDiv.innerHTML = empresa.descricao ? `<p>${empresa.descricao}</p>` : `<p>Bem-vindo ao nosso espaço! Utilize a aba "Agendar" para marcar seu horário.</p>`;
    }

    // 2. Cria e renderiza uma lista única de todos os serviços oferecidos.
    if (infoServicosDiv) {
        const todosOsServicos = new Map();
        profissionais.forEach(prof => {
            (prof.servicos || []).forEach(servico => {
                if (!todosOsServicos.has(servico.nome)) {
                    todosOsServicos.set(servico.nome, servico);
                }
            });
        });

        const listaDeServicos = Array.from(todosOsServicos.values());

        if (listaDeServicos.length > 0) {
            infoServicosDiv.innerHTML = listaDeServicos.map(s => `
                <div class="servico-info-card">
                    <h4>${s.nome}</h4>
                    <p>${s.duracao || 'N/A'} min</p>
                    <p>R$ ${parseFloat(s.preco || 0).toFixed(2).replace('.', ',')}</p>
                </div>
            `).join('');
        } else {
            infoServicosDiv.innerHTML = '<p>Os serviços oferecidos aparecerão aqui.</p>';
        }
    }
}


/**
 * Cria e exibe os cards para cada profissional disponível para seleção.
 */
function renderizarProfissionais(profissionais) {
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
            const profissional = listaProfissionais.find(p => p.id === id);
            if (profissional) {
                selecionarProfissional(profissional);
            }
        });
    });
}

/**
 * Ação executada quando um profissional é selecionado pelo cliente.
 */
async function selecionarProfissional(profissional) {
    profissionalSelecionado = profissional;
    agendamentoState.profissional = { id: profissional.id, nome: profissional.nome };
    
    document.querySelectorAll('.card-profissional').forEach(card => card.classList.remove('selecionado'));
    document.querySelector(`.card-profissional[data-id="${profissional.id}"]`).classList.add('selecionado');

    document.getElementById('agendamento-form-container').style.display = 'block';
    
    renderizarServicos(profissionalSelecionado.servicos, selecionarServico);
    
    const primeiraData = await encontrarPrimeiraDataComSlots(empresaId, profissionalSelecionado);
    const dataInput = document.getElementById('data-agendamento');
    if (dataInput) {
        if (primeiraData) {
            dataInput.value = primeiraData;
        }
        dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dataInput.dispatchEvent(new Event('change'));
    }
    
    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data para ver os horários.</p>';
}

/**
 * Ação executada quando um serviço é selecionado.
 */
function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null;
    document.getElementById('data-agendamento').dispatchEvent(new Event('change'));
    updateConfirmButtonState();
}

/**
 * Habilita ou desabilita o botão de confirmar agendamento.
 */
function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
}

/**
 * Configura todos os eventos da página.
 */
function configurarEventosGerais() {
    // Eventos do menu lateral
    document.querySelectorAll('.sidebar-menu .menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-menu .menu-btn.ativo, .main-content-vitrine .menu-content.ativo').forEach(el => el.classList.remove('ativo'));
            button.classList.add('ativo');
            const menuContent = document.getElementById(`menu-${button.dataset.menu}`);
            if (menuContent) menuContent.classList.add('ativo');
            if (button.dataset.menu === 'visualizacao' && currentUser) {
                buscarEExibirAgendamentos(empresaId, currentUser, 'ativos');
            }
        });
    });

    // Eventos de login/logout
    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('login-link-agendamento')?.addEventListener('click', login);
    document.getElementById('login-link-visualizacao')?.addEventListener('click', login);
    document.getElementById('btn-logout')?.addEventListener('click', logout);

    // Evento do seletor de data
    document.getElementById('data-agendamento')?.addEventListener('change', async (e) => {
        const dataSelecionada = e.target.value;
        agendamentoState.data = dataSelecionada;
        agendamentoState.horario = null;
        updateConfirmButtonState();

        if (!profissionalSelecionado) return; 
        if (!agendamentoState.servico) {
            document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Primeiro, escolha um serviço.</p>';
            return;
        }
        if (!dataSelecionada) return;

        const horariosContainer = document.getElementById('grade-horarios');
        horariosContainer.innerHTML = '<p>Verificando horários...</p>';
        
        const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataSelecionada);
        const agendamentosDoProfissional = agendamentosDoDia.filter(ag => ag.profissionalId === profissionalSelecionado.id);

        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataSelecionada, agendamentosDoProfissional, profissionalSelecionado.horarios, agendamentoState.servico.duracao
        );
        horariosContainer.innerHTML = slotsDisponiveis.length > 0
            ? slotsDisponiveis.map(horario => `<button class="btn-horario">${horario}</button>`).join('')
            : '<p>Nenhum horário disponível para esta data.</p>';
    });

    // Evento de clique na grade de horários
    document.getElementById('grade-horarios')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            agendamentoState.horario = e.target.textContent;
            updateConfirmButtonState();
        }
    });

    // Evento para confirmar o agendamento
    document.getElementById('btn-confirmar-agendamento')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirmar-agendamento');
        if (!currentUser) {
            await showAlert("Atenção", "Você precisa fazer login para agendar.");
            return;
        }
        if (!agendamentoState.profissional || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
            await showAlert("Atenção", "Por favor, selecione profissional, serviço, data e horário.");
            return;
        }
        
        btn.disabled = true;
        const confirmado = await showCustomConfirm(
            "Confirmar Agendamento",
            `Deseja agendar "${agendamentoState.servico.nome}" com ${agendamentoState.profissional.nome} para ${new Date(agendamentoState.data + 'T00:00:00').toLocaleDateString()} às ${agendamentoState.horario}?`
        );
        if (confirmado) {
            await salvarAgendamento(empresaId, currentUser, agendamentoState);
        } else {
            btn.disabled = false;
        }
    });
}

// Inicia a aplicação quando o HTML estiver pronto
document.addEventListener('DOMContentLoaded', init);
