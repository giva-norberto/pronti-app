**
 * servicos.js (Painel do Dono - com botão de visibilidade)
 * * Este script foi modificado para adicionar o botão "Ativo"
 * * sem alterar as fórmulas e funções originais do usuário.
 */

// MUDANÇA 1: Importamos a função 'updateDoc' para atualizar o serviço
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
        snapshot.forEach(doc => {
          const servico = doc.data();
          const servicoId = doc.id;
          
          // MUDANÇA 2: Verificamos se o serviço está visível, com um valor padrão 'true'
          const isVisible = servico.visivelNaVitrine !== false; // Padrão é visível

          const el = document.createElement('div');
          el.classList.add('servico-item');
          
          // MUDANÇA 3: Adicionamos o botão "Ativo" (toggle switch) ao lado dos outros botões
          el.innerHTML = `
            <div class="item-info">
              <h3>${servico.nome}</h3>
              <p><strong>Preço:</strong> R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</p>
              <p><strong>Duração:</strong> ${servico.duracao} minutos</p>
            </div>
            <div class="item-acoes">
              <div class="acao-visibilidade">
                <label class="switch-label">Ativo na Vitrine</label>
                <label class="switch">
                    <input type="checkbox" class="toggle-visibilidade" data-id="${servicoId}" ${isVisible ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
              </div>
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
          await deleteDoc(doc(db, "users", uid, "servicos", id));
          alert("Serviço excluído com sucesso.");
          carregarServicosDoFirebase();
        } catch (error) {
          console.error("Erro ao excluir serviço: ", error);
          alert("Falha ao excluir o serviço.");
        }
      }
    }

    // MUDANÇA 4: Nova função para atualizar a visibilidade no Firebase
    async function atualizarVisibilidade(id, visivel) {
        try {
            const servicoRef = doc(db, "users", uid, "servicos", id);
            await updateDoc(servicoRef, {
                visivelNaVitrine: visivel
            });
        } catch (error) {
            console.error("Erro ao atualizar visibilidade:", error);
            alert("Não foi possível atualizar o status do serviço.");
            // Recarrega para reverter a mudança visual em caso de erro
            carregarServicosDoFirebase();
        }
    }

    // MUDANÇA 5: O event listener agora ouve 'click' e 'change'
    listaServicosDiv.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('btn-excluir')) {
        excluirServico(target.dataset.id);
      }
      if (target.classList.contains('btn-editar')) {
        window.location.href = `editar-servico.html?id=${target.dataset.id}`;
      }
    });

    listaServicosDiv.addEventListener('change', (event) => {
        const target = event.target;
        if (target.classList.contains('toggle-visibilidade')) {
            const servicoId = target.dataset.id;
            const isVisible = target.checked;
            atualizarVisibilidade(servicoId, isVisible);
        }
    });

    carregarServicosDoFirebase();

  } else {
    console.log("Nenhum usuário logado. Redirecionando para login.html...");
    window.location.href = 'login.html';
  }
});
