/**
 * servicos.js (Painel do Dono - Versão Estável e Corrigida)
 * * Este script foi revisado para garantir que a função de carregamento
 * * execute apenas uma vez, evitando repetições, e mantém a lógica original.
 */

import { getFirestore, collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaServicosContainer = document.getElementById('lista-servicos');
let isInitialized = false; // Flag para controlar a execução inicial.

// A verificação de login é o "porteiro" da página.
onAuthStateChanged(auth, (user) => {
  // A flag 'isInitialized' garante que o código só rode uma vez.
  if (user && !isInitialized) {
    isInitialized = true; // Marca que a inicialização já ocorreu.
    // Se o usuário está logado, executa a função principal para carregar seus dados.
    carregarEExibirServicos(user.uid);
  } else if (!user) {
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
  console.log(`Carregando serviços para o usuário: ${uid}`);

  try {
    // A ÚNICA MUDANÇA ESTRUTURAL: Aponta para a coleção segura do usuário.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);
    console.log(`Encontrados ${querySnapshot.size} serviços.`);

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
    adicionarListenersDeAcao(uid);

  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    listaServicosContainer.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar seus serviços.</p>';
  }
}

/**
 * Adiciona os listeners para os botões de editar e excluir de forma segura.
 * @param {string} uid - O ID do usuário logado.
 */
function adicionarListenersDeAcao(uid) {
    listaServicosContainer.addEventListener('click', async (e) => {
        const target = e.target;

        // Ação de Editar
        if (target.classList.contains('btn-editar')) {
            const id = target.dataset.id;
            console.log(`Botão Editar clicado para o ID: ${id}`);
            window.location.href = `editar-servico.html?id=${id}`;
        }

        // Ação de Excluir
        if (target.classList.contains('btn-excluir')) {
            const id = target.dataset.id;
            console.log(`Botão Excluir clicado para o ID: ${id}`);
            // AVISO: A exclusão é imediata. Uma modal de confirmação customizada é ideal no futuro.
            try {
              const servicoRef = doc(db, "users", uid, "servicos", id);
              await deleteDoc(servicoRef);
              console.log("Serviço excluído. Recarregando a lista...");
              carregarEExibirServicos(uid); // Recarrega a lista para refletir a exclusão.
            } catch (error) {
              console.error("Erro ao excluir o serviço:", error);
              alert("Não foi possível excluir o serviço.");
            }
        }
    });
}
