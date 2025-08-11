// vitrine.js - Fluxo do cliente com dados reais de empresa, profissionais, serviços e horários

let empresaId = null;
let dadosEmpresa = {};
let listaProfissionais = [];
let profissionalSelecionado = null;
let agendamentoState = { data: null, horario: null, servico: null, profissional: null };

async function init() {
    try {
        document.getElementById('agendamento-form-container').style.display = 'none';

        empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        dadosEmpresa = await getDadosEmpresa(empresaId);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        renderizarDadosEmpresa(dadosEmpresa);

        // Carrega profissionais da empresa
        listaProfissionais = await getProfissionaisDaEmpresa(empresaId);

        // Para cada profissional, carrega serviços e horários
        for (const prof of listaProfissionais) {
            prof.servicos = await getServicosDoProfissional(empresaId, prof.id);
            prof.horarios = await getHorariosDoProfissional(empresaId, prof.id);
        }

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
        document.getElementById("vitrine-loader").innerHTML = `<p style="color:red; text-align: center;">${error.message}</p>`;
    }
}

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

    document.getElementById('agendamento-form-container').style.display = 'block';

    renderizarServicos(
        profissionalSelecionado.servicos || [],
        document.getElementById('lista-servicos'),
        selecionarServico
    );

    agendamentoState.servico = null;
    agendamentoState.data = null;
    agendamentoState.horario = null;
    document.getElementById('data-agendamento').value = '';
    document.getElementById('data-agendamento').disabled = true;
    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione um serviço para prosseguir.</p>';
    updateConfirmButtonState();
}

function renderizarServicos(servicos, container, callback) {
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
    dataInput.value = '';
    dataInput.disabled = false;
    dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    document.getElementById('grade-horarios').innerHTML = '<p class="aviso-horarios">Selecione uma data para ver os horários disponíveis.</p>';
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById('btn-confirmar-agendamento');
    if (!btn) return;
    const isReady = agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
}

function configurarEventosGerais() {
    document.getElementById('data-agendamento')?.addEventListener('change', async (e) => {
        agendamentoState.data = e.target.value;
        agendamentoState.horario = null;
        const horariosContainer = document.getElementById('grade-horarios');
        horariosContainer.innerHTML = '';

        if (!profissionalSelecionado || !agendamentoState.servico || !agendamentoState.data) {
            horariosContainer.innerHTML = '<p class="aviso-horarios">Selecione serviço e data.</p>';
            return;
        }

        // Exemplo de horários disponíveis (pode ser customizado conforme regras do seu sistema)
        const horariosConfig = profissionalSelecionado.horarios || {};
        const listaHorarios = horariosConfig[agendamentoState.data] || horariosConfig["horariosPadrao"] || [];
        if (listaHorarios.length > 0) {
            horariosContainer.innerHTML = listaHorarios.map(horario =>
                `<button class="btn-horario">${horario}</button>`
            ).join('');
        } else {
            horariosContainer.innerHTML = `<p>Nenhum horário disponível para este dia.</p>`;
        }
        updateConfirmButtonState();
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
        if (!agendamentoState.profissional || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
            alert("Preencha todos os campos para agendar!");
            return;
        }
        // Aqui você pode salvar o agendamento no Firestore se desejar!
        alert(`Agendamento confirmado:\n${agendamentoState.servico.nome} - ${agendamentoState.profissional.nome} - ${agendamentoState.data} - ${agendamentoState.horario}`);
    });
}

document.addEventListener('DOMContentLoaded', init);
