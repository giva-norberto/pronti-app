import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const clientesCollection = collection(db, "clientes");
const listaClientesDiv = document.getElementById('lista-clientes');

async function carregarClientesDoFirebase() {
    listaClientesDiv.innerHTML = "<p>Carregando clientes...</p>";
    try {
        const clientesQuery = query(clientesCollection, orderBy("nome"));
        const clientesSnapshot = await getDocs(clientesQuery);

        if (clientesSnapshot.empty) {
            listaClientesDiv.innerHTML = '<p>Nenhum cliente cadastrado.</p>';
            return;
        }

        listaClientesDiv.innerHTML = '';

        clientesSnapshot.forEach(doc => {
            const cliente = doc.data();
            const clienteId = doc.id;

            const clienteElemento = document.createElement('div');
            // Adicionamos o data-id ao elemento principal do card do cliente
            clienteElemento.classList.add('cliente-item');
            clienteElemento.dataset.id = clienteId; 

            clienteElemento.innerHTML = `
              <div class="item-info">
                <h3>${cliente.nome}</h3>
                <p style="color: #6b7280; margin: 5px 0 0 0;">${cliente.telefone || ''}</p>
              </div>
              <div class="item-acoes">
                <a href="ficha-cliente.html?id=${clienteId}" class="btn-ver-historico">Ver histórico</a>
                <button class="btn-excluir" data-id="${clienteId}">Excluir</button>
              </div>
            `;

            listaClientesDiv.appendChild(clienteElemento);
        });

    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        listaClientesDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar os clientes.</p>';
    }
}

// FUNÇÃO DE EXCLUSÃO ATUALIZADA COM SUA SUGESTÃO
async function excluirCliente(id) {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
        try {
            const docParaApagar = doc(db, "clientes", id);
            await deleteDoc(docParaApagar);

            Toastify({ text: "Cliente excluído com sucesso!", style: { background: "#dc3545" } }).showToast();

            // Remove visualmente o cliente da tela sem recarregar tudo
            const itemRemovido = document.querySelector(`.cliente-item[data-id="${id}"]`);
            if (itemRemovido) {
                itemRemovido.remove();
            }

        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            Toastify({ text: "Erro ao excluir o cliente.", style: { background: "red" } }).showToast();
        }
    }
}

// O "Ouvinte" de cliques continua o mesmo
listaClientesDiv.addEventListener('click', (event) => {
    if (event.target && event.target.classList.contains('btn-excluir')) {
        const clienteId = event.target.dataset.id;
        excluirCliente(clienteId);
    }
});

// Executa a função para carregar os clientes
carregarClientesDoFirebase();
