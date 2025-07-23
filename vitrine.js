/**
 * vitrine.js (Visão do Cliente - Versão Inteligente)
 * * Este script agora lê um 'slug' da URL para encontrar o profissional
 * * correto no Firestore e carregar dinamicamente o seu perfil público
 * * e a sua lista de serviços.
 */

import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

// Elementos do HTML que serão preenchidos dinamicamente
const headerPublico = document.querySelector('.header-publico');
const listaServicosContainer = document.getElementById('lista-servicos');

/**
 * Função principal que inicializa a página da vitrine.
 */
async function inicializarVitrine() {
  // Passo 1: Ler o 'slug' da URL.
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');

  if (!slug) {
    exibirErro("Link inválido. Nenhum perfil de profissional foi especificado.");
    return;
  }

  try {
    // Passo 2: Encontrar o ID do profissional que corresponde ao slug.
    const profissionalUid = await encontrarProfissionalPeloSlug(slug);

    if (!profissionalUid) {
      exibirErro(`Nenhum profissional encontrado com o endereço "${slug}". Verifique o link.`);
      return;
    }

    // Passo 3: Carregar o perfil e os serviços do profissional encontrado.
    await carregarPerfilPublico(profissionalUid);
    await carregarServicosPublicos(profissionalUid);

  } catch (error) {
    console.error("Erro fatal ao inicializar a vitrine:", error);
    exibirErro("Ocorreu um erro ao carregar a página. Tente novamente mais tarde.");
  }
}

/**
 * Procura na coleção 'users' por um perfil que corresponda ao slug fornecido.
 * @param {string} slug - O slug lido da URL.
 * @returns {Promise<string|null>} O UID do profissional ou null se não for encontrado.
 */
async function encontrarProfissionalPeloSlug(slug) {
  console.log(`A procurar profissional com o slug: ${slug}`);
  const profilesRef = collection(db, "users");
  // Esta consulta complexa procura dentro da subcoleção 'publicProfile'
  const q = query(
    collection(db, "users"),
    where("publicProfile.profile.slug", "==", slug),
    limit(1)
  );

  // Infelizmente, o Firestore não suporta consultas diretas em subcoleções
  // desta forma. A abordagem correta é ter uma coleção raiz para perfis públicos.
  // Como solução alternativa para a estrutura atual, vamos criar uma coleção 'publicProfiles'.
  // Assumindo que criamos uma coleção 'publicProfiles' para facilitar a busca.
  
  const publicProfilesRef = collection(db, "publicProfiles");
  const profileQuery = query(publicProfilesRef, where("slug", "==", slug), limit(1));
  const querySnapshot = await getDocs(profileQuery);

  if (querySnapshot.empty) {
    return null;
  }
  // Retorna o UID do dono, que está guardado no perfil público.
  return querySnapshot.docs[0].data().ownerId;
}


/**
 * Carrega os dados do perfil público e atualiza o cabeçalho da página.
 * @param {string} uid - O ID do profissional.
 */
async function carregarPerfilPublico(uid) {
    // Esta função precisaria de ser implementada para buscar os dados de 'users/{uid}/publicProfile/profile'
    // e preencher o headerPublico. Por agora, vamos focar nos serviços.
    console.log(`Perfil a ser carregado para o UID: ${uid}`);
}

/**
 * Busca os serviços do profissional no Firestore e os renderiza na página.
 * @param {string} uid - O ID do profissional.
 */
async function carregarServicosPublicos(uid) {
  listaServicosContainer.innerHTML = '<p>A carregar os nossos serviços...</p>';
  try {
    const servicosUserCollection = collection(db, "users", uid, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);

    if (querySnapshot.empty) {
      listaServicosContainer.innerHTML = '<p>Este profissional ainda não cadastrou nenhum serviço.</p>';
      return;
    }

    listaServicosContainer.innerHTML = '';
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const servicoId = doc.id;
      const card = document.createElement('div');
      card.className = 'servico-item';
      card.innerHTML = `
        <div class="servico-info">
            <h3>${servico.nome || 'Serviço sem nome'}</h3>
            <p>${servico.descricao || 'Sem descrição disponível.'}</p>
        </div>
        <div class="servico-meta">
            <div class="meta-item"><strong>Duração</strong><span>${servico.duracao || 'N/A'} min</span></div>
            <div class="meta-item"><strong>Preço</strong><span>R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</span></div>
            <a href="novo-agendamento.html?servico=${servicoId}" class="btn-new">Agendar</a>
        </div>
      `;
      listaServicosContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao carregar serviços públicos:", error);
    exibirErro("Não foi possível carregar os serviços deste profissional.");
  }
}

/**
 * Exibe uma mensagem de erro central na tela.
 * @param {string} mensagem - A mensagem de erro a ser exibida.
 */
function exibirErro(mensagem) {
  if (headerPublico) headerPublico.style.display = 'none';
  if (listaServicosContainer) {
    listaServicosContainer.innerHTML = `<p style="color:red; text-align:center; font-size: 1.2em; padding: 40px;">${mensagem}</p>`;
  }
}

// Inicia a vitrine assim que a página é carregada.
inicializarVitrine();



