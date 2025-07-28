import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
  
  const db = getFirestore(app);
  const auth = getAuth(app);

  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const listaCancelamentosPendentes = document.getElementById("lista-cancelamentos-pendentes");
  const inputData = document.getElementById("data-agenda");
  
  let currentUid = null;

  function formatarHorario(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "Data/hora inválida";
    const data = timestamp.toDate();
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); // horario local
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
    agendamentos.forEach(({ servicoNome, clienteNome, horario }) => {
      const div = document.createElement("div");
      div.className = "agendamento-item";
      div.innerHTML = `
        <h3>${servicoNome || 'Serviço não informado'}</h3>
        <p><strong>Cliente:</strong> ${clienteNome || 'Não informado'}</p>
        <p><strong>Horário:</strong> ${formatarHorario(horario)}</p>
      `;
      listaAgendamentos.appendChild(div);
    });
  }

  function renderizarCancelamentosPendentes(cancelamentos) {
    listaCancelamentosPendentes.innerHTML = "";
    cancelamentos.sort((a, b) => a.canceladoEm.toDate() - b.canceladoEm.toDate());

    cancelamentos.forEach(({ id, servicoNome, clienteNome, canceladoEm }) => {
        const div = document.createElement("div");
        div.className = "agendamento-item cancelado";
        const dataCancelamento = canceladoEm.toDate().toLocaleString('pt-BR');

        div.innerHTML = `
            <div>
                <h3>${servicoNome || 'Serviço não informado'}</h3>
                <p><strong>Cliente:</strong> ${clienteNome || 'Não informado'}</p>
                <p><strong>Cancelado em:</strong> ${dataCancelamento}</p>
            </div>
            <button class="btn-confirmar-exclusao" data-id="${id}">OK, Excluir Definitivamente</button>
        `;
        listaCancelamentosPendentes.appendChild(div);
    });
  }

  // Event delegation para os botões de exclusão definitiva
  listaCancelamentosPendentes.addEventListener('click', (event) => {
    if (event.target.classList.contains('btn-confirmar-exclusao')) {
      const agendamentoId = event.target.dataset.id;
      if (confirm('Tem certeza que deseja excluir este registro permanentemente?')) {
          excluirAgendamentoDefinitivamente(agendamentoId, currentUid);
      }
    }
  });

  async function excluirAgendamentoDefinitivamente(agendamentoId, uid) {
      try {
          const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
          await deleteDoc(agendamentoRef);
          alert("Registro de cancelamento removido com sucesso.");
          carregarAgendamentos(uid);
          carregarCancelamentosPendentes(uid);
      } catch (error) {
          console.error("Erro ao excluir agendamento:", error);
          alert("Não foi possível excluir o agendamento.");
      }
  }

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
