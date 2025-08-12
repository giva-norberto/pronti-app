import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { showAlert } from "./vitrini-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  const listaAgendamentos = document.getElementById("lista-agendamentos");
  const inputData = document.getElementById("data-agenda");

  function formatarDataCompleta(timestamp) {
    if (!timestamp) return "-";
    const data = timestamp.toDate();
    return `${data.toLocaleDateString('pt-BR')} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  }

  async function getEmpresaIdDoDono(uid) {
    const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(empresQ);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
  }

  // Busca todos funcionários da empresa
  async function getFuncionarios(empresaId) {
    const profRef = collection(db, "empresarios", empresaId, "profissionais");
    const snapshot = await getDocs(profRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Busca o maior horário comercial liberado entre todos os funcionários no dia
  async function getMaiorHorarioFechamento(empresaId, dataSelecionada) {
    const funcionarios = await getFuncionarios(empresaId);
    let maiorHorario = null;
    for (const func of funcionarios) {
      let horario = null;
      if (func.horarioFimComercial) {
        horario = func.horarioFimComercial;
      } else {
        horario = "18:00"; // fallback padrão, ajuste se necessário
      }
      let horarioDate = new Date(`${dataSelecionada}T${horario}:00`);
      if (!maiorHorario || horarioDate > maiorHorario) maiorHorario = horarioDate;
    }
    return maiorHorario;
  }

  // Busca próximo dia comercial permitido, mesmo que não tenha agendamento
  async function encontrarProximoDiaComercial(empresaId) {
    const funcionarios = await getFuncionarios(empresaId);
    let diasPermitidos = [];
    funcionarios.forEach(func => {
      if (Array.isArray(func.diasComerciais)) {
        diasPermitidos = diasPermitidos.concat(func.diasComerciais);
      }
    });
    diasPermitidos = [...new Set(diasPermitidos)];
    if (diasPermitidos.length === 0) diasPermitidos = [1,2,3,4,5];

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    for (let i = 1; i <= 30; i++) {
      const dataAtual = new Date(hoje);
      dataAtual.setDate(hoje.getDate() + i);
      const diaSemana = dataAtual.getDay() === 0 ? 7 : dataAtual.getDay();
      if (diasPermitidos.includes(diaSemana)) {
        return dataAtual.toISOString().split('T')[0];
      }
    }
    return null;
  }

  async function carregarAgendaInteligente(empresaId) {
    if (!empresaId || !listaAgendamentos) return;
    listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
      <p>Carregando agendamentos...</p>
    </div>`;

    let dataSelecionada = inputData.value;
    if (!dataSelecionada) {
      listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
        <p>Selecione uma data para ver os agendamentos.</p>
      </div>`;
      return;
    }

    const agora = new Date();
    const maiorHorarioFechamento = await getMaiorHorarioFechamento(empresaId, dataSelecionada);

    let avancarData = false;
    const dataSelecionadaObj = new Date(`${dataSelecionada}T00:00:00`);
    if (dataSelecionadaObj.toDateString() === agora.toDateString() && maiorHorarioFechamento && agora > maiorHorarioFechamento) {
      avancarData = true;
    }

    if (avancarData) {
      const proximaData = await encontrarProximoDiaComercial(empresaId);
      if (proximaData) {
        inputData.value = proximaData;
        dataSelecionada = proximaData;
        showAlert("Aviso", `Horário comercial já acabou. Trazendo o próximo dia comercial liberado: ${proximaData}`);
      } else {
        listaAgendamentos.innerHTML = `<div class="card-info" style="padding:30px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#22223b;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
          <p>Nenhum dia comercial liberado encontrado nos próximos dias.</p>
        </div>`;
        return;
      }
    }

    const inicioDoDia = new Date(`${dataSelecionada}T00:00:00.000Z`);
    const fimDoDia = new Date(`${dataSelecionada}T23:59:59.999Z`);
    const agRef = collection(db, "empresarios", empresaId, "agendamentos");
    const q = query(
      agRef,
      where("status", "==", "agendado"),
      where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
      where("horario", "<=", Timestamp.fromDate(fimDoDia))
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
      listaAgendamentos.innerHTML = `
        <div class="card-info" style="padding:38px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#5f6dfa;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
          <svg width="48" height="48" style="margin-bottom:8px;" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
          <h2 style="font-size:1.35rem;font-weight:600;margin-bottom:10px;">Nenhum agendamento encontrado</h2>
          <p style="font-size:1rem;margin-bottom:0;color:#3d3a57;">Ainda não existem compromissos marcados para <span style="font-weight:700">${new Date(dataSelecionada).toLocaleDateString('pt-BR')}</span>. Que tal ser o primeiro a agendar?</p>
        </div>
      `;
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

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const empresaId = await getEmpresaIdDoDono(user.uid);
      if (empresaId) {
        if (inputData && !inputData.value) {
          const hoje = new Date();
          hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
          inputData.value = hoje.toISOString().split("T")[0];
        }
        carregarAgendaInteligente(empresaId);
        if (inputData) {
          inputData.addEventListener("change", () => carregarAgendaInteligente(empresaId));
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
