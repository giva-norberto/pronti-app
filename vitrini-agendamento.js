// vitrini-agendamento.js (VERSÃO FINAL - MENSAGENS CORRIGIDAS)

import { db, collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc } from './vitrini-firebase.js';
import { showAlert } from './vitrini-utils.js';

export async function salvarAgendamento(profissionalUid, currentUser, agendamentoState) {
    if (!currentUser || !agendamentoState.servico || !agendamentoState.data || !agendamentoState.horario) {
        await showAlert("Atenção", "Dados insuficientes para agendar.");
        // Re-habilita o botão se a validação falhar
        const btn = document.getElementById('btn-confirmar-agendamento');
        if(btn) btn.disabled = false;
        return;
    }

    try {
        const dataHoraString = `${agendamentoState.data}T${agendamentoState.horario}:00`;
        const dataAgendamento = new Date(dataHoraString);

        const dadosAgendamento = {
            clienteUid: currentUser.uid, clienteNome: currentUser.displayName, clienteEmail: currentUser.email,
            servicoId: agendamentoState.servico.id, servicoNome: agendamentoState.servico.nome,
            servicoDuracao: agendamentoState.servico.duracao, servicoPreco: agendamentoState.servico.preco,
            horario: Timestamp.fromDate(dataAgendamento), status: 'agendado'
        };

        await addDoc(collection(db, "users", profissionalUid, "agendamentos"), dadosAgendamento);
        await showAlert("Sucesso!", "Seu agendamento foi realizado com sucesso.");
        location.reload();

    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        await showAlert("Erro", "Falha ao realizar o agendamento. Tente novamente.");
        const btn = document.getElementById('btn-confirmar-agendamento');
        if(btn) btn.disabled = false;
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
        renderizarAgendamentosComoCards(agendamentosFiltrados, modo);
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        listaEl.innerHTML = '<p>Ocorreu um erro ao buscar os seus agendamentos.</p>';
    }
}

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
        let statusExibido = (modo !== 'ativos' && ag.status === 'agendado') ? 'Concluído' : ag.status.replace('_', ' ');
        return `
        <div class="agendamento-card status-${ag.status}">
            <div class="agendamento-info"><h4>${ag.servicoNome}</h4><p><strong>Data:</strong> ${horarioStr}</p><p><strong>Status:</strong> ${statusExibido}</p></div>
            <div class="agendamento-acao">${btnCancelar}</div>
        </div>`;
    }).join('');
}

export async function cancelarAgendamento(profissionalUid, agendamentoId, callback) {
    try {
        const agendamentoRef = doc(db, "users", profissionalUid, "agendamentos", agendamentoId);
        await updateDoc(agendamentoRef, { status: 'cancelado_pelo_cliente' });
        await showAlert("Sucesso", "Agendamento cancelado com sucesso.");
        if (callback) callback();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        await showAlert("Erro", "Ocorreu um erro ao cancelar. Tente novamente.");
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
    if (!horariosConfig) { return []; }
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
            const slotOcupado = agendamentosOcupados.some(ag => horarioAtual < ag.fim && fimDoSlotProposto > ag.inicio);
            if (!slotOcupado && horarioAtual > agora) {
                slots.push(horarioAtual.toTimeString().substring(0, 5));
            }
            horarioAtual = new Date(horarioAtual.getTime() + intervalo * 60000);
        }
    });
    return slots;
}

// ESTA É A FUNÇÃO COM O BUG DA DATA. A VERSÃO CORRIGIDA ESTÁ NO FINAL DA CONVERSA.
export async function encontrarPrimeiraDataComSlots(profissionalUid, professionalData) {
    if (!professionalData?.horarios || !professionalData?.servicos || professionalData.servicos.length === 0) {
        const hoje = new Date();
        return new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    let dataAtual = new Date();
    const servicoParaTeste = professionalData.servicos[0]; // O BUG ESTÁ AQUI
    for (let i = 0; i < 30; i++) {
        const dataISO = new Date(dataAtual.getTime() - (dataAtual.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const agendamentosDoDia = await buscarAgendamentosDoDia(profissionalUid, dataISO);
        const slotsDisponiveis = calcularSlotsDisponiveis(
            dataISO, agendamentosDoDia, professionalData.horarios, servicoParaTeste.duracao
        );
        if (slotsDisponiveis.length > 0) {
            return dataISO;
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    const hoje = new Date();
    return new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}
