import { db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";

const listaAgendamentos = document.getElementById("lista-agendamentos");
const inputData = document.getElementById("data-agenda");

function formatarHorario(dataIso) {
  const data = new Date(dataIso);
  return `${data.toLocaleDateString()} ${data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function carregarAgendamentos() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  listaAgendamentos.innerHTML = "<p>Carregando agendamentos...</p>";

  const dataSelecionada = inputData.value;
  if (!dataSelecionada) return;

  try {
    const colecao = collection(db, `users/${uid}/agendamentos`);
    const snapshot = await getDocs(colecao);

    const agendamentos = [];

    for (const docAg of snapshot.docs) {
      const ag = docAg.data();
      const dataAg = new Date(ag.horario);
      const dataAgFormatada = dataAg.toISOString().split("T")[0]; // "2025-07-23"

      if (dataAgFormatada === dataSelecionada) {
        ag.id = docAg.id;

        // Busca nome do serviço via ID
        const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
        ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço não encontrado";

        agendamentos.push(ag);
      }
    }

    if (agendamentos.length === 0) {
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado para o dia ${new Date(dataSelecionada).toLocaleDateString()}.</p>`;
    } else {
      listaAgendamentos.innerHTML = "";

      agendamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item";

        div.innerHTML = `
          <h3>${ag.servicoNome}</h3>
          <p><strong>Cliente:</strong> ${ag.cliente}</p>
          <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
        `;

        listaAgendamentos.appendChild(div);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    listaAgendamentos.innerHTML = `<p style="color:red">Erro ao carregar agendamentos.</p>`;
  }
}

// Define data atual ao carregar
inputData.addEventListener("change", carregarAgendamentos);
window.addEventListener("load", () => {
  inputData.value = new Date().toISOString().split("T")[0];
  setTimeout(carregarAgendamentos, 500); // aguarda autenticação assíncrona
});
