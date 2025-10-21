// ======================================================================
//        VITRINE.JS - O Maestro da Aplicação (REVISADO E CORRIGIDO)
// ======================================================================

// --- MÓDulos IMPORTADOS ---
import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, salvarAgendamento, buscarAgendamentosDoCliente, cancelarAgendamento, encontrarPrimeiraDataComSlots } from './vitrini-agendamento.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import * as UI from './vitrini-ui.js';

// --- IMPORTS PARA PROMOÇÕES ---
import { db } from './vitrini-firebase.js';
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
// =====================================================================
// ✅ 1. IMPORTAÇÃO NECESSÁRIA ADICIONADA (SE JÁ NÃO ESTIVER LÁ)
// =====================================================================
import { marcarServicosInclusosParaUsuario } from './vitrine-assinatura-integration.js';


// --- Função utilitária para corrigir data no formato brasileiro ou ISO (LÓGICA 100% PRESERVADA ) ---
function parseDataISO(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        // Assume YYYY-MM-DD
        return new Date(dateStr + "T00:00:00"); // Adiciona T00:00:00 para evitar problemas de fuso horário
    }
    if (dateStr.includes('/')) {
        // Assume DD/MM/YYYY
        const [dia, mes, ano] = dateStr.split('/');
        return new Date(`${ano}-${mes}-${dia}T00:00:00`);
    }
    // Tenta parsear como fallback, mas pode não ser confiável
    return new Date(dateStr);
}

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);

        const params = new URLSearchParams(window.location.search);
        let empresaId = params.get('empresa');
        
        // Pega o caminho da URL (ex: "/givas-salao-2") e remove a primeira barra.
        const slug = window.location.pathname.substring(1);

        if (!empresaId && slug && slug !== 'vitrine.html' && slug !== 'index.html' && !slug.startsWith('r.html')) {
            console.log(`[Vitrine] ID não encontrado. Buscando empresa pelo slug: ${slug}`);
            
            // Busca no Firestore pelo slug
            const q = query(collection(db, "empresarios"), where("slug", "==", slug), limit(1));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                empresaId = snapshot.docs[0].id;
                console.log(`[Vitrine] Empresa encontrada pelo slug. ID: ${empresaId}`);
            }
        }

        if (!empresaId) {
            empresaId = getEmpresaIdFromURL(); // Função sua, que busca do localStorage ou URL
            if (!empresaId) {
                throw new Error("ID da Empresa não pôde ser determinado a partir da URL.");
            }
        }

        // --- BUSCA OS DADOS INICIAIS (LÓGICA ORIGINAL) ---
        const [dados, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId),
            getProfissionaisDaEmpresa(empresaId),
            getTodosServicosDaEmpresa(empresaId)
        ]);

        if (!dados) {
            throw new Error("Empresa não encontrada.");
        }

        setEmpresa(empresaId, dados);
        setProfissionais(profissionais);
        setTodosOsServicos(todosServicos);

        // --- APLICA PROMOÇÕES E MARCA SERVIÇOS INCLUSOS ---
        await aplicarPromocoesNaVitrine(state.todosOsServicos, empresaId, null, true); // Aplica promoções (sem data inicialmente)

        // Tenta marcar serviços inclusos ANTES de renderizar pela primeira vez
        try {
            await marcarServicosInclusosParaUsuario(state.todosOsServicos, empresaId);
        } catch(err){
            console.info("Não foi possível verificar assinatura na carga inicial:", err.message);
        }

        // --- RENDERIZA A INTERFACE ---
        UI.renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos);
        UI.renderizarProfissionais(state.listaProfissionais);

        // Renderiza planos (sua lógica original)
        await renderizarPlanosDeAssinatura(empresaId);

        configurarEventosGerais();
        setupAuthListener(handleUserAuthStateChange);
        UI.toggleLoader(false);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error.stack);
        document.getElementById("vitrine-loader").innerHTML = `<p style="text-align: center; color:red; padding: 20px;">${error.message}</p>`;
    }
});

