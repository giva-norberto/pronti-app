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
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// =====================================================================
// ✅ ADIÇÃO: IMPORTAÇÃO DO SERVIÇO DE FILA INDEPENDENTE
// =====================================================================
import { FilaService } from './vitrine-fila-service.js';
import { marcarServicosInclusosParaUsuario } from './vitrine-assinatura-integration.js';

let ofertaFilaJaTratada = false;
let ofertaFilaEmProcessamento = false;

// --- Função utilitária para corrigir data no formato brasileiro ou ISO (LÓGICA 100% PRESERVADA ) ---
function parseDataISO(dateStr) {
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

// ✅ MELHORIA ÚNICA: sugere automaticamente o turno com base na hora atual
function sugerirTurnoAtual() {
    const hora = new Date().getHours();

    if (hora < 12) return "Manhã";
    if (hora < 18) return "Tarde";
    return "Noite";
}

function obterContextoOfertaFilaDaURL() {
    const params = new URLSearchParams(window.location.search);
    return {
        filaId: params.get('filaId'),
        modo: params.get('modo')
    };
}

function limparParametrosOfertaDaURL() {
    const url = new URL(window.location.href);
    url.searchParams.delete('filaId');
    url.searchParams.delete('modo');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

function formatarDataOferta(dataISO) {
    const data = parseDataISO(dataISO);
    if (!data || isNaN(data.getTime())) return dataISO || '';
    return data.toLocaleDateString('pt-BR');
}

function timestampExpirou(ts) {
    if (!ts) return true;

    let dataExpiracao = null;

    if (typeof ts.toDate === 'function') {
        dataExpiracao = ts.toDate();
    } else if (ts.seconds) {
        dataExpiracao = new Date(ts.seconds * 1000);
    } else {
        dataExpiracao = new Date(ts);
    }

    if (!dataExpiracao || isNaN(dataExpiracao.getTime())) return true;

    return Date.now() > dataExpiracao.getTime();
}

async function calcularPrecoTotalDaOferta(servicosOferta = []) {
    let total = 0;

    for (const servicoOferta of servicosOferta) {
        const servicoCompleto = state.todosOsServicos.find(s => s.id === servicoOferta.id);

        if (servicoCompleto) {
            if (servicoCompleto.precoCobrado === 0) {
                total += 0;
            } else if (servicoCompleto.promocao?.precoComDesconto != null) {
                total += Number(servicoCompleto.promocao.precoComDesconto) || 0;
            } else {
                total += Number(servicoCompleto.preco) || 0;
            }
            continue;
        }

        total += Number(servicoOferta.preco) || Number(servicoOferta.valor) || 0;
    }

    return total;
}

async function processarOfertaFilaDaURL() {
    if (ofertaFilaJaTratada || ofertaFilaEmProcessamento) return;

    const { filaId, modo } = obterContextoOfertaFilaDaURL();

    if (!filaId || modo !== 'fila') return;
    if (!state.empresaId || !state.dadosEmpresa) return;

    const filaRef = doc(db, "fila_agendamentos", filaId);
    const filaSnap = await getDoc(filaRef);

    if (!filaSnap.exists()) {
        ofertaFilaJaTratada = true;
        await UI.mostrarAlerta("Oferta indisponível", "Essa oferta não foi encontrada ou já não está mais disponível.");
        limparParametrosOfertaDaURL();
        return;
    }

    const fila = filaSnap.data();

    if (fila.empresaId !== state.empresaId) {
        ofertaFilaJaTratada = true;
        await UI.mostrarAlerta("Oferta inválida", "Essa oferta não pertence a esta empresa.");
        limparParametrosOfertaDaURL();
        return;
    }

    if (fila.status === "agendado") {
        ofertaFilaJaTratada = true;
        await UI.mostrarAlerta("Oferta já utilizada", "Esse horário já foi confirmado anteriormente.");
        limparParametrosOfertaDaURL();
        return;
    }

    if (fila.status !== "oferta_enviada") {
        ofertaFilaJaTratada = true;
        await UI.mostrarAlerta("Oferta indisponível", "Essa oferta não está mais disponível para confirmação.");
        limparParametrosOfertaDaURL();
        return;
    }

    if (timestampExpirou(fila.ofertaExpiraEm)) {
        await updateDoc(filaRef, {
            status: "oferta_expirada",
            expiradoEm: serverTimestamp()
        });

        ofertaFilaJaTratada = true;
        await UI.mostrarAlerta("Oferta expirada", "O prazo dessa oferta terminou. Entre novamente na fila para receber uma nova oportunidade.");
        limparParametrosOfertaDaURL();
        return;
    }

    if (!state.currentUser) {
        await UI.mostrarAlerta("Login Necessário", "Faça login para confirmar o horário encontrado para você.");
        if (UI.abrirModalLogin) UI.abrirModalLogin();
        return;
    }

    if (fila.clienteId && state.currentUser.uid !== fila.clienteId) {
        ofertaFilaJaTratada = true;
        await UI.mostrarAlerta("Acesso negado", "Essa oferta pertence a outro cliente.");
        limparParametrosOfertaDaURL();
        return;
    }

    const dataOferta = fila.dataOferta || fila.dataFila;
    const horarioOferta = fila.horarioOferta;
    const profissionalNome = fila.profissionalNome || "Profissional";
    const textoConfirmacao = `Encontramos um horário para você com ${profissionalNome} em ${formatarDataOferta(dataOferta)} às ${horarioOferta}. Deseja confirmar agora?`;

    const confirmou = await UI.mostrarConfirmacao("Confirmar horário encontrado", textoConfirmacao);
    if (!confirmou) return;

    try {
        ofertaFilaEmProcessamento = true;
        UI.toggleLoader(true, "Confirmando seu horário...");

        const filaSnapAtual = await getDoc(filaRef);
        if (!filaSnapAtual.exists()) {
            throw new Error("A oferta não foi encontrada.");
        }

        const filaAtual = filaSnapAtual.data();

        if (filaAtual.status !== "oferta_enviada") {
            throw new Error("Essa oferta não está mais disponível.");
        }

        if (timestampExpirou(filaAtual.ofertaExpiraEm)) {
            await updateDoc(filaRef, {
                status: "oferta_expirada",
                expiradoEm: serverTimestamp()
            });
            throw new Error("O prazo dessa oferta expirou.");
        }

        const servicosOferta = Array.isArray(filaAtual.servicos) ? filaAtual.servicos : [];
        const precoTotalCalculado = await calcularPrecoTotalDaOferta(servicosOferta);

        const servicoParaSalvar = {
            id: servicosOferta.map(s => s.id).filter(Boolean).join(','),
            nome: servicosOferta.map(s => s.nome).join(' + '),
            duracao: Number(filaAtual.duracaoTotal) || servicosOferta.reduce((total, s) => total + (Number(s.duracao) || 0), 0),
            preco: precoTotalCalculado
        };

        const agendamentoParaSalvar = {
            profissional: {
                id: filaAtual.profissionalId,
                nome: filaAtual.profissionalNome
            },
            data: filaAtual.dataOferta || filaAtual.dataFila,
            horario: filaAtual.horarioOferta,
            servico: servicoParaSalvar,
            empresa: state.dadosEmpresa
        };

        await salvarAgendamento(state.empresaId, state.currentUser, agendamentoParaSalvar);

        await updateDoc(filaRef, {
            status: "agendado",
            confirmadoEm: serverTimestamp(),
            clienteConfirmou: true
        });

        ofertaFilaJaTratada = true;
        limparParametrosOfertaDaURL();

        const nomeEmpresa = state.dadosEmpresa.nomeFantasia || "A empresa";
        await UI.mostrarAlerta("Agendamento Confirmado!", `${nomeEmpresa} agradece pela confirmação do seu horário.`);
        resetarAgendamento();

        UI.trocarAba('menu-visualizacao');
        handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });

    } catch (error) {
        console.error("Erro ao confirmar oferta da fila:", error);
        await UI.mostrarAlerta("Erro", error.message || "Não foi possível confirmar essa oferta.");
    } finally {
        ofertaFilaEmProcessamento = false;
        UI.toggleLoader(false);
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);

        const params = new URLSearchParams(window.location.search);
        let empresaId = params.get('empresa');
        
        const slug = window.location.pathname.substring(1);

        if (!empresaId && slug && slug !== 'vitrine.html' && slug !== 'index.html' && !slug.startsWith('r.html')) {
            console.log(`[Vitrine] ID não encontrado. Buscando empresa pelo slug: ${slug}`);
            
            const q = query(collection(db, "empresarios"), where("slug", "==", slug), limit(1));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                empresaId = snapshot.docs[0].id;
                console.log(`[Vitrine] Empresa encontrada pelo slug. ID: ${empresaId}`);
            }
        }

        if (!empresaId) {
            empresaId = getEmpresaIdFromURL();
            if (!empresaId) {
                throw new Error("ID da Empresa não pôde ser determinado a partir da URL.");
            }
        }

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

        await aplicarPromocoesNaVitrine(state.todosOsServicos, empresaId, null, true);

        try {
            await marcarServicosInclusosParaUsuario(state.todosOsServicos, empresaId);
        } catch(err){
            console.info("Não foi possível verificar assinatura na carga inicial:", err.message);
        }

        UI.renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos);
        UI.renderizarProfissionais(state.listaProfissionais);

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
    listaServicos.forEach(s => { s.promocao = null; });
    if (forceNoPromo || !dataSelecionadaISO) return;

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

