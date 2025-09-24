// ======================================================================
//          VITRINE.JS - O Maestro da Aplicação
//      Responsabilidade: Orquestrar o estado, os dados, a UI
//      e as interações do utilizador na página da vitrine.
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

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);
        // MULTIEMPRESA: empresaId da vitrine obtido SEMPRE da URL
        const empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("ID da Empresa não encontrado na URL.");

        // Carrega os dados essenciais em paralelo para um carregamento mais rápido
        const [dados, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId), getProfissionaisDaEmpresa(empresaId), getTodosServicosDaEmpresa(empresaId)
        ]);

        if (!dados) throw new Error("Empresa não encontrada.");
        
        // Armazena os dados no estado central da aplicação
        setEmpresa(empresaId, dados);
        setProfissionais(profissionais);
        setTodosOsServicos(todosServicos);
        
        // --- PROMOÇÕES: Buscar e aplicar promoções antes do render da UI ---
        await aplicarPromocoesNaVitrine(state.todosOsServicos, empresaId);

        // Renderiza a interface inicial com os dados carregados
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

// --- FUNÇÕES PARA PROMOÇÕES NA VITRINE ---
async function aplicarPromocoesNaVitrine(listaServicos, empresaId) {
    if (!empresaId) return;

    const promocoesRef = collection(db, "empresarios", empresaId, "precos_especiais");
    const snapshot = await getDocs(promocoesRef);

    const promocoesAtivas = [];
    const hoje = new Date().getDay();

    snapshot.forEach(doc => {
        const promo = doc.data();
        if (promo.ativo && promo.diasSemana && promo.diasSemana.includes(hoje)) {
            promocoesAtivas.push({ id: doc.id, ...promo });
        }
    });

    // Adicione um log para depuração
    console.log("Promoções ativas para hoje:", promocoesAtivas);

    listaServicos.forEach(servico => {
        let melhorPromocao = null;
        // 1. Promo específica para o serviço
        for (let promo of promocoesAtivas) {
            if (Array.isArray(promo.servicoIds) && promo.servicoIds.includes(servico.id)) {
                melhorPromocao = promo;
                break;
            }
        }
        // 2. Promoção para todos os serviços (servicoIds null, undefined ou array vazio)
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
            // Log para debug
            console.log(`Promo aplicada ao serviço ${servico.nome}:`, servico.promocao);
        }
    });
}

// --- CONFIGURAÇÃO DE EVENTOS ---
function configurarEventosGerais() {
    // Função auxiliar para adicionar listeners de forma segura, evitando erros se um elemento não existir
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

// --- HANDLERS ---

/** Lida com a mudança de estado do utilizador (login/logout). */
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

/** Lida com o clique nos botões do menu para trocar de aba. */
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

/** Lida com a seleção de um profissional. */
async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;

    resetarAgendamento();
    UI.limparSelecao('servico'); UI.limparSelecao('horario'); UI.desabilitarBotaoConfirmar();
    UI.mostrarContainerForm(false); UI.renderizarServicos([]); UI.renderizarHorarios([]);
    
    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    UI.selecionarCard('profissional', profissionalId, true); // Mostra o feedback de carregamento

    try {
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional);
        
        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId => state.todosOsServicos.find(servico => servico.id === servicoId)).filter(Boolean);

        // --- AGRUPAMENTO POR CATEGORIA ---
        UI.mostrarContainerForm(true);
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos); // <-- O agrupamento deve ser feito dentro desta função do UI!
        UI.configurarModoAgendamento(permiteMultiplos);

    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        await UI.mostrarAlerta("Erro", "Não foi possível carregar os dados deste profissional.");
    } finally {
        UI.selecionarCard('profissional', profissionalId, false); // Remove o feedback de carregamento
    }
}

/** Lida com a seleção de um ou mais serviços. */
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
        // Lógica de MÚLTIPLA seleção (adiciona ou remove)
        const index = servicosAtuais.findIndex(s => s.id === servicoId);
        if (index > -1) {
            servicosAtuais.splice(index, 1);
        } else {
            servicosAtuais.push(servicoSelecionado);
        }
        card.classList.toggle('selecionado');
    } else {
        // Lógica de ÚNICA seleção (substitui)
        servicosAtuais = [servicoSelecionado];
        UI.selecionarCard('servico', servicoId);
    }

    setAgendamento('servicos', servicosAtuais);
    
    // Reseta os passos seguintes
    setAgendamento('data', null);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();
    
    // Se for modo múltiplo, atualiza o resumo. Se for único, avança direto.
    if (permiteMultiplos) {
        UI.atualizarResumoAgendamento(servicosAtuais);
    } else {
        document.getElementById('data-e-horario-container').style.display = 'block';
        if (servicosAtuais.length > 0) {
            await buscarPrimeiraDataDisponivel();
        }
    }
}

/** Lida com o clique no botão "Escolher Data e Horário" no modo de múltiplos serviços. */
async function handleProsseguirDataClick() {
    const servicos = state.agendamento.servicos;
    if (!servicos || servicos.length === 0) {
        await UI.mostrarAlerta("Atenção", "Selecione pelo menos um serviço para continuar.");
        return;
    }
    document.getElementById('data-e-horario-container').style.display = 'block';
    await buscarPrimeiraDataDisponivel();
}

