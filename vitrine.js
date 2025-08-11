import { getEmpresaIdFromURL, showAlert, showCustomConfirm } from './vitrini-utils.js';

// vitrine.js (VISÃO CLIENTE - FLUXO DIDÁTICO E FUNCIONAL, REVISADO)
// ==========================================================================
// NÃO USE import/export! Use funções globais expostas no window.
// ==========================================================================

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
        document.getElementById(\'agendamento-form-container\').style.display = \'none\';

        // initializeAuth vem do vitrini-auth.js global
        initializeAuth((user) => {
            updateUIOnAuthChange(user, empresaId);
                if (user && document.querySelector(\.menu-btn[data-menu=\"visualizacao\"]\
)?.classList.contains(\'ativo\')) {
                buscarEExibirAgendamentos(empresaId, user, \'ativos\');
                }
            });

        empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("URL inválida: ID da empresa não encontrado.");

        dadosEmpresa = await getDadosEmpresa(empresaId);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        renderizarDadosEmpresa(dadosEmpresa);

        listaProfissionais = await getProfissionaisDaEmpresa(empresaId);

        console.log("Profissionais carregados:", listaProfissionais);

        renderizarInformacoesDaEmpresa(dadosEmpresa, listaProfissionais);

        const containerProfissionais = document.getElementById(\'lista-profissionais\');
        if (listaProfissionais.length === 0) {
            containerProfissionais.innerHTML = "<p>Nenhum profissional cadastrado no momento.</p>";
        } else {
            renderizarProfissionais(listaProfissionais, containerProfissionais, selecionarProfissional);
        }

        configurarEventosGerais();

        document.getElementById("vitrine-loader").style.display = \'none\';
        document.getElementById("vitrine-content").style.display = \'flex\';

    } catch (error) {
        console.error("Erro na inicialização:", error);
        showAlert("Erro", error.message);
        document.getElementById("vitrine-loader").innerHTML = `<p style=\"color:red; text-align: center;\">${error.message}</p>`;
    }
}

// ==========================================================================
// FUNÇÕES DE RENDERIZAÇÃO E SELEÇÃO
// ==========================================================================
function renderizarDadosEmpresa(empresa) {
    document.title = empresa.nomeFantasia || "Agendamento Online";
    document.getElementById(\'nome-negocio-publico\').textContent = empresa.nomeFantasia || "Nome do Negócio";
    if (empresa.logoUrl) {
        document.getElementById(\'logo-publico\').src = empresa.logoUrl;
    }
}

function renderizarInformacoesDaEmpresa(empresa, profissionais) {
    const infoNegocioDiv = document.getElementById(\'info-negocio\');
    const infoServicosDiv = document.getElementById(\'info-servicos\');

    if (infoNegocioDiv) {
        infoNegocioDiv.innerHTML = empresa.descricao ? `<p>${empresa.descricao}</p>` : `<p>Bem-vindo! Utilize a aba \"Agendar\" para marcar seu horário.</p>`;
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
            infoServicosDiv.innerHTML = listaDeServicos.map(s => `\n                <div class=\"servico-info-card\">\n                    <h4>${s.nome}</h4>\n                    <p>${s.duracao || \'N/A\'} min</p>\n                    <p>R$ ${parseFloat(s.preco || 0).toFixed(2).replace(\\\'.\\\', \',\\[\\\]\')}</p>\n                </div>\n            `).join(\'\');
        } else {
            infoServicosDiv.innerHTML = \'<p>Os serviços oferecidos aparecerão aqui.</p>\';
        }
    }
}

async function selecionarProfissional(profissional) {
    if (!profissional) return;
    profissionalSelecionado = profissional;
    agendamentoState.profissional = { id: profissional.id, nome: profissional.nome };

    document.querySelectorAll(\.card-profissional.selecionado\
).forEach(c => c.classList.remove(\'selecionado\'));
    const cardSel = document.querySelector(`.card-profissional[data-id=\"${profissional.id}\"]`);
    if (cardSel) cardSel.classList.add(\'selecionado\');

    document.getElementById(\'agendamento-form-container\
).style.display = \'block\';

    console.log("Serviços do profissional selecionado:", profissionalSelecionado.servicos);

    renderizarServicos(
        profissionalSelecionado.servicos || [],
        document.getElementById(\'lista-servicos\
),
        selecionarServico
    );

    agendamentoState.servico = null;
    agendamentoState.data = null;
    agendamentoState.horario = null;
    document.getElementById(\'data-agendamento\
).value = \'\';
    document.getElementById(\'data-agendamento\
).disabled = true;
    document.getElementById(\'grade-horarios\
).innerHTML = \'<p class=\"aviso-horarios\">Selecione um serviço para prosseguir.</p>\';
    updateConfirmButtonState();
}

function selecionarServico(servico) {
    agendamentoState.servico = servico;
    agendamentoState.horario = null;
    agendamentoState.data = null;

    const dataInput = document.getElementById(\'data-agendamento\');
    dataInput.value = \'\';
    dataInput.disabled = false;
    dataInput.min = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split(\'T\')[0];

    document.getElementById(\'grade-horarios\').innerHTML = \'<p class=\"aviso-horarios\">Selecione uma data para ver os horários disponíveis.</p>\';
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const btn = document.getElementById(\'btn-confirmar-agendamento\');
    if (!btn) return;
    const isReady = typeof currentUser !== "undefined" && currentUser && agendamentoState.profissional && agendamentoState.servico && agendamentoState.data && agendamentoState.horario;
    btn.disabled = !isReady;
}

function configurarEventosGerais() {
    document.querySelectorAll(\.sidebar-menu .menu-btn\').forEach(button => {
        button.addEventListener(\'click\', () => {
            document.querySelectorAll(\.sidebar-menu .menu-btn.ativo, .main-content-vitrine .menu-content.ativo\').forEach(el => el.classList.remove(\'ativo\'));
            button.classList.add(\'ativo\');
            document.getElementById(`menu-${button.dataset.menu}`).classList.add(\'ativo\');

            if (button.dataset.menu === \'visualizacao\' && typeof currentUser !== "undefined" && currentUser) {
                const modoAtivo = document.querySelector(\.btn-toggle.ativo\
)?.id === \'btn-ver-ativos\' ? \'ativos\' : \'historico\';
                buscarEExibirAgendamentos(empresaId, currentUser, modoAtivo);
            }
        });
    });

    document.getElementById(\'btn-login\')?.addEventListener(\'click\', () => { login(); });
    document.getElementById(\'login-link-agendamento\')?.addEventListener(\'click\', (e) => { e.preventDefault(); login(); });
    document.getElementById(\'login-link-visualizacao\')?.addEventListener(\'click\', (e) => { e.preventDefault(); login(); });
    document.getElementById(\'btn-logout\')?.addEventListener(\'click\', () => { logout(); });

    document.getElementById(\'data-agendamento\')?.addEventListener(\'change\', async (e) => {
        agendamentoState.data = e.target.value;
        agendamentoState.horario = null;
        const horariosContainer = document.getElementById(\'grade-horarios\');
        horariosContainer.innerHTML = \'\';
        updateConfirmButtonState();

        if (!profissionalSelecionado || !agendamentoState.servico || !agendamentoState.data) {
            horariosContainer.innerHTML = \'<p class=\"aviso-horarios\">Selecione serviço e data.</p>\';
            return;
        }

        horariosContainer.innerHTML = \'<p>Verificando horários...</p>\';
        let agendamentosDoDia = [];
        agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, agendamentoState.data);
        const agendamentosDoProfissional = agendamentosDoDia.filter(ag => ag.profissionalId === profissionalSelecionado.id);

        let slotsDisponiveis = [];
        slotsDisponiveis = calcularSlotsDisponiveis(
            agendamentoState.data,
            agendamentosDoProfissional,
            profissionalSelecionado.horarios,
            agendamentoState.servico.duracao
        );

        if (slotsDisponiveis.length > 0) {
            horariosContainer.innerHTML = slotsDisponiveis.map(horario =>
                `<button class=\"btn-horario\">${horario}</button>`
            ).join(\'\');
        } else {
            let proximaDataDisponivel = null;
            proximaDataDisponivel = await encontrarPrimeiraDataComSlots(
                empresaId,
                profissionalSelecionado
            );
            if (proximaDataDisponivel) {
                document.getElementById(\'data-agendamento\').value = proximaDataDisponivel;
                agendamentoState.data = proximaDataDisponivel;
                horariosContainer.innerHTML = `<p>Não há horários disponíveis para este dia.<br>Veja o próximo dia disponível: <strong>${new Date(proximaDataDisponivel).toLocaleDateString()}</strong></p>`;
                setTimeout(() => {
                    document.getElementById(\'data-agendamento\').dispatchEvent(new Event(\'change\'));
                }, 500);
            } else {
                horariosContainer.innerHTML = `<p>Não há horários disponíveis nos próximos dias.</p>`;
            }
        }
    });

    document.getElementById(\'grade-horarios\')?.addEventListener(\'click\', (e) => {
        if (e.target.classList.contains(\'btn-horario\')) {
            document.querySelectorAll(\.btn-horario.selecionado\').forEach(btn => btn.classList.remove(\'selecionado\'));
            e.target.classList.add(\'selecionado\');
            agendamentoState.horario = e.target.textContent;
            updateConfirmButtonState();
        }
    });

    document.getElementById(\'btn-confirmar-agendamento\')?.addEventListener(\'click\', async () => {
        if (typeof currentUser === "undefined" || !currentUser) {
            showAlert("Atenção", "Você precisa fazer login para agendar.");
            return;
        }
        const btn = document.getElementById(\'btn-confirmar-agendamento\');
        btn.disabled = true;
        let confirmado = false;
        confirmado = await showCustomConfirm(
            "Confirmar Agendamento",
            `Deseja agendar \"${agendamentoState.servico.nome}\" com ${agendamentoState.profissional.nome} para ${new Date(agendamentoState.data + \'T00:00:00\').toLocaleDateString()} às ${agendamentoState.horario}?`
        );
        if (confirmado && typeof salvarAgendamento === "function") {
            await salvarAgendamento(empresaId, currentUser, agendamentoState);
        } else {
            btn.disabled = false;
        }
    });

    document.getElementById(\'botoes-agendamento\')?.addEventListener(\'click\', (e) => {
        if (e.target.classList.contains(\'btn-toggle\') && typeof currentUser !== "undefined" && currentUser) {
            document.querySelector(\.btn-toggle.ativo\').classList.remove(\'ativo\');
            e.target.classList.add(\'ativo\');
            const modo = e.target.id === \'btn-ver-ativos\' ? \'ativos\' : \'historico\';
            if (typeof buscarEExibirAgendamentos === "function") {
                buscarEExibirAgendamentos(empresaId, currentUser, modo);
            }
        }
    });

    document.getElementById(\'lista-agendamentos-visualizacao\')?.addEventListener(\'click\', async (e) => {
        if (e.target.classList.contains(\'btn-cancelar\')) {
            const agendamentoId = e.target.dataset.id;
            let confirmado = false;
            confirmado = await showCustomConfirm(
                "Cancelar Agendamento",
                "Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita."
            );
            if (confirmado && typeof cancelarAgendamento === "function") {
                await cancelarAgendamento(empresaId, agendamentoId, () => {
                    if (typeof buscarEExibirAgendamentos === "function") {
                        buscarEExibirAgendamentos(empresaId, currentUser, \'ativos\');
                    }
                    document.querySelector(\'#btn-ver-historico\').classList.remove(\'ativo\');
                    document.querySelector(\'#btn-ver-ativos\').classList.add(\'ativo\');
                });
            }
        }
    });
}

// Inicia a aplicação quando o HTML estiver pronto
document.addEventListener(\'DOMContentLoaded\', init);