// --- FUNÇÃO PARA RENDERIZAR PLANOS (SUA ORIGINAL, INALTERADA) ---
async function renderizarPlanosDeAssinatura(empresaId) {
    const planosDiv = document.getElementById('lista-de-planos');
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
                card.style = 'background:#fff;border-radius:14px;box-shadow:0 4px 18px rgba(99,102,241,0.06);margin:18px 0;padding:22px;text-align:center;color:#333;';
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

// --- FUNÇÃO DE MUDANÇA DE ESTADO AUTH (SUA ORIGINAL, INALTERADA) ---
function handleUserAuthStateChange(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);
    UI.toggleAgendamentoLoginPrompt(!user);

    if (user && state.empresaId) {
        (async () => {
            try {
                await marcarServicosInclusosParaUsuario(state.todosOsServicos, state.empresaId);
                if (document.getElementById('lista-servicos')?.offsetParent !== null) {
                   UI.renderizarServicos(state.todosOsServicos.filter(s => state.agendamento?.profissional?.servicos?.includes(s.id)), state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo);
                   state.agendamento?.servicos?.forEach(s => UI.selecionarCard('servico', s.id));
                   if(state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo) {
                      UI.atualizarResumoAgendamento(state.agendamento.servicos);
                   } else {
                      UI.atualizarResumoAgendamentoFinal();
                   }
                }
            } catch (err) {
                 console.info("Não foi possível verificar assinatura após login:", err.message);
            }
        })();
    } else if (!user && state.empresaId) {
        state.todosOsServicos.forEach(s => {
            s.inclusoAssinatura = false;
            s.precoCobrado = undefined;
            s.assinaturasCandidatas = undefined;
        });
         if (document.getElementById('lista-servicos')?.offsetParent !== null) {
             UI.renderizarServicos(state.todosOsServicos.filter(s => state.agendamento?.profissional?.servicos?.includes(s.id)), state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo);
             state.agendamento?.servicos?.forEach(s => UI.selecionarCard('servico', s.id));
             if(state.agendamento?.profissional?.horarios?.permitirAgendamentoMultiplo) {
                UI.atualizarResumoAgendamento(state.agendamento.servicos);
             } else {
                UI.atualizarResumoAgendamentoFinal();
             }
        }
    }

    if (user) {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            handleFiltroAgendamentos({ target: document.getElementById('btn-ver-ativos') });
        }
    } else {
        if (document.getElementById('menu-visualizacao')?.classList.contains('ativo')) {
            if (UI.exibirMensagemDeLoginAgendamentos) UI.exibirMensagemDeLoginAgendamentos();
        }
    }

    processarOfertaFilaDaURL().catch(err => {
        console.error("Erro ao processar oferta da fila após auth:", err);
    });
}

