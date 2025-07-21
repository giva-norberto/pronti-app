import { getFirestore, collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const servicosCollection = collection(db, "servicos");
const listaServicosDiv = document.getElementById('lista-servicos');

async function carregarServicosDoFirebase() {
  listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
  try {
    const snapshot = await getDocs(servicosCollection);
    if (snapshot.empty) {
      listaServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>';
      return;
    }
    listaServicosDiv.innerHTML = '';
    snapshot.forEach(doc => {
      const servico = doc.data();
      const servicoId = doc.id;
      const el = document.createElement('div');
      el.classList.add('servico-item');
      el.innerHTML = `
        <div class="item-info">
          <h3>${servico.nome}</h3>
          <p><strong>Preço:</strong> R$ ${servico.preco.toFixed(2).replace('.', ',')}</p>
          <p><strong>Duração:</strong> ${servico.duracao} minutos</p>
        </div>
        <div class="item-acoes">
          <button class="btn-editar" data-id="${servicoId}">Editar</button>
          <button class="btn-excluir" data-id="${servicoId}">Excluir</button>
        </div>
      `;
      listaServicosDiv.appendChild(el);
    });
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    listaServicosDiv.innerHTML = '<p style="color:red;">Ocorreu uma falha ao carregar os serviços.</p>';
  }
}

async function excluirServico(id) {
    if (confirm("Você tem certeza? Esta ação é permanente e não pode ser desfeita.")) {
        try {
            await deleteDoc(doc(db, "servicos", id));
            Toastify({ text: "Serviço excluído com sucesso.", style: { background: "var(--cor-perigo)" } }).showToast();
            carregarServicosDoFirebase();
        } catch (error) {
            console.error("Erro ao excluir serviço: ", error);
            Toastify({ text: "Falha ao excluir o serviço.", style: { background: "var(--cor-perigo)" } }).showToast();
        }
    }
}

listaServicosDiv.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('btn-excluir')) {
        excluirServico(target.dataset.id);
    }
    if (target.classList.contains('btn-editar')) {
        window.location.href = `editar-servico.html?id=${target.dataset.id}`;
    }
});

carregarServicosDoFirebase();