// --- FUNÇÃO DE APLICAR PROMOÇÕES (SUA ORIGINAL, INALTERADA) ---
async function aplicarPromocoesNaVitrine(listaServicos, empresaId, dataSelecionadaISO = null, forceNoPromo = false) {
    if (!empresaId) return;
    listaServicos.forEach(s => { s.promocao = null; }); // Limpa promoções anteriores
    if (forceNoPromo || !dataSelecionadaISO) return; // Se não tem data, não aplica

    const data = parseDataISO(dataSelecionadaISO);
    if (!data || isNaN(data.getTime())) return;
    const diaSemana = data.getDay(); // 0 = Domingo, 1 = Segunda, ...

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
        // Prioridade: Promoção específica para o serviço
        for (let promo of promocoesAtivas) {
            if (Array.isArray(promo.servicoIds) && promo.servicoIds.includes(servico.id)) {
                melhorPromocao = promo;
                break;
            }
        }
        // Fallback: Promoção geral (sem serviços especificados)
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
                precoNovo = Math.max(precoAntigo - melhorPromocao.valor, 0); // Garante que não seja negativo
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

// --- FUNÇÃO PARA RENDERIZAR PLANOS (SUA ORIGINAL, INALTERADA) ---
async function renderizarPlanosDeAssinatura(empresaId) {
    // ... SUA LÓGICA ORIGINAL AQUI ...
    const planosDiv = document.getElementById('lista-de-planos'); // Certifique-se que esse ID existe no HTML
    if (!planosDiv) {
        console.warn("Elemento 'lista-de-planos' não encontrado para renderizar planos.");
        return;
    }
    planosDiv.innerHTML = '<p style="text-align: center;">Carregando planos...</p>';
    try {
        const planosRef = collection(db, `empresarios/${empresaId}/planosDeAssinatura`);
        const snapshot = await getDocs(planosRef);
        if (snapshot.empty) {
            planosDiv.innerHTML = '<p>Nenhum plano disponível no momento.</p>';
            return;
        }
        planosDiv.innerHTML = '';
        snapshot.forEach(doc => {
            const plano = doc.data();
            const planoId = doc.id;
            if (plano.ativo) {
                const precoFormatado = (plano.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const servicosHTML = Array.isArray(plano.servicosInclusos)
                    ? plano.servicosInclusos.map(s => `<li>${s.quantidade}x ${s.nomeServico}</li>`).join('')
                    : '';
                const card = document.createElement('div');
                card.className = 'card-plano-vitrine';
                card.style = 'background:#fff;border-radius:14px;box-shadow:0 4px 18px rgba(99,102,241,0.06);margin:18px 0;padding:22px;text-align:center;color:#333;'; // Adicionado color: #333
                card.innerHTML = `
                    <h3 style="color:#4f46e5;">${plano.nome}</h3>
                    <p class="preco" style="color:#6366f1;font-weight:bold;font-size:1.2em;">${precoFormatado} / mês</p>
                    <p>${plano.descricao || ''}</p>
                    <ul style="list-style: '✓ ';padding-left: 20px; text-align: left;">${servicosHTML}</ul>
                    <button class="btn-assinar-plano" style="background:linear-gradient(90deg,#6366f1 0%,#4f46e5 100%);color:#fff;border:none;border-radius:8px;padding:8px 22px;margin-top:14px;font-size:1em;cursor:pointer;">Assinar</button>
                `;
                card.querySelector('.btn-assinar-plano').addEventListener('click', () => {
                    window.location.href = `vitrine-assinatura.html?empresaId=${empresaId}&planoId=${planoId}`;
                });
                planosDiv.appendChild(card);
            }
        });
    } catch (err) {
        console.error("Erro ao carregar planos de assinatura:", err);
        planosDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar os planos.</p>';
    }
}

// --- FUNÇÃO DE CONFIGURAR EVENTOS (SUA ORIGINAL, INALTERADA) ---
function configurarEventosGerais() {
    const addSafeListener = (selector, event, handler, isQuerySelector = false) => {
        const element = isQuerySelector ? document.querySelector(selector) : document.getElementById(selector);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            // Aviso opcional se um elemento esperado não for encontrado
            // console.warn(`Elemento não encontrado para o listener: ${selector}`);
        }
    };
    // Adiciona listeners para os elementos principais da UI
    addSafeListener('.sidebar-menu', 'click', handleMenuClick, true);
    addSafeListener('.bottom-nav-vitrine', 'click', handleMenuClick, true);
    addSafeListener('lista-profissionais', 'click', handleProfissionalClick);
    addSafeListener('lista-servicos', 'click', handleServicoClick);
    addSafeListener('btn-prosseguir-data', 'click', handleProsseguirDataClick);
    addSafeListener('data-agendamento', 'change', handleDataChange);
    addSafeListener('grade-horarios', 'click', handleHorarioClick);
    addSafeListener('btn-login', 'click', fazerLogin); // Botão dentro do menu perfil
    addSafeListener('modal-auth-btn-google', 'click', fazerLogin); // Botão Google no modal
    addSafeListener('btn-logout', 'click', fazerLogout); // Botão Sair dentro do menu perfil
    addSafeListener('btn-confirmar-agendamento', 'click', handleConfirmarAgendamento);
    addSafeListener('botoes-agendamento', 'click', handleFiltroAgendamentos);
    addSafeListener('lista-agendamentos-visualizacao', 'click', handleCancelarClick);
}

// --- FUNÇÃO DE MUDANÇA DE ESTADO AUTH (SUA ORIGINAL, INALTERADA) ---
function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    UI.toggleAgendamentoLoginPrompt(!user);

    // Se o usuário logou, tenta atualizar a lista de serviços com dados da assinatura
    if (user && state.empresaId) {
        (async () => {
            try {
                await marcarServicosInclusosParaUsuario(state.todosOsServicos, state.empresaId);
                // Re-renderiza a lista de serviços se ela estiver visível
                if (document.getElementById('lista-servicos')?.offsetParent !== null) {
                   UI.renderizarServicos(state.todosOsServicos.filter(s => state.agendamento?.profissional?.servicos?.includes(s.id)), state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo);
                   // Re-seleciona os serviços que já estavam marcados
                   state.agendamento?.servicos?.forEach(s => UI.selecionarCard('servico', s.id));
                   // Atualiza o resumo
                   if(state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo) {
                      UI.atualizarResumoAgendamento(state.agendamento.servicos);
                   } else {
                      UI.atualizarResumoAgendamentoFinal(); // Atualiza resumo final se não for múltiplo
                   }
                }
            } catch (err) {
                 console.info("Não foi possível verificar assinatura após login:", err.message);
            }
        })();
    } else if (!user && state.empresaId) {
        // Se deslogou, remove a marcação de assinatura e re-renderiza
        state.todosOsServicos.forEach(s => {
            s.inclusoAssinatura = false;
            s.precoCobrado = undefined; // Ou null, dependendo da sua preferência
            s.assinaturasCandidatas = undefined;
        });
         if (document.getElementById('lista-servicos')?.offsetParent !== null) {
             UI.renderizarServicos(state.todosOsServicos.filter(s => state.agendamento?.profissional?.servicos?.includes(s.id)), state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo);
             state.agendamento?.servicos?.forEach(s => UI.selecionarCard('servico', s.id)); // Re-seleciona
             if(state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo) {
                UI.atualizarResumoAgendamento(state.agendamento.servicos);
             } else {
                UI.atualizarResumoAgendamentoFinal();
             }
        }
    }


    if (user) {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) { // Checa se a aba está visível
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') }); // Recarrega agendamentos
        }
    } else {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos(); // Mostra msg de login
        }
    }
}

