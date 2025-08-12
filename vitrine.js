// vitrine.js - Fluxo do cliente com dados reais de empresa, profissionais, serviços e horários

// IMPORTANTE: Certifique-se de importar/definir as funções auxiliares abaixo em outro arquivo JS ou neste mesmo!
/*
import { 
    getEmpresaIdFromURL, 
    getDadosEmpresa, 
    getProfissionaisDaEmpresa, 
    getServicosDoProfissional, 
    getHorariosDoProfissional 
} from './vitrine-helpers.js';
*/

let empresaId = null;
let dadosEmpresa = {};
let listaProfissionais = [];
let profissionalSelecionado = null;
let agendamentoState = { data: null, horario: null, servico: null, profissional: null };

async function init() {
    try {
        const agendamentoFormContainer = document.getElementById('agendamento-form-container');
        if (agendamentoFormContainer) agendamentoFormContainer.style.display = 'none';

        empresaId = typeof getEmpresaIdFromURL === "function" ? getEmpresaIdFromURL() : null;
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        dadosEmpresa = typeof getDadosEmpresa === "function" ? await getDadosEmpresa(empresaId) : null;
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        renderizarDadosEmpresa(dadosEmpresa);

        // Carrega profissionais da empresa
        listaProfissionais = typeof getProfissionaisDaEmpresa === "function" ? await getProfissionaisDaEmpresa(empresaId) : [];

        // Para cada profissional, carrega serviços e horários
        for (const prof of listaProfissionais) {
            prof.servicos = typeof getServicosDoProfissional === "function" 
                ? await getServicosDoProfissional(empresaId, prof.id) : [];
            prof.horarios = typeof getHorariosDoProfissional === "function" 
                ? await getHorariosDoProfissional(empresaId, prof.id) : {};
        }

        renderizarInformacoesDaEmpresa(dadosEmpresa, listaProfissionais);

        const containerProfissionais = document.getElementById('lista-profissionais');
        if (containerProfissionais) {
            if (listaProfissionais.length === 0) {
                containerProfissionais.innerHTML = "<p>Nenhum profissional cadastrado no momento.</p>";
            } else {
                renderizarProfissionais(listaProfissionais, containerProfissionais, selecionarProfissional);
            }
        }

        configurarEventosGerais();

        const vitrineLoader = document.getElementById("vitrine-loader");
        const vitrineContent = document.getElementById("vitrine-content");
        if (vitrineLoader) vitrineLoader.style.display = 'none';
        if (vitrineContent) vitrineContent.style.display = 'flex';

    } catch (error) {
        console.error("Erro na inicialização:", error);
        const vitrineLoader = document.getElementById("vitrine-loader");
        if (vitrineLoader) {
            vitrineLoader.innerHTML = `<p style="color:red; text-align: center;">${error.message}</p>`;
        }
    }
}

function renderizarDadosEmpresa(empresa) {
    document.title = empresa.nomeFantasia || "Agendamento Online";
    const nomeNegocio = document.getElementById('nome-negocio-publico');
    if (nomeNegocio) nomeNegocio.textContent = empresa.nomeFantasia || "Nome do Negócio";
    if (empresa.logoUrl) {
        const logo = document.getElementById('logo-publico');
        if (logo) logo.src = empresa.logoUrl;
    }
}

