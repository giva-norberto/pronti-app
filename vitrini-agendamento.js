// vitrini-agendamento.js (VERSÃO FINAL - MÚLTIPLOS PROFISSIONAIS)

// ==========================================================================
// RESUMO DAS MUDANÇAS GERAIS NESTE ARQUIVO:
// 1. As funções agora recebem 'empresaId' em vez de 'profissionalUid'.
// 2. Os caminhos no Firebase foram atualizados de 'users/{uid}' para 'empresarios/{empresaId}'.
// 3. O 'profissionalId' agora é salvo DENTRO de cada agendamento.
// 4. As notificações de canto ('showNotification') foram substituídas pelos 'Cards de Alerta' ('showAlert').
// 5. A função 'encontrarPrimeiraDataComSlots' foi corrigida para funcionar com o profissional selecionado.
// ==========================================================================

import { db, collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc } from './vitrini-firebase.js';
import { showAlert } from './vitrini-utils.js';

/**
 * Salva um novo agendamento na subcoleção da EMPRESA.
 * @param {string} empresaId - ID da empresa.
 * @param {object} currentUser - Objeto do usuário autenticado.
 * @param {object} agendamentoState - Estado do agendamento (contém o profissional selecionado).
 */
export async function salvarAgendamento(empresaId, currentUser, agendamentoState) {
    const btn = document.getElementById('btn-confirmar-agendamento');
    
    // [MODIFICADO] A validação agora checa se um profissional foi selecionado.
    if (!currentUser || !agendamentoState.profissional || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
        await showAlert("Atenção", "Dados insuficientes para agendar. Verifique todas as seleções.");
        if(btn) btn.disabled = false;
        return;
    }

    try {
        const dataHoraString = `${agendamentoState.data}T${agendamentoState.horario}:00`;
        const dataAgendamento = new Date(dataHoraString);

        // [MODIFICADO] Adicionamos os dados do profissional ao agendamento.
        const dadosAgendamento = {
            clienteUid: currentUser.uid,
            clienteNome: currentUser.displayName,
            clienteEmail: currentUser.email,
            
            profissionalId: agendamentoState.profissional.id,
            profissionalNome: agendamentoState.profissional.nome,

            servicoId: agendamentoState.servico.id,
            servicoNome: agendamentoState.servico.nome,
            servicoDuracao: agendamentoState.servico.duracao,
            servicoPreco: agendamentoState.servico.preco,
            
            horario: Timestamp.fromDate(dataAgendamento),
            status: 'agendado'
        };

        // [MODIFICADO] O caminho para salvar agora é dentro da empresa.
        await addDoc(collection(db, "empresarios", empresaId, "agendamentos"), dadosAgendamento);
        
        await showAlert("Sucesso!", "Seu agendamento foi realizado com sucesso.");
        location.reload();

    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        await showAlert("Erro", "Falha ao realizar o agendamento. Tente novamente.");
        if(btn) btn.disabled = false;
    }
}

/**
 * Busca e exibe os agendamentos de um cliente para uma determinada EMPRESA.
 * @param {string} empresaId - ID da empresa.
 * @param {object} currentUser - Objeto do usuário autenticado.
 * @param {string} modo - 'ativos' ou 'historico'.
 */
export async function buscarEExibirAgendamentos(empresaId, currentUser, modo = 'ativos') {
    if (!currentUser) {
        // ... (código existente mantido) ...
        return;
    }

    // ... (código existente mantido) ...
    const listaEl = document.getElementById('lista-agendamentos-visualizacao');
    listaEl.innerHTML = '<p>A procurar os seus agendamentos...</p>';

    try {
        // [MODIFICADO] A busca agora é na coleção de agendamentos da empresa.
        const q = query(collection(db, "empresarios", empresaId, "agendamentos"), where("clienteUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listaEl.innerHTML = '<p>Você ainda não tem agendamentos nesta empresa.</p>';
            return;
        }

        const agora = new Date();
        const todos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const agendamentosFiltrados = (modo === 'ativos')
            ? todos.filter(ag => ag.horario.toDate() >= agora && ag.status === 'agendado').sort((a, b) => a.horario.toMillis() - b.horario.toMillis())
            : todos.filter(ag => ag.horario.toDate() < agora || ag.status !== 'agendado').sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
        
        renderizarAgendamentosComoCards(agendamentosFiltrados, modo);

    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        listaEl.innerHTML = '<p>Ocorreu um erro ao buscar os seus agendamentos.</p>';
    }
}

/**
 * Renderiza os cards de agendamento, agora mostrando o nome do profissional.
 * @param {Array} agendamentos - A lista de agendamentos para exibir.
 * @param {string} modo - 'ativos' ou 'historico'.
 */
function renderizarAgendamentosComoCards(agendamentos, modo) {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `<p>Nenhum agendamento para exibir no ${modo}.</p>`;
        return;
    }
    container.innerHTML = agendamentos.map(ag => {
        const horarioDate = ag.horario.toDate();
        const horarioStr = horarioDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const btnCancelar = (modo === 'ativos' && ag.status === 'agendado' && horarioDate > new Date())
            ? `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>` : '';
        let statusExibido = (modo !== 'ativos' && ag.status === 'agendado') ? 'Concluído' : ag.status.replace(/_/g, ' ');

        // [MODIFICADO] Adicionado o nome do profissional ao card.
        return `
        <div class="agendamento-card status-${ag.status}">
            <div class="agendamento-info">
                <h4>${ag.servicoNome}</h4>
                <p><strong>Profissional:</strong> ${ag.profissionalNome || 'N/A'}</p>
                <p><strong>Data:</strong> ${horarioStr}</p>
                <p><strong>Status:</strong> <span class="status">${statusExibido}</span></p>
            </div>
            <div class="agendamento-acao">${btnCancelar}</div>
        </div>`;
    }).join('');
}

