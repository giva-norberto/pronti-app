/**
 * agenda.js (VERSÃO FINAL - GERENCIAMENTO DE EMPRESA)
 * Corrigido para Firestore modular v10+!
 * - Descobre empresaId do usuário logado (dono)
 * - Busca e exibe agendamentos e cancelamentos da subcoleção correta
 * - Renderização dos cards com nome do profissional
 * - Notificações via showAlert/showCustomConfirm
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
// [MODIFICADO] Importamos as novas funções de modal
import { showAlert, showCustomConfirm } from "./vitrini-utils.js"; 

document.addEventListener("DOMContentLoaded", () => {
  
  // Modular Firebase inicialização
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // --- Elementos do DOM ---
  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const listaCancelamentosPendentes = document.getElementById("lista-cancelamentos-pendentes");
  const inputData = document.getElementById("data-agenda");
  const dataExibida = document.getElementById("data-exibida");

  // --- Variáveis de Estado ---
  let currentUid = null;
  let currentEmpresaId = null; // [NOVO] Guardará o ID da empresa do dono

  // --- Funções Utilitárias (Mantidas) ---
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
   * [NOVO] Busca o ID da empresa com base no ID do dono.
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
   * [MODIFICADO] Carrega os agendamentos da EMPRESA para um dia específico.
   * @param {string} empresaId - O ID da empresa.
   */
  async function carregarAgendamentos(empresaId) {
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
        
        // [MODIFICADO] A busca agora é na subcoleção da empresa
        const colecao = collection(db, "empresarios", empresaId, "agendamentos");
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
        listaAgendamentos.innerHTML = '<p>Ocorreu um erro ao carregar os agendamentos. Verifique suas regras de segurança do Firestore.</p>';
    }
  }
  
  /**
   * [MODIFICADO] Carrega os cancelamentos pendentes da EMPRESA.
   * @param {string} empresaId - O ID da empresa.
   */
  async function carregarCancelamentosPendentes(empresaId) {
    if (!empresaId || !listaCancelamentosPendentes) return;
    listaCancelamentosPendentes.innerHTML = "<p>Verificando solicitações...</p>";

    try {
        // [MODIFICADO] A busca agora é na subcoleção da empresa
        const colecao = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(colecao, where("status", "==", "cancelado_pelo_cliente")); // Ajustado o status
        const snapshot = await getDocs(q);
        const cancelamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarCancelamentosPendentes(cancelamentos);
    } catch (error) {
        console.error("Erro ao carregar solicitações de cancelamento:", error);
        listaCancelamentosPendentes.innerHTML = "<p>Erro ao carregar solicitações.</p>";
    }
  }

  /**
   * [MODIFICADO] Renderiza os agendamentos mostrando o profissional.
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
        // [MODIFICADO] Adicionado nome do profissional
        div.innerHTML = `
          <h3>${ag.servicoNome || 'Serviço não informado'}</h3>
          <p><strong>Profissional:</strong> ${ag.profissionalNome || 'Não informado'}</p>
          <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p> 
          <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
        `;
        listaAgendamentos.appendChild(div);
    });
  }

  /**
   * [MODIFICADO] Renderiza os cancelamentos mostrando o profissional.
   * @param {Array} cancelamentos - Lista de solicitações de cancelamento.
   */
  function renderizarCancelamentosPendentes(cancelamentos) {
    if (!listaCancelamentosPendentes) return;
    listaCancelamentosPendentes.innerHTML = "";
    if (cancelamentos.length === 0) {
      listaCancelamentosPendentes.innerHTML = "<p>Nenhuma solicitação de cancelamento pendente.</p>";
      return;
    }
    cancelamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item cancelamento-pendente";
        // [MODIFICADO] Adicionado nome do profissional
        div.innerHTML = `
            <div>
                <h3>${ag.servicoNome || 'Serviço não informado'}</h3>
                <p><strong>Profissional:</strong> ${ag.profissionalNome || 'Não informado'}</p>
                <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p>
                <p><strong>Horário Original:</strong> ${formatarDataCompleta(ag.horario)}</p>
            </div>
            <div class="botoes-pendentes">
                <button class="btn-reativar" data-id="${ag.id}">Reativar</button>
                <button class="btn-confirmar-exclusao" data-id="${ag.id}">Excluir</button>
            </div>
        `;
        listaCancelamentosPendentes.appendChild(div);
    });
  }
  
  /**
   * [MODIFICADO] Exclui um agendamento da EMPRESA.
   * @param {string} agendamentoId - ID do agendamento.
   * @param {string} empresaId - ID da empresa.
   */
  async function excluirAgendamentoDefinitivamente(agendamentoId, empresaId) {
      try {
          // [MODIFICADO] Caminho do documento
          const agendamentoRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
          await deleteDoc(agendamentoRef);
          await showAlert("Sucesso", "Registro removido com sucesso!");
          carregarCancelamentosPendentes(empresaId);
      } catch (error) {
          console.error("Erro ao excluir agendamento:", error);
          await showAlert("Erro", "Erro ao remover registro.");
      }
  }

  /**
   * [MODIFICADO] Reativa um agendamento da EMPRESA.
   * @param {string} agendamentoId - ID do agendamento.
   * @param {string} empresaId - ID da empresa.
   */
  async function reativarAgendamento(agendamentoId, empresaId) {
      try {
          // [MODIFICADO] Caminho do documento
          const agendamentoRef = doc(db, "empresarios", empresaId, "agendamentos", agendamentoId);
          await updateDoc(agendamentoRef, { status: 'agendado' });
          await showAlert("Sucesso", "Agendamento reativado com sucesso!");
          carregarAgendamentos(empresaId);
          carregarCancelamentosPendentes(empresaId);
      } catch (error) {
          console.error("Erro ao reativar agendamento:", error);
          await showAlert("Erro", "Erro ao reativar.");
      }
  }

  // --- Lógica de Eventos ---
  if (listaCancelamentosPendentes) {
    listaCancelamentosPendentes.addEventListener('click', async (event) => {
        const target = event.target;
        const agendamentoId = target.dataset.id;
        if (!agendamentoId || !currentEmpresaId) return;

        if (target.classList.contains('btn-confirmar-exclusao')) {
            const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir permanentemente este registro? Esta ação não pode ser desfeita.");
            if (confirmado) {
                excluirAgendamentoDefinitivamente(agendamentoId, currentEmpresaId);
            }
        } else if (target.classList.contains('btn-reativar')) {
            const confirmado = await showCustomConfirm("Confirmar Reativação", "Tem certeza que deseja reativar este agendamento?");
            if (confirmado) {
                reativarAgendamento(agendamentoId, currentEmpresaId);
            }
        }
    });
  }

  // --- INICIALIZAÇÃO DA PÁGINA ---
  onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUid = user.uid;
        // [MODIFICADO] Descobre a empresa do usuário antes de carregar os dados
        currentEmpresaId = await getEmpresaIdDoDono(currentUid);
        
        if (currentEmpresaId) {
            if (inputData && !inputData.value) {
                const hoje = new Date();
                hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
                inputData.value = hoje.toISOString().split("T")[0];
            }
            
            carregarAgendamentos(currentEmpresaId);
            carregarCancelamentosPendentes(currentEmpresaId);

            if (inputData) {
                inputData.addEventListener("change", () => carregarAgendamentos(currentEmpresaId));
            }
        } else {
             // Opcional: Mostrar uma mensagem se o usuário não for dono de nenhuma empresa
             if(listaAgendamentos) listaAgendamentos.innerHTML = "<p>Você não parece ser o dono de nenhuma empresa cadastrada.</p>"
        }
    } else {
        window.location.href = 'login.html';
    }
  });
});
