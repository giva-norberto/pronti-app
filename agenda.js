/**
 * agenda.js - Versão Final e Corrigida
 * Lógica ajustada para ser compatível com o novo formato de dados (Timestamp)
 * e para usar queries mais eficientes do Firestore.
 */

// Importações do Firebase
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
  
  const db = getFirestore(app);
  const auth = getAuth(app);

  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const inputData = document.getElementById("data-agenda");
  const modalConfirmacao = document.getElementById('modal-confirmacao');
  const btnModalCancelar = document.getElementById('btn-modal-cancelar');
  const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
  
  let agendamentoParaCancelarId = null;
  let currentUid = null;

  // --- FUNÇÕES CORRIGIDAS E OTIMIZADAS ---

  // CORRIGIDO: Agora formata o objeto Timestamp do Firebase corretamente.
  function formatarHorario(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
      return "Data/hora inválida";
    }
    const data = timestamp.toDate(); // Converte o Timestamp para um objeto Date
    // Exibe apenas a hora, pois a data já foi selecionada no filtro
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // CORRIGIDO E OTIMIZADO: Agora filtra os agendamentos por data diretamente no Firebase.
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
      // Cria um intervalo de tempo para a consulta (do início ao fim do dia selecionado)
      const inicioDoDia = new Date(dataSelecionada + "T00:00:00");
      const fimDoDia = new Date(dataSelecionada + "T23:59:59");

      const colecao = collection(db, `users/${uid}/agendamentos`);
      
      // Cria a query para filtrar no Firebase (muito mais eficiente)
      const q = query(colecao, 
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia)),
        where("status", "!=", "cancelado")
      );

      const snapshot = await getDocs(q);
      const agendamentos = [];

      for (const docAg of snapshot.docs) {
        const ag = docAg.data();
        ag.id = docAg.id;
        
        // A busca pelo nome do serviço continua a mesma
        if (ag.servicoId) {
            const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
            ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço não encontrado";
        } else {
            ag.servicoNome = ag.servicoNome || "Serviço Avulso"; // Usa o nome salvo se não houver ID
        }
        agendamentos.push(ag);
      }
      
      renderizarAgendamentos(agendamentos);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      listaAgendamentos.innerHTML = "<p>Ocorreu um erro ao carregar os agendamentos.</p>";
    }
  }

  // CORRIGIDO: Ajustado para o novo formato de dados.
  function renderizarAgendamentos(agendamentos) {
    listaAgendamentos.innerHTML = "";
    if (agendamentos.length === 0) {
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado para esta data.</p>`;
      return;
    }
    
    // Ordena pelo Timestamp
    agendamentos.sort((a, b) => a.horario.toDate() - b.horario.toDate());

    agendamentos.forEach(ag => {
      const div = document.createElement("div");
      div.className = "agendamento-item";
      // Passa o Timestamp 'ag.horario' diretamente para a função de formatar
      div.innerHTML = `
        <h3>${ag.servicoNome}</h3>
        <p><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</p>
        <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
        <button class="btn-cancelar-agendamento" data-id="${ag.id}">Cancelar Agendamento</button>
      `;
      listaAgendamentos.appendChild(div);
    });

    document.querySelectorAll('.btn-cancelar-agendamento').forEach(button => {
      button.addEventListener('click', (event) => {
        agendamentoParaCancelarId = event.target.dataset.id;
        if (modalConfirmacao) modalConfirmacao.classList.add('visivel');
      });
    });
  }

  // --- SUAS FUNÇÕES ORIGINAIS (SEM ALTERAÇÕES NECESSÁRIAS) ---

  async function cancelarAgendamentoFirebase(agendamentoId, uid) {
    try {
      const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
      await updateDoc(agendamentoRef, { status: 'cancelado' });
      // Usando alert padrão para simplicidade, já que Toastify não foi importado
      alert("Agendamento cancelado!");
      carregarAgendamentos(uid);
    } catch (error) {
      console.error("Erro ao cancelar no Firebase:", error);
      alert("Erro ao cancelar o agendamento.");
    } finally {
      fecharModalConfirmacao();
    }
  }

  function fecharModalConfirmacao() {
    if (modalConfirmacao) modalConfirmacao.classList.remove('visivel');
    agendamentoParaCancelarId = null;
  }

  // --- INICIALIZAÇÃO E EVENTOS ---

  if (btnModalCancelar && btnModalConfirmar) {
    btnModalCancelar.addEventListener('click', fecharModalConfirmacao);
    btnModalConfirmar.addEventListener('click', () => {
      if (agendamentoParaCancelarId && currentUid) {
        cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (inputData && !inputData.value) {
        const hoje = new Date();
        hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
        inputData.value = hoje.toISOString().split("T")[0];
      }
      carregarAgendamentos(user.uid);
      if (inputData) {
        inputData.addEventListener("change", () => carregarAgendamentos(user.uid));
      }
    } else {
      window.location.href = 'login.html';
    }
  });
});
