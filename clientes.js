/**
 * clientes.js
 * * Gerencia a exibição e manipulação da lista de clientes para o empresário logado.
 * Este script opera sobre a subcoleção 'empresarios/{empresaId}/clientes'.
 * * Versão do Firebase SDK: Modular v10+
 */

// Importa as instâncias e funções necessárias do Firebase SDK.
// É uma boa prática importar de um arquivo de configuração centralizado.
import { db, auth } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Referências aos Elementos do DOM ---
// Armazena os elementos da página em constantes para acesso rápido e seguro.
const listaClientesDiv = document.getElementById("lista-clientes");
const modal = document.getElementById("modal-confirmacao");
const modalMensagem = document.getElementById("modal-mensagem");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");
const btnModalCancelar = document.getElementById("btn-modal-cancelar");

// Variável para armazenar o ID da empresa do usuário logado.
let empresaId = null;

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Exibe uma notificação toast na tela. Utiliza a biblioteca Toastify se estiver disponível,
 * caso contrário, recorre a um alert padrão do navegador.
 * @param {string} texto - A mensagem a ser exibida.
 * @param {string} cor - A cor de fundo do toast (ex: '#28a745' para sucesso, '#ef4444' para erro).
 */
function mostrarToast(texto, cor = '#38bdf8') {
  if (typeof Toastify !== "undefined") {
    Toastify({
      text: texto,
      duration: 4000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      style: { background: cor, color: "white", borderRadius: "8px", fontWeight: "500" }
    }).showToast();
  } else {
    alert(texto);
  }
}

/**
 * Exibe um modal de confirmação e retorna uma Promise que resolve para 'true' se o usuário
 * confirmar, ou 'false' se cancelar.
 * @param {string} mensagem - A pergunta de confirmação a ser exibida no modal.
 * @returns {Promise<boolean>}
 */
function mostrarConfirmacao(mensagem) {
  // Se os elementos do modal não estiverem na página, usa o 'confirm' padrão do navegador como fallback.
  if (!modal || !modalMensagem || !btnModalConfirmar || !btnModalCancelar) {
    console.warn("Elementos do modal de confirmação não encontrados. Usando window.confirm().");
    return Promise.resolve(window.confirm(mensagem));
  }

  modalMensagem.textContent = mensagem;
  modal.classList.add("show");

  return new Promise((resolve) => {
    // Handler para fechar o modal e remover os listeners para evitar vazamentos de memória.
    const fecharModal = (resultado) => {
      modal.classList.remove("show");
      btnModalConfirmar.onclick = null;
      btnModalCancelar.onclick = null;
      document.removeEventListener("keydown", handleEsc);
      resolve(resultado);
    };

    const handleConfirm = () => fecharModal(true);
    const handleCancel = () => fecharModal(false);
    
    // Permite fechar o modal com a tecla 'Escape'.
    const handleEsc = (e) => {
      if (e.key === "Escape") handleCancel();
    };

    btnModalConfirmar.onclick = handleConfirm;
    btnModalCancelar.onclick = handleCancel;
    document.addEventListener("keydown", handleEsc);
  });
}


/**
 * Exibe uma mensagem de erro na área de conteúdo principal.
 * @param {string} mensagem A mensagem de erro a ser exibida.
 */
function exibirMensagemDeErro(mensagem) {
    if (listaClientesDiv) {
        listaClientesDiv.innerHTML = `<p class="mensagem-erro">${mensagem}</p>`;
    }
}


// --- LÓGICA PRINCIPAL DA PÁGINA ---

/**
 * Ponto de entrada do script. Observa o estado de autenticação do usuário.
 * Redireciona para o login se não estiver autenticado.
 * Inicia o carregamento dos dados se estiver autenticado e uma empresa estiver selecionada.
 */
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuário está logado.
    empresaId = localStorage.getItem("empresaAtivaId");
    if (empresaId) {
      // Se um ID de empresa foi encontrado no localStorage, inicia a página.
      inicializarPaginaClientes();
    } else {
      // Se não houver empresa selecionada, exibe uma mensagem orientando o usuário.
      exibirMensagemDeErro("Nenhuma empresa selecionada. Por favor, selecione uma empresa para ver os clientes.");
      // Opcional: redirecionar para a página de seleção de empresa.
      // setTimeout(() => { window.location.href = "selecionar-empresa.html"; }, 3000);
    }
  } else {
    // Usuário não está logado, redireciona para a página de login.
    window.location.href = "login.html";
  }
});

/**
 * Função principal que inicializa os componentes da página de clientes.
 */
