/**
 * agenda.js (VERSÃO FINAL - GERENCIAMENTO DE EMPRESA)
 * Corrigido para Firestore modular v10+!
 * - Descobre empresaId do usuário logado (dono)
 * - Busca e exibe agendamentos da subcoleção correta
 * - Renderização dos cards com nome do profissional, serviço e cliente
 * - Mostra apenas agendamentos ativos e com horário igual ou posterior ao atual
 * - Se não houver agendamentos futuros no dia, mostra próximo dia com agendamento futuro
 * - Notificações via showAlert/showCustomConfirm
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { showAlert, showCustomConfirm } from "./vitrini-utils.js"; 

document.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // --- Elementos do DOM ---
  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const inputData = document.getElementById("data-agenda");
  const dataExibida = document.getElementById("data-exibida");

  // --- Variáveis de Estado ---
  let currentUid = null;
  let currentEmpresaId = null;

  // --- Funções Utilitárias ---
  function formatarHorario(timestamp) {
    if (!timestamp) return "-";
    const data = timestamp.toDate();
    return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  }
  function formatarDataCompleta(timestamp) {
    if (!timestamp) return "-";
    const data = timestamp.toDate();
    return `${data.toLocaleDateString()} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  }

  /**
   * Busca o ID da empresa com base no ID do dono.
   * @param {string} uid - O UID do usuário logado.
   * @returns {Promise<string|null>} O ID da empresa ou nulo.
   */
  async function getEmpresaIdDoDono(uid) {
    const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(empresQ);
    if (snapshot.empty) {
        console.error("Nenhuma empresa encontrada para este dono.");
        return null;
    }
    return snapshot.docs[0].id;
  }

  /**
   * Busca a próxima data com agendamentos ativos e horário futuro.
   * @param {string} empresaId
   * @returns {Promise<string|null>} Data no formato 'YYYY-MM-DD' ou null
   */
  async function encontrarProximaDataComAgendamentos(empresaId) {
    const hoje = new Date();
    for (let i = 0; i < 30; i++) { // procura nos próximos 30 dias
      const dataAtual = new Date(hoje);
      dataAtual.setDate(hoje.getDate() + i);
      const dataString = dataAtual.toISOString().split('T')[0];
      const inicioDoDia = new Date(`${dataString}T00:00:00.000Z`);
      const fimDoDia = new Date(`${dataString}T23:59:59.999Z`);
      const colecao = collection(db, "empresarios", empresaId, "agendamentos");
      const q = query(colecao,
        where("status", "==", "agendado"),
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia))
      );
      const snapshot = await getDocs(q);
      const agora = new Date();
      const futuros = snapshot.docs.filter(doc => doc.data().horario.toDate() >= agora);
      if (futuros.length > 0) {
        return dataString;
      }
    }
    return null;
  }

  /**
   * Carrega os agendamentos ativos da EMPRESA para a data selecionada,
   * mostrando apenas os agendamentos com horário igual ou posterior ao atual.
   * Se não houver, mostra o próximo dia com agendamento futuro.
   * @param {string} empresaId - O ID da empresa.
   */
  async function carregarOuAvancarAgendamentos(empresaId) {
    if (!empresaId || !listaAgendamentos) return;
    listaAgendamentos.innerHTML = "<p>Carregando...</p>";

    const dataSelecionada = inputData.value;
    if (!dataSelecionada) {
      listaAgendamentos.innerHTML = "<p>Selecione uma data para visualizar os agendamentos.</p>";
      return;
    }

    try {
      const inicioDoDia = new Date(`${dataSelecionada}T00:00:00.000Z`);
      const fimDoDia = new Date(`${dataSelecionada}T23:59:59.999Z`);
      const colecao = collection(db, "empresarios", empresaId, "agendamentos");
      const q = query(colecao,
        where("status", "==", "agendado"),
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia))
      );
      const snapshot = await getDocs(q);
      const agora = new Date();
      const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const agendamentosFuturos = agendamentos.filter(ag => ag.horario.toDate() >= agora);

      if (agendamentosFuturos.length > 0) {
        renderizarAgendamentos(agendamentosFuturos);
      } else {
        const proximaData = await encontrarProximaDataComAgendamentos(empresaId);
        if (proximaData) {
          inputData.value = proximaData;
          await carregarOuAvancarAgendamentos(empresaId);
          showAlert("Aviso", `Não há horários ativos futuros para a data selecionada. Mostrando agendamentos do próximo dia disponível: ${proximaData}`);
        } else {
          listaAgendamentos.innerHTML = `<p>Nenhum agendamento ativo futuro encontrado nos próximos dias.</p>`;
        }
      }
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      listaAgendamentos.innerHTML = '<p>Ocorreu um erro ao carregar os agendamentos. Verifique suas regras de segurança do Firestore.</p>';
    }
  }
  
  /**
   * Renderiza os agendamentos mostrando o profissional, serviço e cliente.
   * @param {Array} agendamentos - Lista de agendamentos.
   */
  function renderizarAgendamentos(agendamentos) {
    if (!listaAgendamentos) return;
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
          <h3>${ag.servicoNome || ag.servicoDescricao || 'Serviço não informado'}</h3>
          <p><strong>Funcionário:</strong> ${ag.profissionalNome || 'Não informado'}</p>
          <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p> 
          <p><strong>Horário:</strong> ${formatarDataCompleta(ag.horario)}</p>
        `;
        listaAgendamentos.appendChild(div);
    });
  }

  /**
   * Exclui um agendamento da EMPRESA.
   * @param {string} agendamentoId - ID do agendamento.
   * @param {string} empresaId - ID da empresa.
   */
  async function excluirAgendamentoDefinitivamente(agendamentoId, empresaId) {
      try {
          const agendamentoRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
          await deleteDoc(agendamentoRef);
          await showAlert("Sucesso", "Registro removido com sucesso!");
          carregarOuAvancarAgendamentos(empresaId);
      } catch (error) {
          console.error("Erro ao excluir agendamento:", error);
          await showAlert("Erro", "Erro ao remover registro.");
      }
  }

  /**
   * Reativa um agendamento da EMPRESA.
   * @param {string} agendamentoId - ID do agendamento.
   * @param {string} empresaId - ID da empresa.
   */
  async function reativarAgendamento(agendamentoId, empresaId) {
      try {
          const agendamentoRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
          await updateDoc(agendamentoRef, { status: 'agendado' });
          await showAlert("Sucesso", "Agendamento reativado com sucesso!");
          carregarOuAvancarAgendamentos(empresaId);
      } catch (error) {
          console.error("Erro ao reativar agendamento:", error);
          await showAlert("Erro", "Erro ao reativar.");
      }
  }

  // --- INICIALIZAÇÃO DA PÁGINA ---
  onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUid = user.uid;
        currentEmpresaId = await getEmpresaIdDoDono(currentUid);
        
        if (currentEmpresaId) {
            if (inputData && !inputData.value) {
                const hoje = new Date();
                hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
                inputData.value = hoje.toISOString().split("T")[0];
            }
            carregarOuAvancarAgendamentos(currentEmpresaId);
            if (inputData) {
                inputData.addEventListener("change", () => carregarOuAvancarAgendamentos(currentEmpresaId));
            }
        } else {
             if(listaAgendamentos) listaAgendamentos.innerHTML = "<p>Você não parece ser o dono de nenhuma empresa cadastrada.</p>"
        }
    } else {
        window.location.href = 'login.html';
    }
  });
});
