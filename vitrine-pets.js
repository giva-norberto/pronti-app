// ======================================================================
//        VITRINE-PETS.JS - Maestro da vitrine PET (PetShop)
//        (Código Maestro Completo, pronto para a página vitrine-pet.html)
// ======================================================================

// ---- GARANTE QUE O ID DA EMPRESA ESTÁ NO LOCALSTORAGE, SEM SUFIXO ----
(function() {
    const params = new URLSearchParams(window.location.search);
    let empresaUrl = params.get("empresa");
    if (empresaUrl) {
        // Remove sufixo (caso venha ?empresa=ID:sufixo)
        empresaUrl = empresaUrl.split(':')[0];
        localStorage.setItem("empresaAtivaId", empresaUrl);
    }
})();

// Função para pegar o ID limpo SEM sufixo, inclusive se localStorage tiver sujo
function getEmpresaIdClean() {
    let empresaId = localStorage.getItem("empresaAtivaId");
    if (empresaId && empresaId.includes(':')) {
        empresaId = empresaId.split(':')[0];
        localStorage.setItem("empresaAtivaId", empresaId);
    }
    return empresaId || null;
}

// -- MÓDULOS COMPARTILHADOS --
import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getDadosEmpresa, getProfissionaisDaEmpresa, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import { marcarServicosInclusosParaUsuario } from './vitrine-assinatura-integration.js';
import * as UI from './vitrine-pets-ui.js'; // UI adaptada para PET
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, encontrarPrimeiraDataComSlots, salvarAgendamentoPet, buscarAgendamentosDoClientePets, cancelarAgendamentoPets } from './vitrine-pets-agendamento.js';
import { listarPetsDoCliente, cadastrarPet } from './vitrine-pets-animais.js'; // Gestor dos pets do cliente

// ⚠️ LÓGICA MÍNIMA DE UI PARA GARANTIR QUE A TELA PET SEJA EXIBIDA
//    (Simulando a função que viria do vitrine-pets-ui.js)
function renderizarDadosIniciaisEmpresa(dadosEmpresa, todosServicos) {
    // 1. Atualiza o Header Card com o nome e logo do PET Shop
    const nomeNegocioEl = document.getElementById('nome-negocio-publico');
    const boasVindasEl = document.getElementById('boas-vindas-usuario');
    const logoEl = document.getElementById('logo-publico');

    if (nomeNegocioEl) {
        nomeNegocioEl.textContent = dadosEmpresa?.nomeFantasia || "PET SHOP";
    }
    if (boasVindasEl) {
        boasVindasEl.textContent = `Bem-vindo(a) ao PetShop!`;
    }
    if (logoEl && dadosEmpresa?.logoUrl) {
        logoEl.src = dadosEmpresa.logoUrl;
    }

    // 2. Garante que o contêiner PET está visível e o contêiner padrão está invisível
    const mainNav = document.getElementById('main-navigation-container'); // Contêiner do Layout SALÃO
    const petsNav = document.getElementById('pets-navigation-container'); // Contêiner do Layout PET

    if (petsNav) {
        petsNav.style.display = 'block';
    }
    if (mainNav) {
        mainNav.style.display = 'none'; // Esconde o layout SALÃO/Padrão
    }
}
// ⚠️ FIM DA LÓGICA MÍNIMA DE UI


// ---- DADOS INICIAIS / INICIALIZAÇÃO ----
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true); // Mostra o loader

        let empresaId = getEmpresaIdClean();
        if (!empresaId) throw new Error("ID da Empresa não encontrado na URL nem no localStorage.");

        // Carrega dados essenciais em paralelo
        const [dadosEmpresa, profissionais, todosServicos] = await Promise.all([
            getDadosEmpresa(empresaId), getProfissionaisDaEmpresa(empresaId), getTodosServicosDaEmpresa(empresaId)
        ]);
        if (!dadosEmpresa) throw new Error("Empresa não encontrada.");

        setEmpresa(empresaId, dadosEmpresa);
        setProfissionais(profissionais);
        setTodosOsServicos(todosServicos);

        // Marcar possíveis inclusos do plano PET, múltiplos pets, etc.
        await aplicarPromocoesPetsNaVitrine(state.todosOsServicos, empresaId);
        await marcarServicosInclusosParaUsuario(state.todosOsServicos, empresaId);

        // 🎯 CHAMA A FUNÇÃO DE RENDERIZAÇÃO PARA FORÇAR O LAYOUT PET
        renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos); 
        // UI.renderizarPetsMenuCard(); // Lógica de UI mais detalhada
        // UI.renderizarProfissionais(state.listaProfissionais); // opcional

        await renderizarPlanosDeAssinaturaPets(empresaId);

        configurarEventosPets();
        setupAuthListener(handleUserAuthStateChangePets);
        UI.toggleLoader(false); // Esconde o loader e mostra o #vitrine-content

    } catch (error) {
        console.error("Erro fatal na inicialização:", error.stack);
        document.getElementById("vitrine-loader").innerHTML = `<p style="text-align: center; color:red; padding: 20px;">${error.message}</p>`;
    }
});

// ---- APLICA PROMOÇÕES PETS ----
async function aplicarPromocoesPetsNaVitrine(listaServicos, empresaId) {
    listaServicos.forEach(servico => {
        if (Array.isArray(servico.precos)) {
            servico.precos.forEach(obj => {
                // Exemplo de promoção: coloque aqui sua lógica de promoção por porte
            });
        }
    });
}

