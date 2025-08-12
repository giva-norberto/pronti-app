/**
 * agenda.js (Pronti - Agenda de Compromissos)
 * Corrigido para Firestore modular v10+
 * Visualização de agendamentos (ativos e futuros) com cards no padrão Pronti
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

  // --- Variáveis de Estado ---
  let currentUid = null;
  let currentEmpresaId = null;

  // --- Funções Utilitárias ---
  function formatarDataCompleta(timestamp) {
    if (!timestamp) return "-";
    const data = timestamp.toDate();
    return `${data.toLocaleDateString('pt-BR')} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  }

  /**
   * Busca o ID da empresa com base no ID do dono.
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
   * Busca a próxima data com agendamentos ativos e futuros.
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
   * Carrega agendamentos ativos e futuros da EMPRESA para a data selecionada.
   * Se não houver, mostra o próximo dia com agendamento futuro.
   */
  async function carregarOuAvancarAgendamentos(empresaId) {
    if (!empresaId || !listaAgendamentos) return;
    listaAgendamentos.innerHTML = `
      <div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
        <p>Carregando agendamentos...</p>
      </div>`;

    const dataSelecionada = inputData.value;
    if (!dataSelecionada) {
      listaAgendamentos.innerHTML = `
        <div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
          <p>Selecione uma data para ver os agendamentos.</p>
        </div>`;
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
          listaAgendamentos.innerHTML = `
            <div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
              <p>Nenhum agendamento ativo futuro encontrado nos próximos dias.</p>
            </div>`;
        }
      }
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      listaAgendamentos.innerHTML = `
        <div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
          <p>Ocorreu um erro ao carregar os agendamentos. Verifique suas regras de segurança do Firestore.</p>
        </div>`;
    }
  }
  
  /**
   * Renderiza os agendamentos com cards padrão Pronti.
   */
  function renderizarAgendamentos(agendamentos) {
    if (!listaAgendamentos) return;
    listaAgendamentos.innerHTML = "";
    if (agendamentos.length === 0) {
        listaAgendamentos.innerHTML = `
          <div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
            <p>Nenhum agendamento encontrado para esta data.</p>
          </div>`;
        return;
    }
    agendamentos.sort((a, b) => a.horario.toDate() - b.horario.toDate());
    agendamentos.forEach(ag => {
        const card = document.createElement("div");
        card.className = "card-agendamento";
        card.style = "background:#fff;border-radius:15px;padding:24px 20px;box-shadow:0 2px 12px #e1e8ed;margin-bottom:22px;display:flex;flex-direction:column;gap:11px";
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="background:#eef2ff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
            </div>
            <div>
              <span style="font-size:1.12rem;font-weight:600;color:#22223b;">${ag.servicoNome || ag.servicoDescricao || 'Serviço não informado'}</span>
              <div style="margin-top:2px;font-size:0.95rem;color:#3d3a57;">${formatarDataCompleta(ag.horario)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:18px;margin-top:10px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/></svg>
              <span style="font-size:1rem;color:#22223b;">${ag.profissionalNome || 'Não informado'}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
              <span style="font-size:1rem;color:#22223b;">${ag.clienteNome || 'Não informado'}</span>
            </div>
          </div>
        `;
        listaAgendamentos.appendChild(card);
    });
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
             if(listaAgendamentos) listaAgendamentos.innerHTML = `
              <div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
                <p>Você não parece ser o dono de nenhuma empresa cadastrada.</p>
              </div>`;
        }
    } else {
        window.location.href = 'login.html';
    }
  });
});