/**
 * Cancela um agendamento na subcoleção da EMPRESA.
 * @param {string} empresaId - ID da empresa.
 * @param {string} agendamentoId - ID do agendamento a ser cancelado.
 * @param {Function} callback - Função a ser chamada após o sucesso.
 */
export async function cancelarAgendamento(empresaId, agendamentoId, callback) {
    try {
        // [MODIFICADO] O caminho para o documento agora é dentro da empresa.
        const agendamentoRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
        await updateDoc(agendamentoRef, { status: 'cancelado_pelo_cliente' });
        await showAlert("Sucesso", "Agendamento cancelado com sucesso.");
        if (callback) callback();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        await showAlert("Erro", "Ocorreu um erro ao cancelar. Tente novamente.");
    }
}

/**
 * Busca todos os agendamentos de um dia para uma EMPRESA.
 * @param {string} empresaId - ID da empresa.
 * @param {string} dataString - A data no formato 'AAAA-MM-DD'.
 * @returns {Promise<Array>} - Lista de agendamentos com início, fim e profissionalId.
 */
export async function buscarAgendamentosDoDia(empresaId, dataString) {
    const inicioDoDia = new Date(dataString + 'T00:00:00');
    const fimDoDia = new Date(dataString + 'T23:59:59');
    
    // [MODIFICADO] Busca na coleção de agendamentos da empresa.
    const q = query(
        collection(db, "empresarios", empresaId, "agendamentos"),
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia)),
        where("status", "==", "agendado")
    );

    const snapshot = await getDocs(q);
    // [MODIFICADO] Retorna também o profissionalId para filtragem posterior.
    return snapshot.docs.map(doc => {
        const ag = doc.data();
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (ag.servicoDuracao || 30) * 60000);
        return { inicio, fim, profissionalId: ag.profissionalId };
    });
}

/**
 * Função pura que calcula os slots de horário disponíveis. Nenhuma mudança necessária aqui.
 */
export function calcularSlotsDisponiveis(data, agendamentosOcupados, horariosConfig, duracaoServico) {
    // ... (código original mantido, está correto) ...
}

/**
 * [FUNÇÃO CORRIGIDA E ADAPTADA]
 * Encontra a primeira data com horários disponíveis para um PROFISSIONAL específico.
 * @param {string} empresaId - ID da empresa.
 * @param {object} profissional - O objeto completo do profissional selecionado.
 * @returns {Promise<string|null>} - A primeira data disponível ou nulo.
 */
export async function encontrarPrimeiraDataComSlots(empresaId, profissional) {
    if (!profissional?.horarios || !profissional?.servicos?.length) {
        console.warn("Profissional sem horários ou serviços configurados.");
        return null;
    }
    
    // [CORREÇÃO DO BUG] Encontra a menor duração entre os serviços do profissional selecionado.
    const menorDuracao = Math.min(...profissional.servicos.map(s => s.duracao || 30));

    let dataAtual = new Date();
    // Procura por até 90 dias no futuro
    for (let i = 0; i < 90; i++) {
        const diaSemana = dataAtual.getDay();
        const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
        const configDia = profissional.horarios[nomeDia];

        // Pula o dia se o profissional não trabalha ou não tem blocos de horário
        if (!configDia || !configDia.ativo || !configDia.blocos || configDia.blocos.length === 0) {
            dataAtual.setDate(dataAtual.getDate() + 1);
            continue;
        }

        const dataISO = new Date(dataAtual.getTime() - (dataAtual.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        // [MODIFICADO] Busca todos os agendamentos da empresa naquele dia
        const agendamentosDoDia = await buscarAgendamentosDoDia(empresaId, dataISO);
        // E filtra apenas para o profissional atual
        const agendamentosDoProfissional = agendamentosDoDia.filter(ag => ag.profissionalId === profissional.id);

        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataISO, agendamentosDoProfissional, profissional.horarios, menorDuracao
        );

        if (slotsDisponiveis.length > 0) {
            return dataISO; // Encontrou!
        }

        dataAtual.setDate(dataAtual.getDate() + 1); // Tenta o próximo dia
    }

    console.warn("Nenhuma data com slots encontrada nos próximos 90 dias.");
    return null; // Retorna nulo se não encontrar nada
}
