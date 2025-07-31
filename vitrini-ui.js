// vitrini-ui.js
import { cancelarAgendamento } from './vitrini-agendamento.js';
import { currentUser } from './vitrini-auth.js';

export function renderizarAgendamentosComoCards(agendamentos, modo = 'ativos') {
    const container = document.getElementById('lista-agendamentos-visualizacao');
    if (!container) return;
    if (agendamentos.length === 0) {
        container.innerHTML = `<p>Não há agendamentos ${modo === 'ativos' ? 'ativos' : 'finalizados'}.</p>`;
        return;
    }

    container.innerHTML = agendamentos.map(ag => {
        const horarioStr = ag.horario.toDate().toLocaleString();
        let btnCancelar = '';
        if (modo === 'ativos' && ag.status === 'agendado' && currentUser?.uid === ag.clienteUid) {
            btnCancelar = `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>`;
        }
        return `
        <div class="agendamento-card">
            <p><strong>Serviço:</strong> ${ag.servicoNome}</p>
            <p><strong>Horário:</strong> ${horarioStr}</p>
            <p><strong>Status:</strong> ${ag.status}</p>
            ${btnCancelar}
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', () => {
            cancelarAgendamento('profissional-uid-aqui', btn.dataset.id, (profissionalUid, modo) => {
                // você pode ajustar essa chamada para refletir seu código real de atualização
            });
        });
    });
}
