// vitrine.js (VERSÃO FINAL E COMPLETA - CORREÇÃO DO BOTÃO CANCELAR)

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
            // Se o usuário estiver na aba de agendamentos, recarrega a lista
            if (user && document.querySelector('.menu-btn[data-menu="visualizacao"]')?.classList.contains('ativo')) {
                buscarEExibirAgendamentos(empresaId, user, 'ativos');
            }
        });

        empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        dadosEmpresa = await getDadosEmpresa(empresaId);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        renderizarDadosEmpresa(dadosEmpresa);
        listaProfissionais = await getProfissionaisDaEmpresa(empresaId);
        renderizarInformacoesDaEmpresa(dadosEmpresa, listaProfissionais);
        
        if (listaProfissionais.length === 0) {
            document.getElementById('lista-profissionais').innerHTML = "<p>Nenhum profissional cadastrado no momento.</p>";
        } else {
            renderizarProfissionais(listaProfissionais);
        }
        
        configurarEventosGerais(); 

        document.getElementById("vitrine-loader").style.display = 'none';
        document.getElementById("vitrine-content").style.display = 'flex';

    } catch (error) {
        console.error("Erro na inicialização:", error);
        showAlert("Erro", error.message);
        document.getElementById("vitrine-loader").innerHTML = `<p style="color:red; text-align: center;">${error.message}</p>`;
    }
}

// ==========================================================================
// FUNÇÕES DE RENDERIZAÇÃO E SELEÇÃO
// ==========================================================================

function renderizarDadosEmpresa(empresa) {
    document.title = empresa.nomeFantasia || "Agendamento Online";
    document.getElementById('nome-negocio-publico').textContent = empresa.nomeFantasia || "Nome do Negócio";
    if (empresa.logoUrl) {
        document.getElementById('logo-publico').src = empresa.logoUrl;
    }
}