// --- FUNÇÃO DE CLIQUE NO MENU (SUA ORIGINAL, INALTERADA) ---
function handleMenuClick(e) {
    const menuButton = e.target.closest('[data-menu]');
    if (menuButton) {
        const menuKey = menuButton.getAttribute('data-menu');
        UI.trocarAba(`menu-${menuKey}`); // Chama a função UI para trocar a aba
        if (menuKey === 'visualizacao') {
            if (state.currentUser) {
                // Dispara o clique no botão "Ver Ativos" para carregar os agendamentos
                handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
            } else {
                // Mostra a mensagem pedindo login
                if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
            }
        }
    }
}

// --- FUNÇÃO DE CLIQUE NO PROFISSIONAL (SUA ORIGINAL, INALTERADA) ---
async function handleProfissionalClick(e) {
    const card = e.target.closest('.card-profissional');
    if (!card) return;

    resetarAgendamento(); // Limpa estado anterior
    UI.limparSelecao('servico'); UI.limparSelecao('horario'); UI.desabilitarBotaoConfirmar();
    UI.mostrarContainerForm(false); UI.renderizarServicos([]); UI.renderizarHorarios([]);

    const profissionalId = card.dataset.id;
    const profissional = state.listaProfissionais.find(p => p.id === profissionalId);
    UI.selecionarCard('profissional', profissionalId, true); // Marca como carregando

    try {
        // Busca horários do profissional (cache ou Firestore)
        profissional.horarios = await getHorariosDoProfissional(state.empresaId, profissionalId);
        setAgendamento('profissional', profissional); // Atualiza o estado

        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        // Filtra os serviços que *este* profissional oferece
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId =>
            state.todosOsServicos.find(servico => servico.id === servicoId)
        ).filter(Boolean); // Remove nulos se algum ID não for encontrado

        // Tenta marcar serviços inclusos DEPOIS de filtrar os do profissional
         try {
            await marcarServicosInclusosParaUsuario(servicosDoProfissional, state.empresaId);
         } catch(err){
             console.info("Não foi possível verificar assinatura ao selecionar profissional:", err.message);
         }


        UI.mostrarContainerForm(true); // Mostra a seção de serviços/data/hora
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos);
        UI.configurarModoAgendamento(permiteMultiplos); // Ajusta UI para seleção única/múltipla

    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        await UI.mostrarAlerta("Erro", "Não foi possível carregar os dados deste profissional.");
    } finally {
        UI.selecionarCard('profissional', profissionalId, false); // Remove marca de carregando
    }
}

