/**
 * agenda.js - Versão Final e Comentada
 * O objetivo foi manter 100% da lógica original e apenas corrigir o bug do botão de cancelar.
 */

// Importações do Firebase (sua configuração original)
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

// CORREÇÃO TÉCNICA: Envolve todo o script para garantir que o HTML esteja pronto.
// Isso não altera nenhuma função, apenas quando elas começam a rodar.
document.addEventListener("DOMContentLoaded", () => {
  
  // Bloco de inicialização (sua configuração original)
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Elementos do DOM (sua configuração original)
  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const inputData = document.getElementById("data-agenda");
  const modalConfirmacao = document.getElementById('modal-confirmacao');
  const btnModalCancelar = document.getElementById('btn-modal-cancelar');
  const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
  
  // Variáveis de estado (sua configuração original)
  let agendamentoParaCancelarId = null;
  let currentUid = null;

  // --- SUAS FUNÇÕES ORIGINAIS (100% MANTIDAS) ---

  // SUA FUNÇÃO ORIGINAL: para formatar a data e hora
  function formatarHorario(dataIso) {
    if (!dataIso) return "Horário inválido";
    const data = new Date(dataIso);
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // SUA FUNÇÃO ORIGINAL: para carregar os dados do Firebase
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
      const colecao = collection(db, `users/${uid}/agendamentos`);
      const snapshot = await getDocs(colecao);
      const agendamentos = [];

      for (const docAg of snapshot.docs) {
        const ag = docAg.data();
        if (!ag.horario) continue;
        const dataAgFormatada = new Date(ag.horario).toISOString().split("T")[0];

        // Lógica de filtro e busca de serviço (sua configuração original)
        if (dataAgFormatada === dataSelecionada && ag.status !== 'cancelado') {
          ag.id = docAg.id;
          const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId || 'default'}`));
          ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço Avulso";
          agendamentos.push(ag);
        }
      }
      // Chama a função de renderização (lógica original)
      renderizarAgendamentos(agendamentos);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
    }
  }

  // FUNÇÃO DE APOIO (lógica original de exibição)
  function renderizarAgendamentos(agendamentos) {
    listaAgendamentos.innerHTML = "";
    if (agendamentos.length === 0) {
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado.</p>`;
      return;
    }
    
    // Ordenação (sua lógica original)
    agendamentos.sort((a, b) => new Date(a.horario) - new Date(b.horario));

    agendamentos.forEach(ag => {
      const div = document.createElement("div");
      div.className = "agendamento-item";
      // Renderização do item com o botão (lógica original + correção do botão)
      div.innerHTML = `
        <h3>${ag.servicoNome}</h3>
        <p><strong>Cliente:</strong> ${ag.cliente}</p>
        <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
        <button class="btn-cancelar-agendamento" data-id="${ag.id}">Cancelar Agendamento</button>
      `;
      listaAgendamentos.appendChild(div);
    });

    // Adiciona o listener para o botão de cancelar
    document.querySelectorAll('.btn-cancelar-agendamento').forEach(button => {
      button.addEventListener('click', (event) => {
        agendamentoParaCancelarId = event.target.dataset.id;
        // CORREÇÃO DO BUG: usa a classe '.visivel' para ser compatível com seu CSS
        if (modalConfirmacao) modalConfirmacao.classList.add('visivel');
      });
    });
  }

  // --- FUNÇÕES NOVAS (APENAS PARA O PROCESSO DE CANCELAMENTO) ---

  // Função para executar o cancelamento no Firebase
  async function cancelarAgendamentoFirebase(agendamentoId, uid) {
    try {
      const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
      await updateDoc(agendamentoRef, { status: 'cancelado' });
      Toastify({ text: "Agendamento cancelado!", duration: 3000, backgroundColor: "#22c55e" }).showToast();
      carregarAgendamentos(uid);
    } catch (error) {
      console.error("Erro ao cancelar no Firebase:", error);
      Toastify({ text: "Erro ao cancelar.", duration: 3000, backgroundColor: "#ef4444" }).showToast();
    } finally {
      fecharModalConfirmacao();
    }
  }

  // Função para fechar o modal
  function fecharModalConfirmacao() {
    // CORREÇÃO DO BUG: usa a classe '.visivel' para ser compatível com seu CSS
    if (modalConfirmacao) modalConfirmacao.classList.remove('visivel');
    agendamentoParaCancelarId = null;
  }

  // --- INICIALIZAÇÃO E EVENTOS ---

  // Listeners para os botões do modal
  if (btnModalCancelar && btnModalConfirmar) {
    btnModalCancelar.addEventListener('click', fecharModalConfirmacao);
    btnModalConfirmar.addEventListener('click', () => {
      if (agendamentoParaCancelarId && currentUid) {
        cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
      }
    });
  }

  // Ponto de entrada (sua lógica de autenticação original)
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (inputData && !inputData.value) {
        const hoje = new Date();
        hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
        inputData.value = hoje.toISOString().split("T")[0];
      }
      carregarAgendamentos(user.uid);
      inputData.addEventListener("change", () => carregarAgendamentos(user.uid));
    } else {
      window.location.href = 'login.html';
    }
  });
});