function renderizarInformacoesDaEmpresa(empresa, profissionais) {
    const infoNegocioDiv = document.getElementById('info-negocio');
    const infoServicosDiv = document.getElementById('info-servicos');

    if (infoNegocioDiv) {
        infoNegocioDiv.innerHTML = empresa.descricao ? `<p>${empresa.descricao}</p>` : `<p>Bem-vindo! Utilize a aba "Agendar" para marcar seu horário.</p>`;
    }

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

function renderizarProfissionais(profissionais) {
    const container = document.getElementById('lista-profissionais');
    container.innerHTML = profissionais.map(prof => `
        <div class="card-profissional" data-id="${prof.id}">
            <img src="${prof.fotoUrl || 'https://placehold.co/100x100/e0e7ff/6366f1?text=Foto'}" alt="Foto de ${prof.nome}">
            <h3>${prof.nome}</h3>
        </div>
    ` ).join('');

    document.querySelectorAll('.card-profissional').forEach(card => {
        card.addEventListener('click', () => {
            selecionarProfissional(listaProfissionais.find(p => p.id === card.dataset.id));
        });
    });
}

async function selecionarProfissional(profissional) {
    if (!profissional) return;
    profissionalSelecionado = profissional;
    agendamentoState.profissional = { id: profissional.id, nome: profissional.nome };
    
    document.querySelectorAll('.card-profissional.selecionado').forEach(c => c.classList.remove('selecionado'));
    document.querySelector(`.card-profissional[data-id="${profissional.id}"]`).classList.add('selecionado');

    document.getElementById('agendamento-form-container').style.display = 'block';
    
    renderizarServicos(profissionalSelecionado.servicos, selecionarServico);
    
    const primeiraData = await encontrarPrimeiraDataComSlots(empresaId, profissionalSelecionado);
    const dataInput = document.getElementById('data-agendamento');
    if (dataInput) {
        dataInput.value = primeiraData || '';
        dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dataInput.dispatchEvent(new Event('change'));
    }
    
    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data.</p>';
}

function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null;
    document.getElementById('data-agendamento').dispatchEvent(new Event('change'));
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = currentUser && agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
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
            document.getElementById(`menu-${button.dataset.menu}`).classList.add('ativo');
            
            if (button.dataset.menu === 'visualizacao' && currentUser) {
                const modoAtivo = document.querySelector('.btn-toggle.ativo')?.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
                buscarEExibirAgendamentos(empresaId, currentUser, modoAtivo);
            }
        });
    });

    // Eventos de login/logout
    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('login-link-agendamento')?.addEventListener('click', (e) => { e.preventDefault(); login(); });
    document.getElementById('login-link-visualizacao')?.addEventListener('click', (e) => { e.preventDefault(); login(); });
    document.getElementById('btn-logout')?.addEventListener('click', logout);

    // Evento do seletor de data
    document.getElementById('data-agendamento')?.addEventListener('change', async (e) => {
        agendamentoState.data = e.target.value;
        agendamentoState.horario = null;
        const horariosContainer = document.getElementById('grade-horarios');
        horariosContainer.innerHTML = '';
        updateConfirmButtonState();

        if (!profissionalSelecionado || !agendamentoState.servico || !agendamentoState.data) {
            horariosContainer.innerHTML = '<p class="aviso-horarios">Selecione serviço e data.</p>';
            return;
        }

        horariosContainer.innerHTML = '<p>Verificando horários...</p>';
        const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, agendamentoState.data);
        const agendamentosDoProfissional = agendamentosDoDia.filter(ag => ag.profissionalId === profissionalSelecionado.id);
        const slotsDisponiveis = calcularSlotsDisponiveis(agendamentoState.data, agendamentosDoProfissional, profissionalSelecionado.horarios, agendamentoState.servico.duracao);
        
        horariosContainer.innerHTML = slotsDisponiveis.length > 0
            ? slotsDisponiveis.map(horario => `<button class="btn-horario">${horario}</button>`).join('')
            : '<p>Nenhum horário disponível para esta data.</p>';
    });

    // Evento de clique na grade de horários (Delegação de Eventos)
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
        if (!currentUser) {
            showAlert("Atenção", "Você precisa fazer login para agendar.");
            return;
        }
        const btn = document.getElementById('btn-confirmar-agendamento');
        btn.disabled = true;
        const confirmado = await showCustomConfirm("Confirmar Agendamento", `Deseja agendar "${agendamentoState.servico.nome}" com ${agendamentoState.profissional.nome} para ${new Date(agendamentoState.data + 'T00:00:00').toLocaleDateString()} às ${agendamentoState.horario}?`);
        if (confirmado) {
            await salvarAgendamento(empresaId, currentUser, agendamentoState);
        } else {
            btn.disabled = false;
        }
    });

    // --- INÍCIO DA CORREÇÃO ---
    // Evento para os botões de "Ver Ativos" e "Ver Histórico"
    document.getElementById('botoes-agendamento')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-toggle') && currentUser) {
            document.querySelector('.btn-toggle.ativo').classList.remove('ativo');
            e.target.classList.add('ativo');
            const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
            buscarEExibirAgendamentos(empresaId, currentUser, modo);
        }
    });

    // Evento para o botão CANCELAR (Delegação de Eventos)
    document.getElementById('lista-agendamentos-visualizacao')?.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-cancelar')) {
            const agendamentoId = e.target.dataset.id;
            const confirmado = await showCustomConfirm("Cancelar Agendamento", "Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.");
            
            if (confirmado) {
                await cancelarAgendamento(empresaId, agendamentoId, () => {
                    // Após cancelar, recarrega a lista de agendamentos ativos
                    buscarEExibirAgendamentos(empresaId, currentUser, 'ativos');
                    document.querySelector('#btn-ver-historico').classList.remove('ativo');
                    document.querySelector('#btn-ver-ativos').classList.add('ativo');
                });
            }
        }
    });
    // --- FIM DA CORREÇÃO ---
}

// Inicia a aplicação quando o HTML estiver pronto
document.addEventListener('DOMContentLoaded', init);
