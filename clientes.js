import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const clientesCollection = collection(db, "clientes");
const listaClientesDiv = document.getElementById('lista-clientes');

// Pega os elementos do nosso novo modal
const modal = document.getElementById('modal-confirmacao');
const modalMensagem = document.getElementById('modal-mensagem');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');

// Função para mostrar a confirmação personalizada
function mostrarConfirmacao(mensagem) {
  modalMensagem.textContent = mensagem;
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('visivel'), 10);

  return new Promise((resolve) => {
    btnModalConfirmar.onclick = () => {
      modal.classList.remove('visivel');
      setTimeout(() => modal.style.display = 'none', 300);
      resolve(true); // Usuário confirmou
    };
    btnModalCancelar.onclick = () => {
      modal.classList.remove('visivel');
      setTimeout(() => modal.style.display = 'none', 300);
      resolve(false); // Usuário cancelou
    };
  });
}

async function carregarClientesDoFirebase() {
    listaClientesDiv.innerHTML = "<p>Carregando clientes...</p>";
    try {
        const clientesQuery = query(clientesCollection, orderBy("nome"));
        const clientesSnapshot = await getDocs(clientesQuery);
        if (clientesSnapshot.empty) {
            listaClientesDiv.innerHTML = '<p>Nenhum cliente cadastrado.</p>'; return;
        }
        listaClientesDiv.innerHTML = '';
        clientesSnapshot.forEach(doc => {
            const cliente = doc.data(); const clienteId = doc.id;
            if (cliente.nome) { 
                const el = document.createElement('div');
                el.classList.add('cliente-item'); el.dataset.id = clienteId;
                el.innerHTML = `
                  <div class="item-info"><h3>${cliente.nome}</h3><p style="color: #6b7280; margin: 5px 0 0 0;">${cliente.telefone || ''}</p></div>
                  <div class="item-acoes"><a href="ficha-cliente.html?id=${clienteId}" class="btn-ver-historico">Ver histórico</a><button class="btn-excluir" data-id="${clienteId}">Excluir</button></div>
                `;
                listaClientesDiv.appendChild(el);
            }
        });
    } catch (error) { console.error("Erro ao buscar clientes:", error); }
}

async function excluirCliente(id) {
    try {
        await deleteDoc(doc(db, "clientes", id));
        // MENSAGEM DE SUCESSO PADRONIZADA (VERDE)
        Toastify({ text: "Cliente excluído com sucesso!", style: { background: "var(--cor-sucesso)" } }).showToast();
        const itemRemovido = document.querySelector(`.cliente-item[data-id="${id}"]`);
        if (itemRemovido) itemRemovido.remove();
    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        Toastify({ text: "Erro ao excluir o cliente.", style: { background: "var(--cor-perigo)" } }).showToast();
    }
}

listaClientesDiv.addEventListener('click', async (event) => {
    if (event.target && event.target.classList.contains('btn-excluir')) {
        const clienteId = event.target.dataset.id;
        const nomeCliente = event.target.closest('.cliente-item').querySelector('h3').textContent;

        // CHAMA NOSSO NOVO MODAL
        const confirmado = await mostrarConfirmacao(`Tem certeza que deseja excluir "${nomeCliente}"? Esta ação é permanente.`);

        if (confirmado) {
            excluirCliente(clienteId);
        }
    }
});

carregarClientesDoFirebase();