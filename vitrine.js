import { app } from "./firebase-config.js"; // importa o app que você já tem
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

const db = getFirestore(app); // cria o db aqui usando o app

// resto do seu código permanece igual, só troque o import do db por isso

const nomeEstabelecimentoEl = document.getElementById("nome-estabelecimento");
const listaServicosContainer = document.getElementById("lista-servicos");

function getUidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("uid");
}

async function carregarVitrine() {
  const uid = getUidFromUrl();
  if (!uid) {
    if (listaServicosContainer)
      listaServicosContainer.innerHTML =
        "<p style='color:red; text-align:center;'>UID do empresário não informado na URL.</p>";
    if (nomeEstabelecimentoEl) nomeEstabelecimentoEl.textContent = "";
    return;
  }

  try {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      listaServicosContainer.innerHTML =
        "<p style='color:red; text-align:center;'>Empresário não encontrado.</p>";
      nomeEstabelecimentoEl.textContent = "";
      return;
    }

    const userData = userDocSnap.data();
    const nomeEstab = userData.nomeEstabelecimento || "Estabelecimento";

    nomeEstabelecimentoEl.textContent = nomeEstab;

    const servicosColRef = collection(db, "users", uid, "servicos");
    const servicosSnap = await getDocs(servicosColRef);

    if (servicosSnap.empty) {
      listaServicosContainer.innerHTML =
        "<p style='text-align:center;'>Nenhum serviço disponível no momento.</p>";
      return;
    }

    listaServicosContainer.innerHTML = "";

    servicosSnap.forEach((docSnap) => {
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
            <span>R$ ${parseFloat(servico.preco || 0)
              .toFixed(2)
              .replace(".", ",")}</span>
          </div>
          <a href="novo-agendamento.html?uid=${uid}&servico=${servicoId}" class="btn-new">Agendar</a>
        </div>
      `;

      listaServicosContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao carregar vitrine:", error);
    listaServicosContainer.innerHTML =
      "<p style='color:red; text-align:center;'>Erro ao carregar os serviços. Tente novamente mais tarde.</p>";
    nomeEstabelecimentoEl.textContent = "";
  }
}

carregarVitrine();