// --- FUNÇÃO DE CLIQUE NO SERVIÇO (SUA ORIGINAL, INALTERADA) ---
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

    let servicosAtuais = [...state.agendamento.servicos]; // Cria cópia

    if (permiteMultiplos) {
        const index = servicosAtuais.findIndex(s => s.id === servicoId);
        if (index > -1) {
            servicosAtuais.splice(index, 1); // Remove se já selecionado
        } else {
            servicosAtuais.push(servicoSelecionado); // Adiciona se não selecionado
        }
        card.classList.toggle('selecionado'); // Alterna visualmente
    } else {
        servicosAtuais = [servicoSelecionado]; // Substitui seleção
        UI.selecionarCard('servico', servicoId); // Marca visualmente
    }

    setAgendamento('servicos', servicosAtuais); // Atualiza o estado
    setAgendamento('data', null); // Reseta data/hora
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();

    if (permiteMultiplos) {
        UI.atualizarResumoAgendamento(servicosAtuais); // Mostra resumo/botão prosseguir
    } else {
        // Se for seleção única, já mostra data/hora e busca primeira data
        document.getElementById('data-e-horario-container').style.display = 'block';
        if (servicosAtuais.length > 0) {
            await buscarPrimeiraDataDisponivel();
        }
    }
}

// --- FUNÇÃO BOTÃO PROSSEGUIR (SUA ORIGINAL, INALTERADA) ---
async function handleProsseguirDataClick() {
    const servicos = state.agendamento.servicos;
    if (!servicos || servicos.length === 0) {
        await UI.mostrarAlerta("Atenção", "Selecione pelo menos um serviço para continuar.");
        return;
    }
    document.getElementById('data-e-horario-container').style.display = 'block';
    await buscarPrimeiraDataDisponivel(); // Busca e define a primeira data
}

// --- FUNÇÃO BUSCAR PRIMEIRA DATA (SUA ORIGINAL, INALTERADA) ---
async function buscarPrimeiraDataDisponivel() {
    UI.atualizarStatusData(true, 'A procurar a data mais próxima com vagas...');
    const duracaoTotal = state.agendamento.servicos.reduce((total, s) => total + s.duracao, 0);
    try {
        // Chama a função que busca a data (pode levar tempo)
        const primeiraData = await encontrarPrimeiraDataComSlots(state.empresaId, state.agendamento.profissional, duracaoTotal);
        const dataInput = document.getElementById('data-agendamento');
        if (primeiraData) {
            dataInput.value = primeiraData; // Define a data encontrada
            dataInput.disabled = false;
            dataInput.dispatchEvent(new Event('change')); // Dispara o evento 'change' para carregar horários
        } else {
            // Se não encontrou data, informa o usuário
            UI.renderizarHorarios([], 'Nenhuma data disponível para os serviços selecionados nos próximos 3 meses.');
            UI.atualizarStatusData(false);
        }
    } catch(error) {
        console.error("Erro ao encontrar data disponível:", error);
        await UI.mostrarAlerta("Erro", "Ocorreu um problema ao verificar a disponibilidade.");
        UI.atualizarStatusData(false);
    }
}

// --- FUNÇÃO MUDANÇA DE DATA (SUA ORIGINAL, INALTERADA) ---
async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null); // Reseta horário
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();

    const { profissional, servicos, data } = state.agendamento;
    const duracaoTotal = servicos.reduce((total, s) => total + s.duracao, 0);

    // Reaplica promoções para a data selecionada
    await aplicarPromocoesNaVitrine(state.todosOsServicos, state.empresaId, data, false);

    // Tenta remarcar serviços inclusos (caso o login ocorra após a seleção da data)
     try {
        await marcarServicosInclusosParaUsuario(state.todosOsServicos, state.empresaId);
     } catch(err){
         console.info("Não foi possível verificar assinatura ao mudar data:", err.message);
     }

    // Re-renderiza os serviços (com possíveis preços de promoção atualizados e marcação de assinatura)
    if (profissional) {
        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId =>
            state.todosOsServicos.find(servico => servico.id === servicoId)
        ).filter(Boolean);
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos);
        // Mantém a seleção visual dos serviços
        state.agendamento.servicos.forEach(s => UI.selecionarCard('servico', s.id));
        // Atualiza o resumo
        if (permiteMultiplos) {
            UI.atualizarResumoAgendamento(state.agendamento.servicos);
        } else {
            UI.atualizarResumoAgendamentoFinal(); // Atualiza resumo final se não for múltiplo
        }
    }

    if (!profissional || duracaoTotal === 0 || !data) return; // Precisa de tudo selecionado

    UI.renderizarHorarios([], 'A calcular horários...'); // Feedback de carregamento

    try {
        // Busca agendamentos existentes para o dia
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);
        // Calcula os horários livres
        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, duracaoTotal);
        UI.renderizarHorarios(slots); // Mostra os horários
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        UI.renderizarHorarios([], 'Erro ao carregar horários. Tente outra data.');
    }
}