// --- FUNÇÃO DE CLIQUE NO MENU (SUA ORIGINAL, INALTERADA) ---
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

// --- FUNÇÃO DE CLIQUE NO PROFISSIONAL (SUA ORIGINAL, INALTERADA) ---
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
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId =>
            state.todosOsServicos.find(servico => servico.id === servicoId)
        ).filter(Boolean);

         try {
            await marcarServicosInclusosParaUsuario(servicosDoProfissional, state.empresaId);
         } catch(err){
             console.info("Não foi possível verificar assinatura ao selecionar profissional:", err.message);
         }

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

// --- FUNÇÃO BOTÃO PROSSEGUIR (SUA ORIGINAL, INALTERADA) ---
async function handleProsseguirDataClick() {
    const servicos = state.agendamento.servicos;
    if (!servicos || servicos.length === 0) {
        await UI.mostrarAlerta("Atenção", "Selecione pelo menos um serviço para continuar.");
        return;
    }
    document.getElementById('data-e-horario-container').style.display = 'block';
    await buscarPrimeiraDataDisponivel();
}

// --- FUNÇÃO BUSCAR PRIMEIRA DATA (SUA ORIGINAL, INALTERADA) ---
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

// --- FUNÇÃO MUDANÇA DE DATA (SUA ORIGINAL, INALTERADA) ---
async function handleDataChange(e) {
    setAgendamento('data', e.target.value);
    setAgendamento('horario', null);
    UI.limparSelecao('horario');
    UI.desabilitarBotaoConfirmar();

    const { profissional, servicos, data } = state.agendamento;
    const duracaoTotal = servicos.reduce((total, s) => total + s.duracao, 0);

    await aplicarPromocoesNaVitrine(state.todosOsServicos, state.empresaId, data, false);

     try {
        await marcarServicosInclusosParaUsuario(state.todosOsServicos, state.empresaId);
     } catch(err){
         console.info("Não foi possível verificar assinatura ao mudar data:", err.message);
     }

    if (profissional) {
        const permiteMultiplos = profissional.horarios?.permitirAgendamentoMultiplo || false;
        const servicosDoProfissional = (profissional.servicos || []).map(servicoId =>
            state.todosOsServicos.find(servico => servico.id === servicoId)
        ).filter(Boolean);
        UI.renderizarServicos(servicosDoProfissional, permiteMultiplos);
        state.agendamento.servicos.forEach(s => UI.selecionarCard('servico', s.id));
        if (permiteMultiplos) {
            UI.atualizarResumoAgendamento(state.agendamento.servicos);
        } else {
            UI.atualizarResumoAgendamentoFinal();
        }
    }

    if (!profissional || duracaoTotal === 0 || !data) return;

    UI.renderizarHorarios([], 'A calcular horários...');

    try {
        const todosAgendamentos = await buscarAgendamentosDoDia(state.empresaId, data);
        const agendamentosProfissional = todosAgendamentos.filter(ag => ag.profissionalId === profissional.id);
        const slots = calcularSlotsDisponiveis(data, agendamentosProfissional, profissional.horarios, duracaoTotal);
        UI.renderizarHorarios(slots);
        
        // ✅ BLINDAGEM DO BOTÃO DE FILA: Garante exibição apenas quando não há slots
        const containerFila = document.getElementById('container-fila-espera');
        if (containerFila) {
            containerFila.style.display = (slots.length === 0) ? 'block' : 'none';
        }
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        UI.renderizarHorarios([], 'Erro ao carregar horários. Tente outra data.');
    }
}

