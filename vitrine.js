// ======================================================================
//          VITRINE.JS - O Maestro da Aplicação
// ✅ CORREÇÃO FOCADA: Garante que a empresa da URL seja sempre a correta,
//    evitando o bug de carregamento de dados errados no celular.
// ======================================================================

// --- MÓDulos IMPORTADOS ---
import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, salvarAgendamento, buscarAgendamentosDoCliente, cancelarAgendamento, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import * as UI from './vitrini-ui.js';

// --- IMPORTS PARA PROMOÇÕES ---
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Função utilitária para corrigir data no formato brasileiro ou ISO ---
function parseDataISO(dateStr ) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        return new Date(dateStr + "T00:00:00");
    }
    if (dateStr.includes('/')) {
        const [dia, mes, ano] = dateStr.split('/');
        return new Date(`${ano}-${mes}-${dia}T00:00:00`);
    }
    return new Date(dateStr);
}

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);

        // ✅ --- LÓGICA DE INICIALIZAÇÃO REFORÇADA ---
        // 1. Limpa qualquer estado de agendamento anterior para evitar contaminação de dados.
        resetarAgendamento();

        // 2. Pega o ID da empresa da URL. Esta é a única fonte da verdade.
        const empresaId = getEmpresaIdFromURL();
        if (!empresaId) {
            throw new Error("ID da Empresa não encontrado na URL.");
        }

        // 3. FORÇA a atualização do localStorage.
        //    Isso garante que qualquer outra parte do código que, por ventura,
        //    leia o localStorage, pegue o ID correto desta sessão, e não um valor antigo.
        localStorage.setItem("empresaAtivaId", empresaId);
        // ✅ --- FIM DA LÓGICA REFORÇADA ---

        const [dados, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId),
            getProfissionaisDaEmpresa(empresaId),
            getTodosServicosDaEmpresa(empresaId)
        ]);

        if (!dados) throw new Error("Empresa não encontrada.");

        setEmpresa(empresaId, dados);
        setProfissionais(profissionais);
        setTodosOsServicos(todosServicos);

        await aplicarPromocoesNaVitrine(state.todosOsServicos, empresaId, null, true);

        UI.renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos);
        UI.renderizarProfissionais(state.listaProfissionais);

        configurarEventosGerais();
        setupAuthListener(handleUserAuthStateChange);
        UI.toggleLoader(false);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error.stack);
        document.getElementById("vitrine-loader").innerHTML = `<p style="text-align: center; color:red; padding: 20px;">${error.message}</p>`;
    }
});

// --- O RESTANTE DO SEU CÓDIGO ORIGINAL PERMANECE EXATAMENTE IGUAL ---
// ... (todas as outras funções, como aplicarPromocoesNaVitrine, handleConfirmarAgendamento, etc., estão intactas)