/** Função auxiliar para buscar a primeira data com vagas. */
async function buscarPrimeiraDataDisponivel() {
    UI.atualizarStatusData(true, 'A procurar a data mais próxima com vagas...');
    const duracaoTotal = state.agendamento.servicos.reduce((total, s) => total + s.duracao, 0);
    try {
        const primeiraData = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional, duracaoTotal);
        const dataInput = document.getElementById('data-agendamento');
        if (primeiraData) {
            dataInput.value = primeiraData;
            dataInput.disabled = false;
            dataInput.dispatchEvent(new Event('change')); // Dispara o evento para carregar os horários
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

/** Lida com a mudança de data no seletor. */
async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();
    
    // **LÓGICA UNIFICADA:** Lê sempre de 'servicos', eliminando a necessidade de 'servico' (singular).
    const { profissional, servicos, data } = state.agendamento;
    
    // Calcula a duração total a partir do array 'servicos'
    const duracaoTotal = servicos.reduce((total, s) => total + s.duracao, 0);

    if (!profissional || duracaoTotal === 0 || !data) return;

    UI.renderizarHorarios([], 'A calcular horários...');
    try {
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);
        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, duracaoTotal);
        UI.renderizarHorarios(slots);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        UI.renderizarHorarios([], 'Erro ao carregar horários. Tente outra data.');
    }
}

/** Lida com a seleção de um horário. */
function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn || btn.disabled) return;
    setAgendamento('horario', btn.dataset.horario);
    UI.selecionarCard('horario', btn.dataset.horario);
    UI.atualizarResumoAgendamentoFinal(); // MOSTRA O RESUMO EMBAIXO
    UI.habilitarBotaoConfirmar();         // HABILITA O BOTÃO
}

/** Lida com a confirmação final do agendamento. */
async function handleConfirmarAgendamento() {
    if (!state.currentUser) {
        await UI.mostrarAlerta("Login Necessário", "Você precisa de fazer login para confirmar o agendamento.");
        if (UI.abrirModalLogin) UI.abrirModalLogin(); 
        return;
    }

    // **LÓGICA UNIFICADA:** Lê sempre de 'servicos'.
    const { profissional, servicos, data, horario } = state.agendamento;
    
    if (!profissional || !servicos || servicos.length === 0 || !data || !horario) {
        await UI.mostrarAlerta("Informação Incompleta", "Por favor, selecione profissional, serviço(s), data e horário.");
        return;
    }

    const btn = document.getElementById('btn-confirmar-agendamento');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'A agendar...';
    try {
        // A lógica de criar um "serviço combinado" agora é a única forma de salvar.
        // Funciona para 1 ou mais serviços.
        const servicoParaSalvar = {
            id: servicos.map(s => s.id).join(','),
            nome: servicos.map(s => s.nome).join(' + '),
            duracao: servicos.reduce((total, s) => total + s.duracao, 0),
            preco: servicos.reduce((total, s) => total + s.preco, 0)
        };

        // Prepara o objeto final para salvar, garantindo que ele tenha a propriedade 'servico' (combinado).
        const agendamentoParaSalvar = { 
            profissional: state.agendamento.profissional,
            data: state.agendamento.data,
            horario: state.agendamento.horario,
            servico: servicoParaSalvar // Apenas o serviço combinado é salvo
        };

        await salvarAgendamento(state.empresaId, state.currentUser, agendamentoParaSalvar);
        
        const nomeEmpresa = state.dadosEmpresa.nomeFantasia || "A empresa";
        await UI.mostrarAlerta("Agendamento Confirmado!", `${nomeEmpresa} agradece pelo seu agendamento.`);
        resetarAgendamento();
        handleMenuClick({ target: document.querySelector('[data-menu="visualizacao"]') });
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        await UI.mostrarAlerta("Erro", `Não foi possível confirmar o agendamento. ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

/** Lida com a filtragem de agendamentos (ativos vs. histórico). */
async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle') || !state.currentUser) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
    UI.selecionarFiltro(modo);
    UI.renderizarAgendamentosComoCards([], 'A buscar agendamentos...');
    try {
        const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
        UI.renderizarAgendamentosComoCards(agendamentos, modo);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        await UI.mostrarAlerta("Erro de Busca", "Ocorreu um erro ao buscar os seus agendamentos.");
        UI.renderizarAgendamentosComoCards([], 'Não foi possível carregar os seus agendamentos.');
    }
}

/** Lida com o clique para cancelar um agendamento. */
async function handleCancelarClick(e) {
    const btnCancelar = e.target.closest('.btn-cancelar');
    if (btnCancelar) {
        const agendamentoId = btnCancelar.dataset.id;
        const confirmou = await UI.mostrarConfirmacao("Cancelar Agendamento", "Tem a certeza de que deseja cancelar este agendamento? Esta ação não pode ser desfeita.");
        if (confirmou) {
            btnCancelar.disabled = true;
            btnCancelar.textContent = "A cancelar...";
            try {
                await cancelarAgendamento(state.empresaId, agendamentoId);
                await UI.mostrarAlerta("Sucesso", "Agendamento cancelado com sucesso!");
                handleFiltroAgendamentos({ target: document.querySelector('#botoes-agendamento .btn-toggle.ativo') });
            } catch (error) {
                console.error("Erro ao cancelar agendamento:", error);
                await UI.mostrarAlerta("Erro", `Não foi possível cancelar o agendamento. ${error.message}`);
                btnCancelar.disabled = false;
                btnCancelar.textContent = "Cancelar";
            }
        }
    }
}
