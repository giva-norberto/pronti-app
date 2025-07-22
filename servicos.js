/**
 * servicos.js (Painel do Dono - Lógica Original Restaurada)
 * * Este script foi revisado para manter a estrutura original de "buscar e exibir",
 * * apenas adaptando o local da busca para a pasta segura do usuário logado.
 */

import { getFirestore, collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaServicosContainer = document.getElementById('lista-servicos');

// A verificação de login é o "porteiro" da página.
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Se o usuário está logado, executa a função principal para carregar seus dados.
    carregarEExibirServicos(user.uid);
  } else {
    // Se não, redireciona para a tela de login.
    console.log("Nenhum usuário logado. Redirecionando para login.html...");
    window.location.href = 'login.html';
  }
});

/**
 * Função principal que busca os dados e os exibe na tela.
 * @param {string} uid - O ID do usuário autenticado.
 */
async function carregarEExibirServicos(uid) {
  if (!listaServicosContainer) {
    console.error("Erro Crítico: O container 'lista-servicos' não foi encontrado no HTML.");
    return;
  }
  
  listaServicosContainer.innerHTML = '<p>Carregando seus serviços...</p>';

  try {
    // A ÚNICA MUDANÇA ESTRUTURAL: Aponta para a coleção segura do usuário.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);

    if (querySnapshot.empty) {
      listaServicosContainer.innerHTML = '<p>Você ainda não cadastrou nenhum serviço. Clique em "Novo Serviço" para começar.</p>';
      return;
    }

    // Limpa o container para exibir os dados atualizados.
    listaServicosContainer.innerHTML = ''; 

    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const servicoId = doc.id;
      
      const card = document.createElement('div');
      card.className = 'servico-item';
      // A criação do card HTML segue uma estrutura simples e direta.
      card.innerHTML = `
        <div>
            <h3>${servico.nome || 'Serviço sem nome'}</h3>
            <p>Duração: ${servico.duracao || 'N/A'} min - Preço: R$ ${parseFloat(servico.preco || 0).toFixed(2)}</p>
            <p class="descricao-servico">${servico.descricao || 'Sem descrição.'}</p>
        </div>
        <div class="item-acoes">
            <button class="btn-editar" data-id="${servicoId}">Editar</button>
            <button class="btn-excluir" data-id="${servicoId}">Excluir</button>
        </div>
      `;
      listaServicosContainer.appendChild(card);
    });

    // Adiciona os eventos aos botões recém-criados.
    listaServicosContainer.querySelectorAll('.btn-editar').forEach(button => {
      button.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        window.location.href = `editar-servico.html?id=${id}`;
      });
    });

    listaServicosContainer.querySelectorAll('.btn-excluir').forEach(button => {
      button.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        // AVISO: A exclusão é imediata. Uma modal de confirmação customizada é ideal no futuro.
        try {
          const servicoRef = doc(db, "users", uid, "servicos", id);
          await deleteDoc(servicoRef);
          carregarEExibirServicos(uid); // Recarrega a lista para refletir a exclusão.
        } catch (error) {
          console.error("Erro ao excluir o serviço:", error);
          alert("Não foi possível excluir o serviço.");
        }
      });
    });

  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    listaServicosContainer.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar seus serviços.</p>';
  }
}