// --- FUNÇÃO CLIQUE HORÁRIO (SUA ORIGINAL, INALTERADA) ---
function handleHorarioClick(e) {
    const btn = e.target.closest('.btn-horario');
    if (!btn || btn.disabled) return;

    setAgendamento('horario', btn.dataset.horario);
    UI.selecionarCard('horario', btn.dataset.horario);
    UI.atualizarResumoAgendamentoFinal();
    UI.habilitarBotaoConfirmar();
}

// --- FUNÇÃO CONFIRMAR AGENDAMENTO (SUA ORIGINAL, INALTERADA) ---
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
        const precoTotalCalculado = servicos.reduce((total, s) => {
            if (s.precoCobrado === 0) {
                return total + 0;
            } else if (s.promocao) {
                return total + (s.promocao.precoComDesconto || 0);
            } else {
                return total + (s.preco || 0);
            }
        }, 0);

        const servicoParaSalvar = {
            id: servicos.map(s => s.id).join(','),
            nome: servicos.map(s => s.nome).join(' + '),
            duracao: servicos.reduce((total, s) => total + s.duracao, 0),
            preco: precoTotalCalculado
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

// --- FUNÇÃO CANCELAR AGENDAMENTO (SUA ORIGINAL, INALTERADA) ---
async function handleCancelarClick(e) {
    const btnCancelar = e.target.closest('.btn-cancelar');
    if (btnCancelar) {
        const agendamentoId = btnCancelar.dataset.id;
        const confirmou = await UI.mostrarConfirmacao("Cancelar Agendamento", "Tem a certeza de que deseja cancelar este agendamento?");
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

// =====================================================================
// ✅ NOVA FUNÇÃO: ENTRAR NA FILA DE AGENDAMENTO (SISTEMA INDEPENDENTE)
// =====================================================================
async function entrarNaFilaDeAgendamento() {
    if (!state.currentUser) {
        await UI.mostrarAlerta("Login Necessário", "Por favor, faça login para entrar na fila.");
        if (UI.abrirModalLogin) UI.abrirModalLogin();
        return;
    }

    // ✅ VALIDAÇÃO DE SEGURANÇA: Evita erro de 'id' de undefined
    if (!state.agendamento?.profissional?.id) {
        await UI.mostrarAlerta("Atenção", "Profissional não identificado. Por favor, selecione-o novamente.");
        return;
    }

    // Usa confirmação padrão Pronti para ser didático
    const querEntrar = await UI.mostrarConfirmacao("Fila de Espera", "Deseja entrar na fila de espera para este profissional?");
    if (!querEntrar) return;

    // ✅ MELHORIA: substitui o prompt feio por sugestão automática de turno
    const turno = sugerirTurnoAtual();

    try {
        UI.toggleLoader(true, "Registrando na fila...");
        
        // Chama o FilaService independente
        const resultado = await FilaService.entrarNaLista(state, state.currentUser, { turno });

        if (!resultado?.sucesso) {
            await UI.mostrarAlerta("Atenção", resultado?.mensagem || "Não foi possível entrar na fila.");
            return;
        }

        await UI.mostrarAlerta("Sucesso!", "Você está na fila de espera! Se uma vaga surgir, enviaremos um link do Pronti para você confirmar em até 5 minutos.");
        
        // Esconde o botão após o sucesso
        const containerFila = document.getElementById('container-fila-espera');
        if (containerFila) containerFila.style.display = 'none';

    } catch (err) {
        console.error("Erro ao entrar na fila:", err);
        await UI.mostrarAlerta("Erro", "Falha ao registrar interesse: " + err.message);
    } finally {
        UI.toggleLoader(false);
    }
}

// Torna a função acessível globalmente para o botão no HTML
window.entrarNaFilaDeAgendamento = entrarNaFilaDeAgendamento;
