// vitrine.js (VERSÃO COM IMPORT CORRIGIDO)

// ==========================================================================
// IMPORTS DOS MÓDULOS
// ==========================================================================
import { currentUser, initializeAuth, fazerLogin as login, fazerLogout as logout } from './vitrini-auth.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa } from './vitrini-profissionais.js';
import { buscarEExibirAgendamentos, salvarAgendamento, cancelarAgendamento, buscarAgendamentosDoDia, calcularSlotsDisponiveis, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
// --- AQUI ESTÁ A CORREÇÃO ---
// Trocamos 'renderizarDadosProfissional' pelas novas funções 'renderizarDadosEmpresa' e 'renderizarProfissionais'.
import { renderizarServicos, renderizarDadosEmpresa, renderizarProfissionais, updateUIOnAuthChange } from './vitrini-ui.js';
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
// NOVA FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
// ==========================================================================
async function init() {
    try {
        document.getElementById('agendamento-form-container').style.display = 'none';

        initializeAuth((user) => {
            updateUIOnAuthChange(user, empresaId); // Passamos empresaId em vez de profissionalId
        });

        empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        dadosEmpresa = await getDadosEmpresa(empresaId);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        // Usa a função correta para renderizar os dados da EMPRESA
        renderizarDadosEmpresa(dadosEmpresa);

        listaProfissionais = await getProfissionaisDaEmpresa(empresaId);
        
        if (listaProfissionais.length === 0) {
            const containerProfissionais = document.getElementById('lista-profissionais');
            if(containerProfissionais) containerProfissionais.innerHTML = "<p>Nenhum profissional cadastrado no momento.</p>";
        } else {
            // Usa a função correta para renderizar os cards dos PROFISSIONAIS
            renderizarProfissionais(listaProfissionais, selecionarProfissional);
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
// FUNÇÕES DE RENDERIZAÇÃO E SELEÇÃO DE PROFISSIONAIS (O resto do código permanece igual)
// ==========================================================================

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

function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null;
    document.getElementById('data-agendamento').dispatchEvent(new Event('change'));
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
}

function configurarEventosGerais() {
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

    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('login-link-agendamento')?.addEventListener('click', login);
    document.getElementById('login-link-visualizacao')?.addEventListener('click', login);
    document.getElementById('btn-logout')?.addEventListener('click', logout);

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

    document.getElementById('grade-horarios')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            agendamentoState.horario = e.target.textContent;
            updateConfirmButtonState();
        }
    });

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

document.addEventListener('DOMContentLoaded', init);