function renderizarInformacoesDaEmpresa(empresa, profissionais) {
    const infoNegocioDiv = document.getElementById('info-negocio');
    const infoServicosDiv = document.getElementById('info-servicos');
    if (infoNegocioDiv) {
        infoNegocioDiv.innerHTML = empresa.descricao 
            ? `<p>${empresa.descricao}</p>` 
            : `<p>Bem-vindo! Utilize a aba "Agendar" para marcar seu horário.</p>`;
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

function renderizarProfissionais(profissionais, container, callback) {
    container.innerHTML = profissionais.map(prof =>
        `<div class="card-profissional" data-id="${prof.id}">
            ${prof.nome}
        </div>`
    ).join('');
    container.querySelectorAll('.card-profissional').forEach(card => {
        card.addEventListener('click', () => {
            const prof = profissionais.find(p => p.id === card.getAttribute('data-id'));
            if (callback) callback(prof);
        });
    });
}

async function selecionarProfissional(profissional) {
    if (!profissional) return;
    profissionalSelecionado = profissional;
    agendamentoState.profissional = { id: profissional.id, nome: profissional.nome };

    document.querySelectorAll('.card-profissional.selecionado').forEach(c => c.classList.remove('selecionado'));
    const cardSel = document.querySelector(`.card-profissional[data-id="${profissional.id}"]`);
    if (cardSel) cardSel.classList.add('selecionado');

    const agendamentoFormContainer = document.getElementById('agendamento-form-container');
    if (agendamentoFormContainer) agendamentoFormContainer.style.display = 'block';

    renderizarServicos(
        profissionalSelecionado.servicos || [],
        document.getElementById('lista-servicos'),
        selecionarServico
    );

    agendamentoState.servico = null;
    agendamentoState.data = null;
    agendamentoState.horario = null;

    const dataAgendamentoInput = document.getElementById('data-agendamento');
    if (dataAgendamentoInput) {
        dataAgendamentoInput.value = '';
        dataAgendamentoInput.disabled = true;
        dataAgendamentoInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    const gradeHorarios = document.getElementById('grade-horarios');
    if (gradeHorarios) gradeHorarios.innerHTML = '<p class="aviso-horarios">Selecione um serviço para prosseguir.</p>';
    updateConfirmButtonState();
}

function renderizarServicos(servicos, container, callback) {
    if (!container) return;
    container.innerHTML = servicos.length > 0
        ? servicos.map(s => `<div class="card-servico" data-id="${s.id}">${s.nome} - ${s.duracao || 'N/A'}min - R$${parseFloat(s.preco || 0).toFixed(2).replace('.', ',')}</div>`).join('')
        : '<p>Nenhum serviço cadastrado para este profissional.</p>';
    container.querySelectorAll('.card-servico').forEach(card => {
        card.addEventListener('click', () => {
            const servico = servicos.find(s => s.id === card.getAttribute('data-id'));
            if (callback) callback(servico);
        });
    });
}

function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null;
    agendamentoState.data = null;

    const dataInput = document.getElementById('data-agendamento');
    if (dataInput) {
        dataInput.value = '';
        dataInput.disabled = false;
        dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    const gradeHorarios = document.getElementById('grade-horarios');
    if (gradeHorarios) gradeHorarios.innerHTML = '<p class="aviso-horarios">Selecione uma data para ver os horários disponíveis.</p>';
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
}

function configurarEventosGerais() {
    const dataAgendamentoInput = document.getElementById('data-agendamento');
    if (dataAgendamentoInput) {
        dataAgendamentoInput.addEventListener('change', async (e) => {
            agendamentoState.data = e.target.value;
            agendamentoState.horario = null;
            const horariosContainer = document.getElementById('grade-horarios');
            if (horariosContainer) horariosContainer.innerHTML = '';

            if (!profissionalSelecionado || !agendamentoState.servico || !agendamentoState.data) {
                if (horariosContainer) horariosContainer.innerHTML = '<p class="aviso-horarios">Selecione serviço e data.</p>';
                return;
            }

            // Exemplo de horários disponíveis (pode ser customizado conforme regras do seu sistema)
            const horariosConfig = profissionalSelecionado.horarios || {};
            const listaHorarios = horariosConfig[agendamentoState.data] || horariosConfig["horariosPadrao"] || [];
            if (horariosContainer) {
                if (listaHorarios.length > 0) {
                    horariosContainer.innerHTML = listaHorarios.map(horario =>
                        `<button class="btn-horario">${horario}</button>`
                    ).join('');
                } else {
                    horariosContainer.innerHTML = `<p>Nenhum horário disponível para este dia.</p>`;
                }
            }
            updateConfirmButtonState();
        });
    }

    const gradeHorarios = document.getElementById('grade-horarios');
    if (gradeHorarios) {
        gradeHorarios.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-horario')) {
                document.querySelectorAll('.btn-horario.selecionado').forEach(btn => btn.classList.remove('selecionado'));
                e.target.classList.add('selecionado');
                agendamentoState.horario = e.target.textContent;
                updateConfirmButtonState();
            }
        });
    }

    const btnConfirmarAgendamento = document.getElementById('btn-confirmar-agendamento');
    if (btnConfirmarAgendamento) {
        btnConfirmarAgendamento.addEventListener('click', async () => {
            if (!agendamentoState.profissional || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
                alert("Preencha todos os campos para agendar!");
                return;
            }
            // Aqui você pode salvar o agendamento no Firestore se desejar!
            alert(`Agendamento confirmado:\n${agendamentoState.servico.nome} - ${agendamentoState.profissional.nome} - ${agendamentoState.data} - ${agendamentoState.horario}`);
        });
    }
}

document.addEventListener('DOMContentLoaded', init);
