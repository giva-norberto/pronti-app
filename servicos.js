/**
 * servicos.js (Painel do Dono - Base do Usuário com Multi-Usuário)
 * * Este script foi construído sobre o código-base fornecido pelo usuário,
 * * adicionando a camada de segurança para múltiplos usuários sem alterar
 * * as funções e fórmulas originais.
 */

import { getFirestore, collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaServicosDiv = document.getElementById('lista-servicos');

// A verificação de login é o "porteiro" da página.
// Todo o código original agora roda dentro deste bloco.
onAuthStateChanged(auth, (user) => {
  if (user) {
    // O usuário está logado, podemos executar a lógica da página.
    const uid = user.uid; // ID do usuário logado.

    // --- SUAS FUNÇÕES ORIGINAIS (ADAPTADAS PARA O UID) ---

    async function carregarServicosDoFirebase() {
      listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
      try {
        // MUDANÇA: Aponta para a coleção segura do usuário.
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
          const el = document.createElement('div');
          el.classList.add('servico-item');
          // A estrutura do seu card foi mantida.
          el.innerHTML = `
            <div class="item-info">
              <h3>${servico.nome}</h3>
              <p><strong>Preço:</strong> R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</p>
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
          // MUDANÇA: Aponta para o documento dentro da coleção segura do usuário.
          await deleteDoc(doc(db, "users", uid, "servicos", id));
          // AVISO: A biblioteca Toastify não é padrão, substituído por alert.
          alert("Serviço excluído com sucesso.");
          carregarServicosDoFirebase();
        } catch (error) {
          console.error("Erro ao excluir serviço: ", error);
          alert("Falha ao excluir o serviço.");
        }
      }
    }

    // --- SEU EVENT LISTENER ORIGINAL ---
    listaServicosDiv.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('btn-excluir')) {
        excluirServico(target.dataset.id);
      }
      if (target.classList.contains('btn-editar')) {
        window.location.href = `editar-servico.html?id=${target.dataset.id}`;
      }
    });

    // --- SUA CHAMADA INICIAL ORIGINAL ---
    carregarServicosDoFirebase();

  } else {
    // Se não há usuário logado, redireciona para a tela de login.
    console.log("Nenhum usuário logado. Redirecionando para login.html...");
    window.location.href = 'login.html';
  }
});

