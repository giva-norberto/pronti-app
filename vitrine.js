import { auth, provider } from './vitrini-firebase.js';
import { currentUser, iniciarAuthListener, fazerLogin as login, fazerLogout as logout } from './vitrini-auth.js';
import { 
  getSlugFromURL, 
  getProfissionalUidBySlug, 
  getDadosProfissional 
} from './vitrini-profissionais.js';

import { 
  buscarEExibirAgendamentos, 
  salvarAgendamento, 
  cancelarAgendamento, 
  buscarAgendamentosDoDia, 
  calcularSlotsDisponiveis 
} from './vitrini-agendamento.js';

import { renderizarServicos, renderizarDadosProfissional } from './vitrini-ui.js';
import { showNotification } from './vitrini-utils.js';

let profissionalUid = null;
let dadosProfissional = null;
let agendamentoState = {
  data: null,
  horario: null,
  servico: null
};

async function init() {
  // Configura listener de autenticação
  iniciarAuthListener(updateUIOnAuthChange);

  // Pega slug da URL
  const slug = getSlugFromURL();
  if (!slug) {
    showNotification("URL inválida: slug do profissional não encontrado", true);
    return;
  }

  // Busca UID do profissional
  profissionalUid = await getProfissionalUidBySlug(slug);
  if (!profissionalUid) {
    showNotification("Profissional não encontrado", true);
    return;
  }

  // Busca dados e serviços do profissional
  const dados = await getDadosProfissional(profissionalUid);
  if (!dados) {
    showNotification("Falha ao carregar dados do profissional", true);
    return;
  }

  dadosProfissional = dados.dadosProfissional;

  // Renderiza dados do profissional (nome, foto, bio, etc)
  renderizarDadosProfissional(dadosProfissional);

  // Renderiza lista de serviços para o usuário escolher
  renderizarServicos(dados.servicos, selecionarServico);

  // Carrega agendamentos ativos do usuário
  if (currentUser) {
    buscarEExibirAgendamentos(profissionalUid, 'ativos');
  }

  // Eventos UI
  configurarEventos();
}

function selecionarServico(servico) {
  agendamentoState.servico = servico;
  showNotification(`Serviço selecionado: ${servico.nome}`);
}

function configurarEventos() {
  // Botão login
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) btnLogin.onclick = login;

  // Botão logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.onclick = logout;

  // Confirmar agendamento
  const btnConfirmar = document.getElementById('btn-confirmar-agendamento');
  if (btnConfirmar) btnConfirmar.onclick = async () => {
    const dataInput = document.getElementById('data-agendamento');
    const horarioInput = document.getElementById('horario-agendamento');

    if (!agendamentoState.servico) {
      showNotification("Selecione um serviço antes de agendar.", true);
      return;
    }

    if (!dataInput.value || !horarioInput.value) {
      showNotification("Preencha data e horário para agendar.", true);
      return;
    }

    agendamentoState.data = dataInput.value;
    agendamentoState.horario = horarioInput.value;

    await salvarAgendamento(profissionalUid, agendamentoState);
    buscarEExibirAgendamentos(profissionalUid, 'ativos');
  };

  // Cancelar agendamento
  const listaAgendamentos = document.getElementById('lista-agendamentos-visualizacao');
  if (listaAgendamentos) {
    listaAgendamentos.onclick = (e) => {
      if (e.target.classList.contains('btn-cancelar')) {
        const agendamentoId = e.target.getAttribute('data-id');
        cancelarAgendamento(profissionalUid, agendamentoId, buscarEExibirAgendamentos);
      }
    };
  }

  // Mudança na data de agendamento
  const dataInput = document.getElementById('data-agendamento');
  if (dataInput) {
    dataInput.onchange = async () => {
      if (!agendamentoState.servico) return;
      const dataSelecionada = dataInput.value;
      const agendamentosOcupados = await buscarAgendamentosDoDia(profissionalUid, dataSelecionada);
      const slotsLivres = calcularSlotsDisponiveis(dataSelecionada, agendamentosOcupados, dadosProfissional, agendamentoState);

      const horarioInput = document.getElementById('horario-agendamento');
      horarioInput.innerHTML = slotsLivres.length > 0
        ? slotsLivres.map(h => `<option value="${h}">${h}</option>`).join('')
        : '<option value="">Nenhum horário disponível</option>';
    };
  }
}

function updateUIOnAuthChange(user) {
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const agendamentoSection = document.getElementById('agendamento-section');

  if (user) {
    if (loginSection) loginSection.style.display = 'none';
    if (userSection) userSection.style.display = 'block';
    if (agendamentoSection) agendamentoSection.style.display = 'block';

    const nomeUsuario = document.getElementById('nome-usuario');
    if (nomeUsuario) nomeUsuario.textContent = user.displayName || user.email;

    if (profissionalUid) {
      buscarEExibirAgendamentos(profissionalUid, 'ativos');
    }
  } else {
    if (loginSection) loginSection.style.display = 'block';
    if (userSection) userSection.style.display = 'none';
    if (agendamentoSection) agendamentoSection.style.display = 'none';

    const listaAgendamentosVisualizacao = document.getElementById('lista-agendamentos-visualizacao');
    if (listaAgendamentosVisualizacao) listaAgendamentosVisualizacao.innerHTML = '';
  }
}

// Inicializa app
init();
