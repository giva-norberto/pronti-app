/**
 * agenda.js (Painel do Dono - Lógica Original com Multi-Usuário)
 * * Este script foi construído sobre o código-base fornecido pelo usuário,
 * * adicionando a camada de segurança para múltiplos usuários sem alterar
 * * as funções e fórmulas originais de carregamento de agendamentos.
 */

import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaAgendamentos = document.getElementById("lista-agendamentos");
const inputData = document.getElementById("data-agenda");

// --- SUAS FUNÇÕES ORIGINAIS (INTACTAS) ---

function formatarHorario(dataIso) {
  const data = new Date(dataIso);
  return `${data.toLocaleDateString()} ${data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function carregarAgendamentos(uid) {
  if (!uid) {
    console.error("UID do usuário não fornecido para carregar agendamentos.");
    return;
  }

  listaAgendamentos.innerHTML = "<p>Carregando agendamentos...</p>";

  const dataSelecionada = inputData.value;
  if (!dataSelecionada) {
    listaAgendamentos.innerHTML = "<p>Por favor, selecione uma data.</p>";
    return;
  }

  try {
    // A coleção agora aponta para a pasta segura do usuário logado.
    const colecao = collection(db, `users/${uid}/agendamentos`);
    const snapshot = await getDocs(colecao);

    const agendamentos = [];

    // A sua lógica de busca de serviços e agendamentos foi mantida.
    for (const docAg of snapshot.docs) {
      const ag = docAg.data();
      const dataAg = new Date(ag.horario);
      const dataAgFormatada = dataAg.toISOString().split("T")[0]; // "2025-07-23"

      if (dataAgFormatada === dataSelecionada) {
        ag.id = docAg.id;

        // Busca nome do serviço via ID, dentro da pasta do usuário.
        const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
        ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço não encontrado";

        agendamentos.push(ag);
      }
    }

    if (agendamentos.length === 0) {
      const dataFormatada = new Date(dataSelecionada + 'T12:00:00').toLocaleDateString();
      listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado para o dia ${dataFormatada}.</p>`;
    } else {
      listaAgendamentos.innerHTML = "";

      // Ordena os agendamentos por horário antes de exibir.
      agendamentos.sort((a, b) => new Date(a.horario) - new Date(b.horario));

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

// --- NOVA ESTRUTURA DE INICIALIZAÇÃO ---
// Garante que o código só rode após a confirmação do login.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado.
        const uid = user.uid;

        // Define a data atual como padrão no input.
        if (!inputData.value) {
            inputData.value = new Date().toISOString().split("T")[0];
        }
        
        // Carrega os agendamentos para a data padrão.
        carregarAgendamentos(uid);

        // Adiciona o listener para carregar novamente quando a data mudar.
        inputData.addEventListener("change", () => carregarAgendamentos(uid));

    } else {
        // Usuário não está logado.
        console.log("Nenhum usuário logado. Redirecionando para login...");
        window.location.href = 'login.html';
    }
});


// Define data atual ao carregar
inputData.addEventListener("change", carregarAgendamentos);
window.addEventListener("load", () => {
  inputData.value = new Date().toISOString().split("T")[0];
  setTimeout(carregarAgendamentos, 500); // aguarda autenticação assíncrona
});
