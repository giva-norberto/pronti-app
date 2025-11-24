// ======================================================================
//        VITRINE-PETS.JS - Maestro da vitrine PET (PetShop)
//        Reaproveita quase toda lógica do vitrine.js, adaptando para PET
// ======================================================================

// ---- GARANTE QUE O ID DA EMPRESA NO LOCALSTORAGE ESTÁ CORRETO ----
(function() {
    const params = new URLSearchParams(window.location.search);
    let empresaUrl = params.get("empresa");
    if (empresaUrl) {
        // REMOVE SUFIXO (:587 ou etc) se existir!
        if (empresaUrl.includes(':')) {
            empresaUrl = empresaUrl.split(':')[0];
        }
        localStorage.setItem("empresaAtivaId", empresaUrl);
    }
})();

// -- MÓDULOS COMPARTILHADOS --
import { state, setEmpresa, setProfissionais, setTodosOsServicos, setAgendamento, resetarAgendamento, setCurrentUser } from './vitrini-state.js';
import { getEmpresaIdFromURL, getDadosEmpresa, getProfissionaisDaEmpresa, getHorariosDoProfissional, getTodosServicosDaEmpresa } from './vitrini-profissionais.js';
import { setupAuthListener, fazerLogin, fazerLogout } from './vitrini-auth.js';
import { marcarServicosInclusosParaUsuario } from './vitrine-assinatura-integration.js';
import * as UI from './vitrine-pets-ui.js'; // UI adaptada para PET
import { buscarAgendamentosDoDia, calcularSlotsDisponiveis, encontrarPrimeiraDataComSlots, salvarAgendamentoPet, buscarAgendamentosDoClientePets, cancelarAgendamentoPets } from './vitrine-pets-agendamento.js';
import { listarPetsDoCliente, cadastrarPet } from './vitrine-pets-animais.js'; // Gestor dos pets do cliente

// ---- DADOS INICIAIS / INICIALIZAÇÃO ----
document.addEventListener('DOMContentLoaded', async () => {
    try {
        UI.toggleLoader(true);

        // Tenta obter da função utilitária, ou do localStorage
        let empresaId = getEmpresaIdFromURL();
        if (!empresaId) {
            empresaId = localStorage.getItem("empresaAtivaId") || null;
        }
        if (!empresaId) throw new Error("ID da Empresa não encontrado na URL nem no localStorage.");

        // DEBUG: LOG para ver qual ID está sendo usado
        console.log("ID da empresa utilizado:", empresaId);

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

        UI.renderizarDadosIniciaisEmpresa(state.dadosEmpresa, state.todosOsServicos);
        UI.renderizarPetsMenuCard();
        UI.renderizarProfissionais(state.listaProfissionais); // opcional, se tiver profissionais

        await renderizarPlanosDeAssinaturaPets(empresaId);

        configurarEventosPets();
        setupAuthListener(handleUserAuthStateChangePets);
        UI.toggleLoader(false);

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
                // Lógica para promoções específicas por porte pode ir aqui
                // obj.promocao = ...
            });
        }
    });
    // Ou chame lógica padrão
}

// ---- RENDERIZA PLANOS ----
async function renderizarPlanosDeAssinaturaPets(empresaId) {
    await UI.renderizarPlanos(empresaId);
}

// ---- CONFIGURAÇÃO DE EVENTOS DO MENU CARD/PETS ----
function configurarEventosPets() {
    const grid = document.getElementById('vitrine-cards-grid');
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

    document.querySelectorAll('.btn-voltar').forEach(b => {
        b.addEventListener('click', () => {
            UI.trocarAba('main-navigation-container');
        });
    });

    const petsListContainer = document.getElementById('pets-list-container');
    if (petsListContainer) {
        petsListContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-pet');
            if (btn && btn.dataset.action === 'remover') {
                const petId = btn.dataset.petId;
                await UI.removerPetDoCliente(petId);
                await renderizarMenuMeusPets();
            }
        });
    }

    const btnAgendarPet = document.getElementById('btn-confirmar-agendamento-pet');
    if (btnAgendarPet) {
        btnAgendarPet.addEventListener('click', async () => {
            await handleConfirmarAgendamentoPet();
        });
    }

    const petsCadastroContainer = document.getElementById('pets-cadastro-container');
    if (petsCadastroContainer) {
        petsCadastroContainer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dados = UI.coletarDadosCadastroPet();
            await cadastrarPet(state.currentUser, dados);
            await renderizarMenuMeusPets();
        });
    }
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
