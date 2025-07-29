/**
 * agenda.js - Versão com opção de Reativar Cancelamentos
 */

import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
  
  const db = getFirestore(app);
  const auth = getAuth(app);

  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const listaCancelamentosPendentes = document.getElementById("lista-cancelamentos-pendentes");
  const inputData = document.getElementById("data-agenda");
  const dataExibida = document.getElementById("data-exibida");
  const modalConfirmacao = document.getElementById('modal-confirmacao');
  const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
  const btnFecharModal = modalConfirmacao.querySelector('.fechar-modal');

  let agendamentoParaExcluirId = null;
  let currentUid = null;

  function formatarHorario(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "Data/hora inválida";
    const data = timestamp.toDate();
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }
  
  function formatarDataCompleta(timestamp) {
      if (!timestamp || typeof timestamp.toDate !== 'function') return "Data inválida";
      return timestamp.toDate().toLocaleString('pt-BR', { timeZone: 'UTC' });
  }

  async function carregarAgendamentos(uid) {
    currentUid = uid;
    if (!listaAgendamentos) return;
    listaAgendamentos.innerHTML = "<p>Carregando...</p>";

    const dataSelecionada = inputData.value;
    if (!dataSelecionada) {
      listaAgendamentos.innerHTML = "<p>Selecione uma data para começar.</p>";
      dataExibida.textContent = '...';
      return;
    }
    const dataObj = new Date(dataSelecionada + "T00:00:00Z");
    dataExibida.textContent = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    try {
      const inicioDoDia = new Date(dataSelecionada + "T00:00:00.000Z");
      const fimDoDia = new Date(dataSelecionada + "T23:59:59.999Z");
      const colecao = collection(db, `users/${uid}/agendamentos`);
      const q = query(colecao,
        where("status", "==", "agendado"),
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia))
      );

      const snapshot = await getDocs(q);
      const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderizarAgendamentos(agendamentos);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      listaAgendamentos.innerHTML = '<p>Ocorreu um erro ao carregar os agendamentos.</p>';
    }
  }

  async function carregarCancelamentosPendentes(uid) {
    if (!listaCancelamentosPendentes) return;
    listaCancelamentosPendentes.innerHTML = "<p>Verificando solicitações...</p>";

    try {
        const colecao = collection(db, `users/${uid}/agendamentos`);
        const q = query(colecao, where("status", "==", "cancelamento_solicitado"));
        const snapshot = await getDocs(q);
        const cancelamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarCancelamentosPendentes(cancelamentos);
    } catch (error) {
        console.error("Erro ao carregar solicitações de cancelamento:", error);
        listaCancelamentosPendentes.innerHTML = "<p>Erro ao carregar solicitações.</p>";
    }
  }

  function renderizarAgendamentos(agendamentos) {
    listaAgendamentos.innerHTML = "";
    if (agendamentos.length === 0) {
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado para esta data.</p>`;
      return;
    }
    agendamentos.sort((a, b) => a.horario.toDate() - b.horario.toDate());
    agendamentos.forEach(ag => {
      const div = document.createElement("div");
      div.className = "agendamento-item";
      div.innerHTML = `
        <h3>${ag.servicoNome || 'Serviço não informado'}</h3>
        <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p>
        <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
      `;
      listaAgendamentos.appendChild(div);
    });
  }

  function renderizarCancelamentosPendentes(cancelamentos) {
    if (cancelamentos.length === 0) {
      listaCancelamentosPendentes.innerHTML = `<p>Nenhuma solicitação de cancelamento encontrada.</p>`;
      return;
    }

    listaCancelamentosPendentes.innerHTML = "";
    cancelamentos.sort((a, b) => (a.canceladoEm && b.canceladoEm) ? a.canceladoEm.toDate() - b.canceladoEm.toDate() : 0);

    cancelamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item cancelamento-pendente";
        const dataCancelamento = ag.canceladoEm ? formatarDataCompleta(ag.canceladoEm) : 'Data desconhecida';

        div.innerHTML = `
            <div>
                <h3>${ag.servicoNome || 'Serviço não informado'}</h3>
                <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p>
                <p><strong>Horário Original:</strong> ${formatarDataCompleta(ag.horario)}</p>
                <p class="data-cancelamento"><strong>Solicitado em:</strong> ${dataCancelamento}</p>
            </div>
            <div class="botoes-pendentes">
                <button class="btn-reativar" data-id="${ag.id}">Reativar</button>
                <button class="btn-confirmar-exclusao" data-id="${ag.id}">Excluir</button>
            </div>
        `;
        listaCancelamentosPendentes.appendChild(div);
    });
  }
  
  async function excluirAgendamentoDefinitivamente(agendamentoId, uid) {
      try {
          const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
          await deleteDoc(agendamentoRef);
          Toastify({ text: "Registro removido com sucesso!", duration: 3000, backgroundColor: "#22c55e" }).showToast();
          carregarCancelamentosPendentes(uid);
      } catch (error) {
          console.error("Erro ao excluir agendamento:", error);
          Toastify({ text: "Erro ao remover registro.", duration: 3000, backgroundColor: "#ef4444" }).showToast();
      } finally {
          fecharModalConfirmacao();
      }
  }

  async function reativarAgendamento(agendamentoId, uid) {
      try {
          const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
          await updateDoc(agendamentoRef, {
              status: 'agendado',
              canceladoEm: null,
              canceladoPor: null
          });
          Toastify({ text: "Agendamento reativado com sucesso!", duration: 3000, backgroundColor: "#22c55e" }).showToast();
          carregarAgendamentos(uid);
          carregarCancelamentosPendentes(uid);
      } catch (error) {
          console.error("Erro ao reativar agendamento:", error);
          Toastify({ text: "Erro ao reativar.", duration: 3000, backgroundColor: "#ef4444" }).showToast();
      }
  }

  function fecharModalConfirmacao() {
    if (modalConfirmacao) modalConfirmacao.style.display = 'none';
    agendamentoParaExcluirId = null;
  }
  
  if (btnModalConfirmar) {
    btnModalConfirmar.addEventListener('click', () => {
      if (agendamentoParaExcluirId && currentUid) {
        excluirAgendamentoDefinitivamente(agendamentoParaExcluirId, currentUid);
      }
    });
  }
  if(btnFecharModal) {
    btnFecharModal.addEventListener('click', fecharModalConfirmacao);
  }

  // Event delegation para os botões de ação na lista de pendentes
  listaCancelamentosPendentes.addEventListener('click', (event) => {
      const target = event.target;
      const agendamentoId = target.dataset.id;
      if (!agendamentoId) return;

      if (target.classList.contains('btn-confirmar-exclusao')) {
          agendamentoParaExcluirId = agendamentoId;
          if (modalConfirmacao) modalConfirmacao.style.display = 'flex';
      } else if (target.classList.contains('btn-reativar')) {
          if (confirm('Tem certeza que deseja reativar este agendamento?')) {
              reativarAgendamento(agendamentoId, currentUid);
          }
      }
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (inputData && !inputData.value) {
        const hoje = new Date();
        hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
        inputData.value = hoje.toISOString().split("T")[0];
      }
      
      carregarAgendamentos(user.uid);
      carregarCancelamentosPendentes(user.uid);

      if (inputData) {
        inputData.addEventListener("change", () => carregarAgendamentos(user.uid));
      }
    } else {
      window.location.href = 'login.html';
    }
  });
});
