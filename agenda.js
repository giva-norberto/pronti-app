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
  const listaCancelamentosPendentes = document.getElementById("lista-cancelamentos-pendentes"); // Novo elemento
  const inputData = document.getElementById("data-agenda");
  
  let currentUid = null;

  function formatarHorario(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "Data/hora inválida";
    const data = timestamp.toDate();
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }

  // Carrega apenas agendamentos ATIVOS
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
        where("status", "==", "agendado"), // <-- Busca apenas status 'agendado'
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

  // NOVA FUNÇÃO: Carrega os cancelamentos PENDENTES
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

  // NOVA FUNÇÃO: Renderiza a lista de cancelamentos pendentes
  function renderizarCancelamentosPendentes(cancelamentos) {
    listaCancelamentosPendentes.innerHTML = "";
    cancelamentos.sort((a, b) => a.canceladoEm.toDate() - b.canceladoEm.toDate());

    cancelamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item cancelado"; // Adiciona uma classe para estilização
        const dataCancelamento = ag.canceladoEm.toDate().toLocaleString('pt-BR');

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

    // Adiciona listener para os novos botões
    document.querySelectorAll('.btn-confirmar-exclusao').forEach(button => {
        button.addEventListener('click', (event) => {
            const agendamentoId = event.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir este registro permanentemente?')) {
                excluirAgendamentoDefinitivamente(agendamentoId, currentUid);
            }
        });
    });
  }
  
  // NOVA FUNÇÃO: Deleta o documento do Firebase
  async function excluirAgendamentoDefinitivamente(agendamentoId, uid) {
      try {
          const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
          await deleteDoc(agendamentoRef);
          alert("Registro de cancelamento removido com sucesso.");
          // Recarrega ambas as listas para atualizar a tela
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
      
      // Carrega ambas as listas quando a página abre
      carregarAgendamentos(user.uid);
      carregarCancelamentosPendentes(user.uid);

      if (inputData) {
        // Recarrega apenas a lista principal quando a data muda
        inputData.addEventListener("change", () => carregarAgendamentos(user.uid));
      }
    } else {
      window.location.href = 'login.html';
    }
  });
});