// --- FUNÇÃO CLIQUE HORÁRIO (SUA ORIGINAL, INALTERADA) ---
function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn || btn.disabled) return; // Ignora se não for botão ou se estiver desabilitado

    setAgendamento('horario', btn.dataset.horario); // Atualiza estado
    UI.selecionarCard('horario', btn.dataset.horario); // Marca visualmente
    UI.atualizarResumoAgendamentoFinal(); // Mostra resumo com todos os detalhes
    UI.habilitarBotaoConfirmar(); // Libera o botão de confirmar
}

// =====================================================================
// ✅ ÚNICA FUNÇÃO ALTERADA NESTE ARQUIVO (PARA CORRIGIR CÁLCULO DO PREÇO)
// =====================================================================
async function handleConfirmarAgendamento() {
    if (!state.currentUser) {
        await UI.mostrarAlerta("Login Necessário", "Você precisa de fazer login para confirmar o agendamento.");
        if (UI.abrirModalLogin) UI.abrirModalLogin();
        return;
    }
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
        // --- INÍCIO DA CORREÇÃO ---
        const precoTotalCalculado = servicos.reduce((total, s) => {
            if (s.precoCobrado === 0) { // Se assinatura cobriu o custo
                return total + 0;
            } else if (s.promocao) { // Se tem promoção ativa para a data
                return total + (s.promocao.precoComDesconto || 0);
            } else { // Preço normal
                return total + (s.preco || 0);
            }
        }, 0);
        // --- FIM DA CORREÇÃO ---

        const servicoParaSalvar = {
            id: servicos.map(s => s.id).join(','),
            nome: servicos.map(s => s.nome).join(' + '),
            duracao: servicos.reduce((total, s) => total + s.duracao, 0),
            preco: precoTotalCalculado // Usa o preço corrigido
        };

        const agendamentoParaSalvar = {
            profissional: state.agendamento.profissional,
            data: state.agendamento.data,
            horario: state.agendamento.horario,
            servico: servicoParaSalvar,
            empresa: state.dadosEmpresa
        };

        await salvarAgendamento(state.empresaId, state.currentUser, agendamentoParaSalvar);
        
        const nomeEmpresa = state.dadosEmpresa.nomeFantasia || "A empresa";
        await UI.mostrarAlerta("Agendamento Confirmado!", `${nomeEmpresa} agradece pelo seu agendamento.`);
        resetarAgendamento();

        UI.trocarAba('menu-visualizacao');
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });

    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        await UI.mostrarAlerta("Erro", `Não foi possível confirmar o agendamento. ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// --- FUNÇÃO FILTRO AGENDAMENTOS (SUA ORIGINAL, INALTERADA) ---
async function handleFiltroAgendamentos(e) {
    if (!e.target.matches('.btn-toggle') || !state.currentUser) return;
    const modo = e.target.id === 'btn-ver-ativos' ? 'ativos' : 'historico';
    UI.selecionarFiltro(modo); // Atualiza UI dos botões
    UI.renderizarAgendamentosComoCards([], 'A buscar agendamentos...'); // Limpa e mostra loader
    try {
        const agendamentos = await buscarAgendamentosDoCliente(state.empresaId, state.currentUser, modo);
        UI.renderizarAgendamentosComoCards(agendamentos, modo); // Renderiza o resultado
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        await UI.mostrarAlerta("Erro de Busca", "Ocorreu um erro ao buscar os seus agendamentos.");
        UI.renderizarAgendamentosComoCards([], 'Não foi possível carregar os seus agendamentos.');
    }
}

// --- FUNÇÃO CANCELAR AGENDAMENTO (SUA ORIGINAL, INALTERADA) ---
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
                // Recarrega a lista atual (ativos ou histórico)
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
