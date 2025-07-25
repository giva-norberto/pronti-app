/**
 * servicos.js (Painel do Dono - com controle de visibilidade para a vitrine)
 * * Versão com layout original restaurado.
 */

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
          const isVisible = servico.visivelNaVitrine !== false;

          const el = document.createElement('div');
          el.classList.add('servico-item');

          // ALTERAÇÃO: estilo inline para deixar o bloco menor e compacto
          el.style.padding = '8px 12px';
          el.style.marginBottom = '10px';
          el.style.fontSize = '0.9rem';
          el.style.border = '1px solid #ddd';
          el.style.borderRadius = '6px';
          el.style.backgroundColor = '#fafafa';
          el.style.display = 'flex';
          el.style.justifyContent = 'space-between';
          el.style.alignItems = 'center';

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

    async function atualizarVisibilidade(id, visivel) {
      try {
        const servicoRef = doc(db, "users", uid, "servicos", id);
        await updateDoc(servicoRef, {
          visivelNaVitrine: visivel
        });
      } catch (error) {
        console.error("Erro ao atualizar visibilidade:", error);
        alert("Erro ao alterar visibilidade.");
        carregarServicosDoFirebase(); // Recarrega para reverter a mudança visual
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
    window.location.href = 'login.html';
  }
});
