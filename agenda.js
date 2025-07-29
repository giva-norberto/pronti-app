/**
 * agenda.js - Versão com confirmação de cancelamento pelo empresário
 */

import { getFirestore, collection, query, where, getDocs, doc, updateDoc, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
  
  const db = getFirestore(app);
  const auth = getAuth(app);

  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const listaCancelamentosPendentes = document.getElementById("lista-cancelamentos-pendentes");
  const inputData = document.getElementById("data-agenda");
  const modalConfirmacao = document.getElementById('modal-confirmacao');
  const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
  const btnFecharModal = modalConfirmacao.querySelector('.fechar-modal'); // Adicionado para fechar no 'x'
  
  let agendamentoParaExcluirId = null;
  let currentUid = null;

  function formatarHorario(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "Data/hora inválida";
    const data = timestamp.toDate();
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }

  async function carregarAgendamentos(uid) {
    currentUid = uid;
    if (!listaAgendamentos) return;
    listaAgendamentos.innerHTML = "<p>Carregando...</p>";
    
    const dataSelecionada = inputData.value;
    if (!dataSelecionada) {
      listaAgendamentos.innerHTML = "<p>Selecione uma data para começar.</p>";
      return;
    }
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

        if (snapshot.empty) {
            listaCancelamentosPendentes.innerHTML = "<p>Nenhuma solicitação de cancelamento encontrada.</p>";
            return;
        }

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
    listaCancelamentosPendentes.innerHTML = "";
    cancelamentos.sort((a, b) => (a.canceladoEm && b.canceladoEm) ? a.canceladoEm.toDate() - b.canceladoEm.toDate() : 0);

    cancelamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item cancelado";
        const dataCancelamento = ag.canceladoEm ? ag.canceladoEm.toDate().toLocaleString('pt-BR') : 'Data desconhecida';

        div.innerHTML = `
            <div>
                <h3>${ag.servicoNome || 'Serviço não informado'}</h3>
                <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p>
                <p><strong>Cancelado em:</strong> ${dataCancelamento}</p>
            </div>
            <button class="btn-confirmar-exclusao" data-id="${ag.id}">OK, Excluir Definitivamente</button>
        `;
        listaCancelamentosPendentes.appendChild(div);
    });

    document.querySelectorAll('.btn-confirmar-exclusao').forEach(button => {
        button.addEventListener('click', (event) => {
            agendamentoParaExcluirId = event.target.dataset.id;
            if (modalConfirmacao) modalConfirmacao.style.display = 'flex';
        });
    });
  }
  
  async function excluirAgendamentoDefinitivamente(agendamentoId, uid) {
      try {
          const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
          await deleteDoc(agendamentoRef);
          Toastify({ text: "Registro removido com sucesso!", duration: 3000, backgroundColor: "#22c55e" }).showToast();
          carregarCancelamentosPendentes(uid); // Apenas recarrega a lista de pendentes
      } catch (error) {
          console.error("Erro ao excluir agendamento:", error);
          Toastify({ text: "Erro ao remover registro.", duration: 3000, backgroundColor: "#ef4444" }).showToast();
      } finally {
          fecharModalConfirmacao();
      }
  }

  function fecharModalConfirmacao() {
    if (modalConfirmacao) modalConfirmacao.style.display = 'none';
    agendamentoParaExcluirId = null;
  }
  
  // Eventos do Modal
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

  // Ponto de entrada
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
