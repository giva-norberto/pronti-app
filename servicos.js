import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);
const listaServicosDiv = document.getElementById('lista-servicos');

onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;

    async function carregarServicosDoFirebase() {
      listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
      try {
        const servicosUserCollection = collection(db, "users", uid, "servicos");
        const snapshot = await getDocs(servicosUserCollection);

        if (snapshot.empty) {
          listaServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>';
          return;
        }

        listaServicosDiv.innerHTML = '';
        snapshot.forEach(docSnap => {
          const servico = docSnap.data();
          const servicoId = docSnap.id;
          const visivel = servico.visivel !== false; // padrão: true

          const el = document.createElement('div');
          el.classList.add('servico-item');

          el.innerHTML = `
            <div class="item-info">
              <h3>${servico.nome}</h3>
              <p><strong>Preço:</strong> R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</p>
              <p><strong>Duração:</strong> ${servico.duracao} minutos</p>
              <p><strong>Status:</strong> 
                ${visivel ? '<span style="color:green;">✅ Visível na Vitrine</span>' : '<span style="color:red;">🚫 Oculto da Vitrine</span>'}
              </p>
            </div>
            <div class="item-acoes">
              <button class="btn-editar" data-id="${servicoId}">Editar</button>
              <button class="btn-excluir" data-id="${servicoId}">Excluir</button>
              <button class="btn-vitrine" data-id="${servicoId}" data-visivel="${visivel}">
                ${visivel ? 'Ocultar da Vitrine' : 'Mostrar na Vitrine'}
              </button>
            </div>
          `;
          listaServicosDiv.appendChild(el);
        });

      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
      }
    }

    async function excluirServico(id) {
      if (confirm("Você tem certeza? Esta ação é permanente.")) {
        try {
          await deleteDoc(doc(db, "users", uid, "servicos", id));
          alert("Serviço excluído com sucesso.");
          carregarServicosDoFirebase();
        } catch (error) {
          console.error("Erro ao excluir serviço: ", error);
          alert("Erro ao excluir serviço.");
        }
      }
    }

    async function alternarVisibilidadeServico(id, atual) {
      try {
        const novoStatus = !atual;
        await updateDoc(doc(db, "users", uid, "servicos", id), {
          visivel: novoStatus
        });
        carregarServicosDoFirebase();
      } catch (error) {
        console.error("Erro ao atualizar visibilidade:", error);
        alert("Erro ao alterar visibilidade.");
      }
    }

    listaServicosDiv.addEventListener('click', (event) => {
      const target = event.target;

      if (target.classList.contains('btn-editar')) {
        window.location.href = `editar-servico.html?id=${target.dataset.id}`;
      }

      if (target.classList.contains('btn-excluir')) {
        excluirServico(target.dataset.id);
      }

      if (target.classList.contains('btn-vitrine')) {
        const id = target.dataset.id;
        const atual = target.dataset.visivel === "true";
        alternarVisibilidadeServico(id, atual);
      }
    });

    carregarServicosDoFirebase();

  } else {
    window.location.href = 'login.html';
  }
});
