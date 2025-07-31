// vitrini-agendamento.js
import { db } from './vitrini-firebase.js';
import { currentUser } from './vitrini-auth.js';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { showNotification } from './vitrini-utils.js';

export async function buscarEExibirAgendamentos(profissionalUid, modo = 'ativos', renderizarAgendamentosComoCards) {
    if (!currentUser) {
        const agendamentosPrompt = document.getElementById('agendamentos-login-prompt');
        const agendamentosLista = document.getElementById('lista-agendamentos-visualizacao');
        if(agendamentosPrompt) agendamentosPrompt.style.display = 'block';
        if(agendamentosLista) agendamentosLista.innerHTML = '';
        return;
    }

    const listaAgendamentosVisualizacao = document.getElementById('lista-agendamentos-visualizacao');
    listaAgendamentosVisualizacao.innerHTML = '<p>Buscando seus agendamentos...</p>';
    
    try {
        const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("clienteUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listaAgendamentosVisualizacao.innerHTML = '<p>Você ainda não tem agendamentos.</p>';
            return;
        }

        const agora = new Date();
        const todosAgendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const agendamentosFiltrados = (modo === 'ativos')
            ? todosAgendamentos.filter(ag => ag.horario.toDate() >= agora).sort((a, b) => a.horario.toMillis() - b.horario.toMillis())
            : todosAgendamentos.filter(ag => ag.horario.toDate() < agora).sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
        
        renderizarAgendamentosComoCards(agendamentosFiltrados, modo);

    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        listaAgendamentosVisualizacao.innerHTML = '<p>Ocorreu um erro ao buscar os agendamentos.</p>';
    }
}

export async function salvarAgendamento(profissionalUid, agendamentoState) {
    if (!currentUser) {
        showNotification("Você precisa estar logado para agendar.", true);
        return;
    }
    const btnConfirmar = document.getElementById('btn-confirmar-agendamento');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Salvando...';

    const [hora, minuto] = agendamentoState.horario.split(':').map(Number);
    const dataAgendamento = new Date(agendamentoState.data + "T00:00:00");
    dataAgendamento.setHours(hora, minuto);

    const dadosAgendamento = {
        clienteUid: currentUser.uid,
        clienteNome: currentUser.displayName,
        clienteEmail: currentUser.email,
        clienteTelefone: document.getElementById('telefone-cliente').value,
        servicoId: agendamentoState.servico.id,
        servicoNome: agendamentoState.servico.nome,
        servicoDuracao: agendamentoState.servico.duracao,
        servicoPreco: agendamentoState.servico.preco,
        horario: Timestamp.fromDate(dataAgendamento),
        status: 'agendado'
    };
    
    try {
        await addDoc(collection(db, "users", profissionalUid, "agendamentos"), dadosAgendamento);
        showNotification("Agendamento realizado com sucesso!");
        setTimeout(() => {
            const btnMenu = document.querySelector('.menu-btn[data-menu="visualizacao"]');
            if (btnMenu) btnMenu.click();
        }, 1500);
    } catch (error) {
        showNotification("Falha ao agendar.", true);
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Agendamento';
    }
}

export async function cancelarAgendamento(profissionalUid, id, buscarEExibirAgendamentos) {
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
        try {
            await updateDoc(doc(db, "users", profissionalUid, "agendamentos", id), {
                status: 'cancelado_pelo_cliente'
            });
            showNotification("Agendamento cancelado.");
            buscarEExibirAgendamentos(profissionalUid, 'ativos');
        } catch (error) {
            showNotification("Erro ao cancelar.", true);
        }
    }
}

export async function buscarAgendamentosDoDia(profissionalUid, dataString) {
    const inicioDoDia = Timestamp.fromDate(new Date(dataString + 'T00:00:00'));
    const fimDoDia = Timestamp.fromDate(new Date(dataString + 'T23:59:59'));
    const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const ag = doc.data();
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (ag.servicoDuracao || 30) * 60000);
        return { inicio, fim };
    });
}

export function calcularSlotsDisponiveis(data, agendamentosOcupados, professionalData, agendamentoState) {
    const diaSemana = new Date(data + 'T00:00:00').getDay();
    const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
    const configDia = professionalData.horarios[nomeDia];
    if (!configDia || !configDia.ativo) return [];
    const horarios = [];
    const { intervalo = 30 } = professionalData.horarios;
    const duracaoServicoAtual = agendamentoState.servico.duracao;
    (configDia.blocos || []).forEach(bloco => {
        let horarioAtual = new Date(`${data}T${bloco.inicio}`);
        const fimDoBloco = new Date(`${data}T${bloco.fim}`);
        while (horarioAtual < fimDoBloco) {
            const fimDoSlotProposto = new Date(horarioAtual.getTime() + duracaoServicoAtual * 60000);
            if (fimDoSlotProposto > fimDoBloco) break;
            if (!agendamentosOcupados.some(ag => horarioAtual < ag.fim && fimDoSlotProposto > ag.inicio)) {
                horarios.push(horarioAtual.toTimeString().substring(0, 5));
            }
            horarioAtual = new Date(horarioAtual
