// ======================================================================
//        VITRINE-PETS.JS - Maestro da vitrine PET (PetShop)
//        Reaproveita quase toda lógica do vitrine.js, adaptando para PET
// ======================================================================

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

        let empresaId = getEmpresaIdFromURL();
        if (!empresaId) throw new Error("ID da Empresa não encontrado na URL.");

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

// ---- APLICA PROMOCÕES PETS (Reusando da vitrine normal, só adaptando se preciso) ----
async function aplicarPromocoesPetsNaVitrine(listaServicos, empresaId) {
    // Promocoes funcionam igual, só muda render se for por porte
    // Aqui você pode adaptar para marcar promo para cada porte do serviço PET
    // Ex: servico.precos.forEach(obj => obj.promocao = ...)
    // Se preferir, use a mesma função do vitrine normal se a lógica for igual para todos (percentual, fixo, etc)
    // (Opcional: implementar promoções dinâmicas por porte.)
}

// ---- RENDERIZA PLANOS (Reaproveite quase tudo) ----
async function renderizarPlanosDeAssinaturaPets(empresaId) {
    await UI.renderizarPlanos(empresaId);
}

// ---- CONFIGURAÇÃO DE EVENTOS DO MENU CARD/PETS ----
function configurarEventosPets() {
    // Cards principais
    document.getElementById('vitrine-cards-grid').addEventListener('click', async (e) => {
        const card = e.target.closest('.vitrine-card');
        if (!card) return;
        const menuKey = card.dataset.menuCard;
        switch (menuKey) {
            case 'agendamento': UI.trocarAba('menu-agendamento'); break;
            case 'pets': await renderizarMenuMeusPets(); break;
            case 'visualizacao': UI.trocarAba('menu-visualizacao');
                // Carrega agendamentos do cliente (pets)
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

    // Botões de voltar para o menu principal
    document.querySelectorAll('.btn-voltar').forEach(b => {
        b.addEventListener('click', () => {
            UI.trocarAba('main-navigation-container');
        });
    });

    // Menu "Meus Pets" - novo fluxo
    document.getElementById('pets-list-container')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-pet');
        if (btn && btn.dataset.action === 'remover') {
            const petId = btn.dataset.petId;
            await UI.removerPetDoCliente(petId);
            await renderizarMenuMeusPets();
        }
    });

    // BOTÃO DE CONFIRMAR AGENDAMENTO PET
    document.getElementById('btn-confirmar-agendamento-pet')?.addEventListener('click', async () => {
        await handleConfirmarAgendamentoPet();
    });

    // Botão de cadastro de pet, etc. (exemplo)
    document.getElementById('pets-cadastro-container')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = UI.coletarDadosCadastroPet();
        await cadastrarPet(state.currentUser, dados);
        await renderizarMenuMeusPets();
    });
}

// ---- LÓGICA DE AUTENTICAÇÃO (MANTIDA), SÓ ADAPTA UI POR PET ----
function handleUserAuthStateChangePets(user) {
    setCurrentUser(user);
    UI.atualizarUIdeAuth(user);

    // Se usuário logado, recarrega pets e serviços inclusos no plano
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

    // Pega pet selecionado, serviço, porte, data, horário
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
document.getElementById('lista-agendamentos-visualizacao')?.addEventListener('click', async (e) => {
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


// ---- HANDLERS DE NAVEGAÇÃO DE ABA EXTRAS (opcional) ----
// Adicione outros handlers/reaproveite os de vitrine normal conforme novos cards/menus PET

// ---- FINAL DO ARQUIVO ----