function inicializarPaginaClientes() {
  if (!empresaId) {
      console.error("Tentativa de inicializar a página sem um ID de empresa.");
      exibirMensagemDeErro("Ocorreu um erro: ID da empresa não encontrado.");
      return;
  }
  configurarListenersDeAcao();
  carregarClientes();
}

/**
 * Carrega a lista de clientes da subcoleção do Firestore e a renderiza na tela.
 */
async function carregarClientes() {
  // Verifica se o elemento que exibirá a lista existe no DOM.
  if (!listaClientesDiv) return;

  listaClientesDiv.innerHTML = `<p class="mensagem-info">Carregando clientes...</p>`;

  try {
    // Constrói a referência para a subcoleção 'clientes' dentro do documento da empresa.
    // Esta linha é a que causava o erro se 'empresaId' fosse nulo.
    const clientesRef = collection(db, "empresarios", empresaId, "clientes");
    
    // Cria uma query para ordenar os clientes por nome.
    const q = query(clientesRef, orderBy("nome"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaClientesDiv.innerHTML = '<p class="mensagem-info">Você ainda não cadastrou nenhum cliente.</p>';
      return;
    }

    // Limpa a lista antes de adicionar os novos cards.
    listaClientesDiv.innerHTML = ''; 
    snapshot.forEach(docItem => {
      const cliente = docItem.data();
      const clienteId = docItem.id;

      const cardElement = document.createElement('div');
      cardElement.className = 'card';
      cardElement.setAttribute('data-id', clienteId);
      
      // Template string para criar o HTML do card de forma limpa.
      cardElement.innerHTML = `
        <div class="card-title">${cliente.nome || "Nome não informado"}</div>
        <div class="card-info">
          <p><i class="fa-solid fa-phone"></i> ${cliente.telefone || "Não informado"}</p>
          <p><i class="fa-solid fa-envelope"></i> ${cliente.email || "Não informado"}</p>
        </div>
        <div class="card-actions">
          <a href="novo-cliente.html?id=${clienteId}" class="btn btn-edit" title="Editar ${cliente.nome}"><i class="fa-solid fa-pen"></i> Editar</a>
          <button class="btn btn-remove" data-id="${clienteId}" title="Excluir ${cliente.nome}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      `;
      listaClientesDiv.appendChild(cardElement);
    });

  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    exibirMensagemDeErro("Ocorreu um erro inesperado ao carregar a lista de clientes. Tente novamente mais tarde.");
  }
}

/**
 * Exclui um cliente do Firestore após a confirmação do usuário.
 * @param {string} id - O ID do documento do cliente a ser excluído.
 */
async function excluirCliente(id) {
  try {
    // Cria a referência direta ao documento do cliente e o exclui.
    const clienteDocRef = doc(db, "empresarios", empresaId, "clientes", id);
    await deleteDoc(clienteDocRef);
    
    // Efeito visual para remover o card da tela suavemente.
    const itemRemovido = document.querySelector(`.card[data-id="${id}"]`);
    if (itemRemovido) {
      itemRemovido.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      itemRemovido.style.opacity = "0";
      itemRemovido.style.transform = "scale(0.95)";
      setTimeout(() => itemRemovido.remove(), 400); // Remove o elemento do DOM após a transição.
    }
    
    mostrarToast("Cliente excluído com sucesso!", "#ef4444"); // Cor vermelha para exclusão
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);
    mostrarToast("Erro ao excluir o cliente. Tente novamente.", "#ef4444");
  }
}

/**
 * Configura um único listener de eventos no container da lista de clientes (Event Delegation).
 * Isso é mais eficiente do que adicionar um listener para cada botão.
 */
function configurarListenersDeAcao() {
  if (!listaClientesDiv) return;
  
  listaClientesDiv.addEventListener("click", async (event) => {
    const target = event.target;
    
    // Verifica se o clique foi em um botão de exclusão ou em um ícone dentro dele.
    const btnRemove = target.closest(".btn-remove");
    if (btnRemove) {
      const clienteId = btnRemove.dataset.id;
      const card = btnRemove.closest(".card");
      const nomeCliente = card ? card.querySelector(".card-title").textContent.trim() : "este cliente";

      // Pede confirmação antes de realizar a ação destrutiva.
      const confirmado = await mostrarConfirmacao(`Tem certeza que deseja excluir "${nomeCliente}"? Esta ação não pode ser desfeita.`);

      if (confirmado && clienteId) {
        await excluirCliente(clienteId);
      }
    }
  });
}
