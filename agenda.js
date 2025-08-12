import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { showAlert } from "./vitrini-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const inputData = document.getElementById("data-agenda");

  function formatarDataCompleta(data, horario) {
    if (!data || !horario) return "-";
    return `${data.split("-").reverse().join("/")} ${horario}`;
  }

  async function getEmpresaIdDoDono(uid) {
    const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(empresQ);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
  }

  async function carregarAgendamentosPorData(empresaId, dataSelecionada) {
    if (!empresaId || !listaAgendamentos) return;
    listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
      <p>Carregando agendamentos...</p>
    </div>`;

    if (!dataSelecionada) {
      listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
        <p>Selecione uma data para ver os agendamentos.</p>
      </div>`;
      return;
    }

    // BUSCA AGENDAMENTOS PELO CAMPO "data" (STRING)
    const q = query(
      collection(db, "empresarios", empresaId, "agendamentos"),
      where("status", "==", "agendado"),
      where("data", "==", dataSelecionada)
    );

    try {
      const snapshot = await getDocs(q);
      const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderizarAgendamentos(agendamentos, dataSelecionada);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
        <p>Ocorreu um erro ao carregar os agendamentos.</p>
      </div>`;
    }
  }

  function renderizarAgendamentos(agendamentos, dataSelecionada) {
    if (!listaAgendamentos) return;
    listaAgendamentos.innerHTML = "";
    if (agendamentos.length === 0) {
      const dataFormatada = dataSelecionada.split("-").reverse().join("/");
      listaAgendamentos.innerHTML = `
        <div class="card-info" style="padding:38px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#5f6dfa;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
          <svg width="48" height="48" style="margin-bottom:8px;" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
          <h2 style="font-size:1.35rem;font-weight:600;margin-bottom:10px;">Nenhum agendamento encontrado</h2>
          <p style="font-size:1rem;margin-bottom:0;color:#3d3a57;">Ainda não existem compromissos marcados para <span style="font-weight:700">${dataFormatada}</span>. Que tal ser o primeiro a agendar?</p>
        </div>
      `;
      return;
    }
    agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));
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
            <div style="margin-top:2px;font-size:0.95rem;color:#3d3a57;">${formatarDataCompleta(ag.data, ag.horario)}</div>
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

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const empresaId = await getEmpresaIdDoDono(user.uid);
      if (empresaId) {
        if (inputData && !inputData.value) {
          const hoje = new Date();
          hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
          inputData.value = hoje.toISOString().split("T")[0];
        }
        carregarAgendamentosPorData(empresaId, inputData.value);
        if (inputData) {
          inputData.addEventListener("change", () => carregarAgendamentosPorData(empresaId, inputData.value));
        }
      } else {
        if(listaAgendamentos) listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
          <p>Você não parece ser o dono de nenhuma empresa cadastrada.</p>
        </div>`;
      }
    } else {
      window.location.href = 'login.html';
    }
  });
});