// ---- RENDERIZA PLANOS ----
async function renderizarPlanosDeAssinaturaPets(empresaId) {
    // Note: Esta função deve estar no seu módulo de UI/Assinatura
    // await UI.renderizarPlanos(empresaId); 
}

// ---- CONFIGURAÇÃO DE EVENTOS DO MENU CARD/PETS ----
function configurarEventosPets() {
    // 💡 IMPORTANTE: Você precisará adaptar o listener para capturar cliques no grid PET
    const grid = document.getElementById('vitrine-cards-grid-pet'); // Use o ID do grid PET
    if (grid) {
        grid.addEventListener('click', async (e) => {
            const card = e.target.closest('.vitrine-card');
            if (!card) return;
            const menuKey = card.dataset.menuCard;
            switch (menuKey) {
                case 'agendamento': UI.trocarAba('menu-agendamento'); break;
                case 'pets': await renderizarMenuMeusPets(); break;
                case 'visualizacao':
                    UI.trocarAba('menu-visualizacao');
                    await renderizarAgendamentosDoClientePets();
                    break;
                case 'assinatura': UI.trocarAba('menu-assinatura'); break;
                case 'informacoes': UI.trocarAba('menu-informacoes'); break;
                case 'perfil':
                    if (!state.currentUser) { fazerLogin(); return; }
                    UI.trocarAba('menu-perfil');
                    break;
            }
        });
    }

    // Voltar para o menu principal PET
    document.querySelectorAll('.btn-voltar').forEach(b => {
        b.addEventListener('click', () => {
            UI.trocarAba('pets-navigation-container'); // Volta para o contêiner PET
        });
    });

    // ... Outros Listeners de CRUD de Pets e Agendamento ...
}

// ---- LÓGICA DE AUTENTICAÇÃO ----
function handleUserAuthStateChangePets(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);

    if (user && state.empresaId) {
        marcarServicosInclusosParaUsuario(state.todosOsServicos, state.empresaId);
        renderizarMenuMeusPets();
    }
}

// ---- FUNÇÃO DE RENDER DO MENU "Meus Pets" ----
async function renderizarMenuMeusPets() {
    UI.trocarAba('menu-pets');
    const pets = await listarPetsDoCliente(state.currentUser);
    UI.renderizarListaPets(pets);
}

// ---- FLUXO DE AGENDAMENTO PET PRINCIPAL ----
async function handleConfirmarAgendamentoPet() {
    if (!state.currentUser) {
        await UI.mostrarAlerta("Login Necessário", "Você precisa de fazer login para confirmar o agendamento Pet.");
        if (UI.abrirModalLogin) UI.abrirModalLogin();
        return;
    }

    const { petId, petNome, porte, profissional, servico, data, horario } = state.agendamento;
    if (!petId || !porte || !servico || !data || !horario) {
        await UI.mostrarAlerta("Informação Incompleta", "Selecione pet, serviço, porte, data e horário.");
        return;
    }

    const btn = document.getElementById('btn-confirmar-agendamento-pet');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Agendando pet...';

    try {
        const agendamentoParaSalvar = {
            petId, petNome, porte, profissional, servico, data, horario, empresa: state.dadosEmpresa
        };
        await salvarAgendamentoPet(state.empresaId, state.currentUser, agendamentoParaSalvar);
        await UI.mostrarAlerta("Agendamento Confirmado!", `Seu pet ${petNome} está agendado!`);
        resetarAgendamento();

        UI.trocarAba('menu-visualizacao');
        await renderizarAgendamentosDoClientePets();

    } catch (error) {
        console.error("Erro ao salvar agendamento PET:", error);
        await UI.mostrarAlerta("Erro", `Não foi possível confirmar o agendamento do pet. ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// ---- FUNÇÃO DE RENDER AGENDAMENTOS DO CLIENTE ----
async function renderizarAgendamentosDoClientePets() {
    const agendamentos = await buscarAgendamentosDoClientePets(state.empresaId, state.currentUser, "ativos");
    UI.renderizarAgendamentosPets(agendamentos);
}

// ---- CANCELAR AGENDAMENTO ----
const agendamentosVisualizacao = document.getElementById('lista-agendamentos-visualizacao');
if (agendamentosVisualizacao) {
    agendamentosVisualizacao.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-cancelar');
        if (btn) {
            const agendamentoId = btn.dataset.id;
            const confirmou = await UI.mostrarConfirmacao("Cancelar Agendamento", "Tem certeza que deseja cancelar este agendamento para seu pet?");
            if (confirmou) {
                btn.disabled = true;
                btn.textContent = "Cancelando...";
                try {
                    await cancelarAgendamentoPets(state.empresaId, agendamentoId);
                    await UI.mostrarAlerta("Sucesso", "Agendamento do pet cancelado!");
                    await renderizarAgendamentosDoClientePets();
                } catch (error) {
                    await UI.mostrarAlerta("Erro", "Erro ao cancelar agendamento do pet.");
                    btn.disabled = false;
                    btn.textContent = "Cancelar";
                }
            }
        }
    });
}

// ---- FINAL DO ARQUIVO ----
