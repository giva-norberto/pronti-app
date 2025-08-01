// vitrini-agendamento.js

import { db, collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc } from './vitrini-firebase.js';
import { showNotification } from './vitrini-utils.js';

/**
 * Salva um novo agendamento no Firestore.
 * @param {string} profissionalUid - UID do profissional.
 * @param {object} currentUser - Objeto do utilizador autenticado do Firebase.
 * @param {object} agendamentoState - Estado atual do agendamento (serviço, data, horario).
 */
export async function salvarAgendamento(profissionalUid, currentUser, agendamentoState) {
    if (!currentUser || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
        showNotification("Dados insuficientes para agendar.", true);
        return;
    }

    try {
        const dataHoraString = `${agendamentoState.data}T${agendamentoState.horario}:00`;
        const dataAgendamento = new Date(dataHoraString);

        const dadosAgendamento = {
            clienteUid: currentUser.uid,
            clienteNome: currentUser.displayName,
            clienteEmail: currentUser.email,
            servicoId: agendamentoState.servico.id,
            servicoNome: agendamentoState.servico.nome,
            servicoDuracao: agendamentoState.servico.duracao,
            servicoPreco: agendamentoState.servico.preco,
            horario: Timestamp.fromDate(dataAgendamento),
            status: 'agendado'
        };

        await addDoc(collection(db, "users", profissionalUid, "agendamentos"), dadosAgendamento);
        showNotification("Agendamento realizado com sucesso!");

        setTimeout(() => {
            location.reload();
        }, 1500);

    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        showNotification("Falha ao realizar o agendamento. Tente novamente.", true);
    }
}

export async function buscarEExibirAgendamentos(profissionalUid, currentUser, modo = 'ativos') {
    if (!currentUser) {
        document.getElementById('agendamentos-login-prompt').style.display = 'block';
        document.getElementById('botoes-agendamento').style.display = 'none';
        document.getElementById('lista-agendamentos-visualizacao').innerHTML = '';
        return;
    }

    document.getElementById('agendamentos-login-prompt').style.display = 'none';
    document.getElementById('botoes-agendamento').style.display = 'flex';
    const listaEl = document.getElementById('lista-agendamentos-visualizacao');
    listaEl.innerHTML = '<p>A procurar os seus agendamentos...</p>';

    try {
        const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("clienteUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listaEl.innerHTML = '<p>Você ainda não tem agendamentos.</p>';
            return;
        }

        const agora = new Date();
        const todos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const agendamentosFiltrados = (modo === 'ativos')
            ? todos.filter(ag => ag.horario.toDate() >= agora && ag.status === 'agendado').sort((a, b) => a.horario.toMillis() - b.horario.toMillis())
            : todos.filter(ag => ag.horario.toDate() < agora || ag.status !== 'agendado').sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
        
        renderizarAgendamentosComoCards(profissionalUid, agendamentosFiltrados, modo);

    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        listaEl.innerHTML = '<p>Ocorreu um erro ao buscar os agendamentos.</p>';
    }
}

/**
 * Renderiza os cards de agendamento na tela.
 * @param {string} profissionalUid - UID do profissional.
 * @param {Array} agendamentos - A lista de agendamentos para exibir.
 * @param {string} modo - 'ativos' ou 'historico'.
 */
function renderizarAgendamentosComoCards(profissionalUid, agendamentos, modo) {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `<p>Nenhum agendamento para exibir.</p>`;
        return;
    }

    // CORREÇÃO: Estrutura HTML dos cards atualizada para melhor formatação
    container.innerHTML = agendamentos.map(ag => {
        const horarioDate = ag.horario.toDate();
        const horarioStr = horarioDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        let btnCancelar = '';

        if (modo === 'ativos' && ag.status === 'agendado' && horarioDate > new Date()) {
            btnCancelar = `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>`;
        }
        
        let statusExibido = ag.status;
        if(modo !== 'ativos' && ag.status === 'agendado') statusExibido = 'Concluído';

        return `
        <div class="agendamento-card">
            <div class="agendamento-info">
                <h4>${ag.servicoNome}</h4>
                <p><strong>Data:</strong> ${horarioStr}</p>
                <p><strong>Status:</strong> ${statusExibido}</p>
            </div>
            <div class="agendamento-acao">
                ${btnCancelar}
            </div>
        </div>`;
    }).join('');
}


export async function cancelarAgendamento(profissionalUid, agendamentoId, callback) {
    if (!confirm("Tem a certeza que deseja cancelar este agendamento?")) return;
    try {
        const agendamentoRef = doc(db, "users", profissionalUid, "agendamentos", agendamentoId);
        await updateDoc(agendamentoRef, { status: 'cancelado_pelo_cliente' });
        showNotification("Agendamento cancelado com sucesso.");
        if (callback) callback();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        showNotification("Ocorreu um erro ao cancelar. Tente novamente.", true);
    }
}

export async function buscarAgendamentosDoDia(profissionalUid, dataString) {
    const inicioDoDia = new Date(dataString + 'T00:00:00');
    const fimDoDia = new Date(dataString + 'T23:59:59');
    
    const q = query(
        collection(db, "users", profissionalUid, "agendamentos"),
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia)),
        where("status", "==", "agendado")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const ag = doc.data();
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (ag.servicoDuracao || 30) * 60000);
        return { inicio, fim };
    });
}

export function calcularSlotsDisponiveis(data, agendamentosOcupados, horariosConfig, duracaoServico) {
    if (!horariosConfig) {
        console.warn("Configuração de horários não fornecida. Nenhum slot será gerado.");
        return [];
    }

    const diaSemana = new Date(data + 'T12:00:00').getDay();
    const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
    const configDia = horariosConfig[nomeDia];

    if (!configDia || !configDia.ativo) return [];

    const slots = [];
    const { intervalo = 30 } = horariosConfig;
    const agora = new Date();

    (configDia.blocos || []).forEach(bloco => {
        let horarioAtual = new Date(`${data}T${bloco.inicio}`);
        const fimDoBloco = new Date(`${data}T${bloco.fim}`);

        while (horarioAtual < fimDoBloco) {
            const fimDoSlotProposto = new Date(horarioAtual.getTime() + duracaoServico * 60000);
            
            if (fimDoSlotProposto > fimDoBloco) break;

            const slotDisponivel = !agendamentosOcupados.some(ag =>
                horarioAtual < ag.fim && fimDoSlotProposto > ag.inicio
            );

            if (slotDisponivel && horarioAtual > agora) {
                slots.push(horarioAtual.toTimeString().substring(0, 5));
            }
            
            horarioAtual = new Date(horarioAtual.getTime() + intervalo * 60000);
        }
    });

    return slots;
}

export async function encontrarPrimeiraDataComSlots(profissionalUid, professionalData) {
    if (!professionalData?.horarios || !professionalData?.servicos || professionalData.servicos.length === 0) {
        const hoje = new Date();
        return new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    let dataAtual = new Date();
    const servicoParaTeste = professionalData.servicos[0];

    for (let i = 0; i < 30; i++) {
        const dataISO = new Date(dataAtual.getTime() - (dataAtual.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        const agendamentosDoDia = await buscarAgendamentosDoDia(profissionalUid, dataISO);
        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataISO,
            agendamentosDoDia,
            professionalData.horarios,
            servicoParaTeste.duracao
        );

        if (slotsDisponiveis.length > 0) {
            return dataISO;
        }

        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    const hoje = new Date();
    return new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}