async function aplicarPromocoesNaVitrine(listaServicos, empresaId, dataSelecionadaISO = null, forceNoPromo = false) {
    if (!empresaId) return;
    listaServicos.forEach(s => { s.promocao = null; });
    if (forceNoPromo) return;
    if (!dataSelecionadaISO) return;
    const data = parseDataISO(dataSelecionadaISO);
    if (!data || isNaN(data.getTime())) return;
    const diaSemana = data.getDay();
    const promocoesRef = collection(db, "empresarios", empresaId, "precos_especiais");
    const snapshot = await getDocs(promocoesRef);
    const promocoesAtivas = [];
    snapshot.forEach(doc => {
        const promo = doc.data();
        let dias = Array.isArray(promo.diasSemana) ? promo.diasSemana.map(Number) : [];
        if (promo.ativo && dias.includes(diaSemana)) {
            promocoesAtivas.push({ id: doc.id, ...promo });
        }
    });
    listaServicos.forEach(servico => {
        let melhorPromocao = null;
        for (let promo of promocoesAtivas) {
            if (Array.isArray(promo.servicoIds) && promo.servicoIds.includes(servico.id)) {
                melhorPromocao = promo;
                break;
            }
        }
        if (!melhorPromocao) {
            melhorPromocao = promocoesAtivas.find(
                promo => promo.servicoIds == null || (Array.isArray(promo.servicoIds) && promo.servicoIds.length === 0)
            );
        }
        if (melhorPromocao) {
            let precoAntigo = servico.preco;
            let precoNovo = precoAntigo;
            if (melhorPromocao.tipoDesconto === "percentual") {
                precoNovo = precoAntigo * (1 - melhorPromocao.valor / 100);
            } else if (melhorPromocao.tipoDesconto === "valorFixo") {
                precoNovo = Math.max(precoAntigo - melhorPromocao.valor, 0);
            }
            servico.promocao = {
                nome: melhorPromocao.nome,
                precoOriginal: precoAntigo,
                precoComDesconto: precoNovo,
                tipoDesconto: melhorPromocao.tipoDesconto,
                valorDesconto: melhorPromocao.valor
            };
        }
    });
}
function configurarEventosGerais() {
    const addSafeListener = (selector, event, handler, isQuerySelector = false) => {
        const element = isQuerySelector ? document.querySelector(selector) : document.getElementById(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    };
    addSafeListener('.sidebar-menu', 'click', handleMenuClick, true);
    addSafeListener('.bottom-nav-vitrine', 'click', handleMenuClick, true);
    addSafeListener('lista-profissionais', 'click', handleProfissionalClick);
    addSafeListener('lista-servicos', 'click', handleServicoClick);
    addSafeListener('btn-prosseguir-data', 'click', handleProsseguirDataClick);
    addSafeListener('data-agendamento', 'change', handleDataChange);
    addSafeListener('grade-horarios', 'click', handleHorarioClick);
    addSafeListener('btn-login', 'click', fazerLogin);
    addSafeListener('modal-auth-btn-google', 'click', fazerLogin);
    addSafeListener('btn-logout', 'click', fazerLogout);
    addSafeListener('btn-confirmar-agendamento', 'click', handleConfirmarAgendamento);
    addSafeListener('botoes-agendamento', 'click', handleFiltroAgendamentos);
    addSafeListener('lista-agendamentos-visualizacao', 'click', handleCancelarClick);
}
function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    UI.toggleAgendamentoLoginPrompt(!user);
    if (user) {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        }
    } else {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
        }
    }
}
function handleMenuClick(e) {
    const menuButton = e.target.closest('[data-menu]');
    if (menuButton) {
        const menuKey = menuButton.getAttribute('data-menu');
        UI.trocarAba(`menu-${menuKey}`);
        if (menuKey === 'visualizacao') {
            if (state.currentUser) {
                handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
            } else {
                if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
            }
        }
    }
}
async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;
    resetarAgendamento();
    UI.limparSelecao('servico'); UI.limparSelecao('horario'); UI.desabilitarBotaoConfirmar();
    UI.mostrarContainerForm(false); UI.renderizarServicos([]); UI.renderizarHorarios([]);
    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    UI.selecionarCard('profissional', profissionalId, true);
    try {
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional);
        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId => state.todosOsServicos.find(servico => servico.id === servicoId)).filter(Boolean);
        UI.mostrarContainerForm(true);
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos);
        UI.configurarModoAgendamento(permiteMultiplos);
    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        await UI.mostrarAlerta("Erro", "Não foi possível carregar os dados deste profissional.");
    } finally {
        UI.selecionarCard('profissional', profissionalId, false);
    }
}
async function handleServicoClick(e) {
    const card = e.target.closest('.card-servico');
    if (!card) return;
    if (!state.agendamento.profissional) {
        await UI.mostrarAlerta("Atenção", "Por favor, selecione um profissional antes de escolher um serviço.");
        return;
    }
    const permiteMultiplos = state.agendamento.profissional.horarios?.permitirAgendamentoMultiplo || false;
    const servicoId = card.dataset.id;
    const servicoSelecionado = state.todosOsServicos.find(s => s.id === servicoId);
    let servicosAtuais = [...state.agendamento.servicos];
    if (permiteMultiplos) {
        const index = servicosAtuais.findIndex(s => s.id === servicoId);
        if (index > -1) {
            servicosAtuais.splice(index, 1);
        } else {
            servicosAtuais.push(servicoSelecionado);
        }
        card.classList.toggle('selecionado');
    } else {
        servicosAtuais = [servicoSelecionado];
        UI.selecionarCard('servico', servicoId);
    }
    setAgendamento('servicos', servicosAtuais);
    setAgendamento('data', null);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();
    if (permiteMultiplos) {
        UI.atualizarResumoAgendamento(servicosAtuais);
    } else {
        document.getElementById('data-e-horario-container').style.display = 'block';
        if (servicosAtuais.length > 0) {
            await buscarPrimeiraDataDisponivel();
        }
    }
}
async function handleProsseguirDataClick() {
    const servicos = state.agendamento.servicos;
    if (!servicos || servicos.length === 0) {
        await UI.mostrarAlerta("Atenção", "Selecione pelo menos um serviço para continuar.");
        return;
    }
    document.getElementById('data-e-horario-container').style.display = 'block';
    await buscarPrimeiraDataDisponivel();
}
async function buscarPrimeiraDataDisponivel() {
    UI.atualizarStatusData(true, 'A procurar a data mais próxima com vagas...');
    const duracaoTotal = state.agendamento.servicos.reduce((total, s) => total + s.duracao, 0);
    try {
        const primeiraData = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional, duracaoTotal);
        const dataInput = document.getElementById('data-agendamento');
        if (primeiraData) {
            dataInput.value = primeiraData;
            dataInput.disabled = false;
            dataInput.dispatchEvent(new Event('change'));
        } else {
            UI.renderizarHorarios([], 'Nenhuma data disponível para os serviços selecionados nos próximos 3 meses.');
            UI.atualizarStatusData(false);
        }
    } catch(error) {
        console.error("Erro ao encontrar data disponível:", error);
        await UI.mostrarAlerta("Erro", "Ocorreu um problema ao verificar a disponibilidade.");
        UI.atualizarStatusData(false);
    }
}
async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();
    const { profissional, servicos, data } = state.agendamento;
    const duracaoTotal = servicos.reduce((total, s) => total + s.duracao, 0);
    await aplicarPromocoesNaVitrine(state.todosOsServicos, state.empresaId, data, false);
    if (profissional) {
        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId => state.todosOsServicos.find(servico => servico.id === servicoId)).filter(Boolean);
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos);
        state.agendamento.servicos.forEach(s => UI.selecionarCard('servico', s.id));
        if (permiteMultiplos) {
            UI.atualizarResumoAgendamento(state.agendamento.servicos);
        }
    }
    if (!profissional || duracaoTotal === 0 || !data) return;
    UI.renderizarHorarios([], 'A calcular horários...');
    try {
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);
        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios,
