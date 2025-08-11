// vitrine.js (VISÃO CLIENTE - FLUXO REAL FIRESTORE)
// ==========================================================================
// NÃO USE import/export! Use funções globais expostas no window.
// ==========================================================================

// Não precisa de funções dummy! Use as reais do vitrine-profissionais.js

// ==========================================================================
// ESTADO DA APLICAÇÃO
// ==========================================================================
let empresaId = null;
let dadosEmpresa = {};
let listaProfissionais = [];
let profissionalSelecionado = null;
let agendamentoState = { data: null, horario: null, servico: null, profissional: null };

// ==========================================================================
// INICIALIZAÇÃO PRINCIPAL
// ==========================================================================
async function init() {
    try {
        document.getElementById('agendamento-form-container').style.display = 'none';

        empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        // DADOS REAIS DA EMPRESA (DONO)
        dadosEmpresa = await getDadosEmpresa(empresaId);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        renderizarDadosEmpresa(dadosEmpresa);

        // DADOS REAIS DOS PROFISSIONAIS/FUNCIONÁRIOS
        listaProfissionais = await getProfissionaisDaEmpresa(empresaId);

        renderizarInformacoesDaEmpresa(dadosEmpresa, listaProfissionais);

        const containerProfissionais = document.getElementById('lista-profissionais');
        if (listaProfissionais.length === 0) {
            containerProfissionais.innerHTML = "<p>Nenhum profissional cadastrado no momento.</p>";
        } else {
            renderizarProfissionais(listaProfissionais, containerProfissionais, selecionarProfissional);
        }

        configurarEventosGerais();

        document.getElementById("vitrine-loader").style.display = 'none';
        document.getElementById("vitrine-content").style.display = 'flex';

    } catch (error) {
        console.error("Erro na inicialização:", error);
        if (typeof showAlert === "function") showAlert("Erro", error.message);
        document.getElementById("vitrine-loader").innerHTML = `<p style="color:red; text-align: center;">${error.message}</p>`;
    }
}

// ==========================================================================
// RENDERIZAÇÃO DE DADOS
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

// Renderiza profissionais (funcionários)
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

// ==========================================================================
// FLUXO DE SELEÇÃO
// ==========================================================================
async function selecionarProfissional(profissional) {
    if (!profissional) return;
    profissionalSelecionado = profissional;
    agendamentoState.profissional = { id: profissional.id, nome: profissional.nome };

    document.querySelectorAll('.card-profissional.selecionado').forEach(c => c.classList.remove('selecionado'));
    const cardSel = document.querySelector(`.card-profissional[data-id="${profissional.id}"]`);
    if (cardSel) cardSel.classList.add('selecionado');

    document.getElementById('agendamento-form-container').style.display = 'block';

    if (typeof renderizarServicos === "function") {
        renderizarServicos(
            profissionalSelecionado.servicos || [],
            document.getElementById('lista-servicos'),
            selecionarServico
        );
    }

    agendamentoState.servico = null;
    agendamentoState.data = null;
    agendamentoState.horario = null;
    document.getElementById('data-agendamento').value = '';
    document.getElementById('data-agendamento').disabled = true;
    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione um serviço para prosseguir.</p>';
    updateConfirmButtonState();
}

function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null;
    agendamentoState.data = null;

    const dataInput = document.getElementById('data-agendamento');
    dataInput.value = '';
    dataInput.disabled = false;
    dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione uma data para ver os horários disponíveis.</p>';
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = typeof currentUser !== "undefined" && currentUser && agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
}

// ==========================================================================
// EVENTOS DA TELA
// ==========================================================================
function configurarEventosGerais() {
    // ... seus eventos originais ...
}

// Inicia a aplicação quando o HTML estiver pronto
document.addEventListener('DOMContentLoaded', init);
