/**
 * vitrine.js (Visão do Cliente)
 * * Este script é responsável por carregar e exibir a lista de serviços
 * na página pública que os clientes visitarão (vitrine.html).
 */

import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// Elemento do HTML onde os cards de serviço serão inseridos.
const listaServicosContainer = document.getElementById('lista-servicos');

/**
 * Busca os serviços no Firestore e os renderiza na página.
 */
async function carregarServicosPublicos() {
  // Exibe uma mensagem de carregamento enquanto busca os dados.
  if (listaServicosContainer) {
    listaServicosContainer.innerHTML = '<p>Carregando nossos serviços...</p>';
  } else {
    console.error("Elemento 'lista-servicos' não encontrado na página.");
    return;
  }

  try {
    const servicosCollection = collection(db, "servicos");
    const querySnapshot = await getDocs(servicosCollection);

    // Verifica se não há serviços cadastrados.
    if (querySnapshot.empty) {
      listaServicosContainer.innerHTML = '<p>Nenhum serviço disponível no momento.</p>';
      return;
    }

    // Limpa a mensagem de carregamento.
    listaServicosContainer.innerHTML = '';

    // Itera sobre cada documento de serviço e cria um card.
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const servicoId = doc.id;

      const card = document.createElement('div');
      // Reutiliza a classe .servico-item do seu CSS para manter a consistência.
      card.className = 'servico-item'; 

      // Estrutura interna do card com os detalhes do serviço.
      card.innerHTML = `
        <div class="servico-info">
            <h3>${servico.nome || 'Serviço sem nome'}</h3>
            <p>${servico.descricao || 'Sem descrição disponível.'}</p>
        </div>
        <div class="servico-meta">
            <div class="meta-item">
                <strong>Duração</strong>
                <span>${servico.duracao || 'N/A'} min</span>
            </div>
            <div class="meta-item">
                <strong>Preço</strong>
                <span>R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <!-- O botão leva para a página de agendamento, passando o ID do serviço na URL -->
            <a href="novo-agendamento.html?servico=${servicoId}" class="btn-new">Agendar</a>
        </div>
      `;
      
      // Adiciona o card criado ao container na página.
      listaServicosContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Erro ao carregar serviços públicos:", error);
    listaServicosContainer.innerHTML = '<p style="color:red; text-align:center;">Não foi possível carregar os serviços. Tente novamente mais tarde.</p>';
  }
}

// Inicia a função para carregar os serviços assim que a página for aberta.
carregarServicosPublicos();
