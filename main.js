// main.js
import { iniciarAuthListener, fazerLogin, fazerLogout, currentUser } from './vitrini-auth.js';
import { buscarEExibirAgendamentos, salvarAgendamento } from './vitrini-agendamento.js';
import { renderizarAgendamentosComoCards } from './vitrini-ui.js';

const profissionalUid = 'profissional-uid-aqui'; // substitua conforme sua lógica real

function atualizarUIparaUsuario(user) {
    const userInfo = document.getElementById('user-info');
    if (user) {
        userInfo.textContent = `Olá, ${user.displayName}`;
    } else {
        userInfo.textContent = 'Você não está logado.';
    }
    buscarEExibirAgendamentos(profissionalUid, 'ativos', renderizarAgendamentosComoCards);
}

document.getElementById('btn-login').addEventListener('click', fazerLogin);
document.getElementById('btn-logout').addEventListener('click', fazerLogout);

iniciarAuthListener(atualizarUIparaUsuario);

document.getElementById('btn-confirmar-agendamento').addEventListener('click', () => {
    const data = document.getElementById('input-data').value;
    const horario = document.getElementById('input-horario').value;
    const servico = { id: 'serv1', nome: 'Corte de cabelo', duracao: 30, preco: 50 };
    salvarAgendamento(profissionalUid, { data, horario, servico });
});
