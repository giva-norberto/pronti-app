import { db } from "./firebase-config.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

const nomeEstabelecimentoEl = document.getElementById("nome-estabelecimento");
const listaServicosContainer = document.getElementById("lista-servicos");

function getUidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("uid");
}

async function carregarVitrine() {
  const uid = getUidFromUrl();
  if (!uid) {
    if(listaServicosContainer)
      listaServicosContainer.innerHTML = "<p style='color:red;'>UID do empresário não informado na URL.</p>";
    return;
  }

  try {
    // Busca o nome do estabelecimento
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      listaServicosContainer.innerHTML = "<p style='color:red;'>Empresário não encontrado.</p>";
      return;
    }

    const userData = userDocSnap.data();
    const nomeEstab = userData.nomeEstabelecimento || "Estabelecimento";

    if (nomeEstabelecimentoEl)
      nomeEstabelecimentoEl.textContent = nomeEstab;

    // Busca os serviços do empresário
    const servicosColRef = collection(db, "users", uid, "servicos");
    const servicosSnap = await getDocs(servicosColRef);

    if (servicosSnap.empty) {
      listaServicosContainer.innerHTML = "<p>Nenhum serviço disponível no momento.</p>";
      return;
    }

    // Limpa container para renderizar os serviços
    listaServicosContainer.innerHTML = "";

    servicosSnap.forEach(docSnap => {
      const servico = docSnap.data();
      const servicoId = docSnap.id;

      const card = document.createElement("div");
      card.className = "servico-item";

      card.innerHTML = `
        <div class="servico-info">
          <h3>${servico.nome || "Serviço sem nome"}</h3>
          <p>${servico.descricao || "Sem descrição disponível."}</p>
        </div>
        <div class="servico-meta">
          <div class="meta-item">
            <strong>Duração</strong>
            <span>${servico.duracao || "N/A"} min</span>
          </div>
          <div class="meta-item">
            <strong>Preço</strong>
            <span>R$ ${parseFloat(servico.preco || 0).toFixed(2).replace(".", ",")}</span>
          </div>
          <a href="novo-agendamento.html?uid=${uid}&servico=${servicoId}" class="btn-new">Agendar</a>
        </div>
      `;

      listaServicosContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Erro ao carregar vitrine:", error);
    listaServicosContainer.innerHTML = "<p style='color:red;'>Erro ao carregar os serviços. Tente novamente mais tarde.</p>";
  }
}

carregarVitrine();
