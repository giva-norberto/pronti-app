/**
 * servicos.js (Atualizado para Multi-Usuário)
 * * Este script agora busca e exibe APENAS os serviços
 * que pertencem ao usuário que está logado.
 */

import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaServicosContainer = document.getElementById('lista-servicos');

// A função principal agora só é chamada quando temos um usuário logado.
onAuthStateChanged(auth, (user) => {
  if (user) {
    // O usuário está logado, carregamos seus dados.
    carregarServicosDoUsuario(user.uid);
  } else {
    // Se não há usuário, redireciona para o login.
    console.log("Nenhum usuário logado. Redirecionando...");
    window.location.href = 'login.html'; // Crie esta página de login
  }
});

/**
 * Busca e exibe na tela os serviços de um usuário específico.
 * @param {string} uid - O ID do usuário logado.
 */
async function carregarServicosDoUsuario(uid) {
  if (!listaServicosContainer) return;
  listaServicosContainer.innerHTML = '<p>Carregando seus serviços...</p>';

  try {
    // AQUI ESTÁ A MUDANÇA PRINCIPAL:
    // Acessamos a coleção de serviços dentro da pasta do usuário.
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);

    if (querySnapshot.empty) {
      listaServicosContainer.innerHTML = '<p>Você ainda não cadastrou nenhum serviço.</p>';
      return;
    }

    listaServicosContainer.innerHTML = ''; // Limpa o container
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const servicoId = doc.id;
      
      const card = document.createElement('div');
      card.className = 'servico-item';
      card.innerHTML = `
        <div>
            <h3>${servico.nome}</h3>
            <p>Duração: ${servico.duracao} min - Preço: R$ ${servico.preco.toFixed(2)}</p>
        </div>
        <div class="item-acoes">
            <!-- Adicione aqui os botões de editar/excluir -->
            <button class="btn-editar" data-id="${servicoId}">Editar</button>
            <button class="btn-excluir" data-id="${servicoId}">Excluir</button>
        </div>
      `;
      listaServicosContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    listaServicosContainer.innerHTML = '<p style="color:red;">Erro ao carregar seus serviços.</p>';
  }
}
