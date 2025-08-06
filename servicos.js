import { collection, doc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');
let empresaId = null;
let isDono = false;

// Modal customizado de confirmação CORRIGIDO
function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const modalTitle = document.getElementById('modal-titulo');
    const modalMessage = document.getElementById('modal-mensagem');
    const btnConfirmar = document.getElementById('modal-btn-confirmar');
    const btnCancelar = document.getElementById('modal-btn-cancelar');

    if (!modal || !modalTitle || !modalMessage || !btnConfirmar || !btnCancelar) {
      console.warn("Modal customizado não encontrado, usando confirm padrão.");
      resolve(confirm(message));
      return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Remove event listeners antigos (importante para evitar duplicidade)
    const newBtnConfirmar = btnConfirmar.cloneNode(true);
    const newBtnCancelar = btnCancelar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(newBtnConfirmar, btnConfirmar);
    btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);

    const close = (value) => {
      modal.classList.remove('ativo');
      modal.style.display = 'none';
      resolve(value);
    };

    newBtnConfirmar.addEventListener('click', () => close(true));
    newBtnCancelar.addEventListener('click', () => close(false));

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('ativo'), 10);
  });
}

function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

function renderizarServicos(servicos) {
    if (!servicos || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>`;
        return;
    }
    servicos.sort((a, b) => a.nome.localeCompare(b.nome));
    listaServicosDiv.innerHTML = servicos.map(servico => `
        <div class="servico-card">
            <div class="servico-header">
                <h3 class="servico-titulo">${servico.nome}</h3>
            </div>
            <p class="servico-descricao">${servico.descricao || ''}</p>
            <div class="servico-footer">
                <div>
                    <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                    <span class="servico-duracao"> • ${servico.duracao} min</span>
                </div>
                <div class="servico-acoes">
                    <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
                    ${isDono ? `<button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>` : ""}
                </div>
            </div>
        </div>
    `).join('');
}

// Busca a empresa do usuário (dono ou profissional)
async function getEmpresaDoUsuario(uid) {
    let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    let snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    q = query(collection(db, "empresarios"), where("profissionaisUids", "array-contains", uid));
    snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return null;
}

async function carregarServicosDoFirebase() {
    if (!empresaId) {
        listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
        return;
    }
    listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
    try {
        const servicosCol = collection(db, "empresarios", empresaId, "servicos");
        const snap = await getDocs(servicosCol);
        const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarServicos(servicos);
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    }
}

// Função de excluir serviço com debug detalhado
async function excluirServicoDebug(servicoIdParaExcluir) {
    console.groupCollapsed("=== DEBUG EXCLUIR SERVIÇO ===");
    try {
        console.log("Função excluirServico chamada para:", servicoIdParaExcluir);
        console.log("empresaId atual:", empresaId);
        console.log("isDono:", isDono);

        // Mostra o usuário logado (modular ou compatível)
        if (typeof auth !== "undefined" && auth.currentUser) {
            console.log("UID logado:", auth.currentUser.uid);
        } else if (typeof firebase !== "undefined" && firebase.auth().currentUser) {
            console.log("UID logado:", firebase.auth().currentUser.uid);
        } else {
            console.warn("Não consegui obter o UID logado!");
        }

        // Confirmação do modal
        const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
        console.log("Modal de confirmação:", confirmado);
        if (!isDono) {
            console.warn("Usuário não é dono! Exclusão não permitida.");
            alert("Apenas o dono pode excluir serviços.");
            console.groupEnd();
            return;
        }
        if (!confirmado) {
            console.log("Usuário cancelou a exclusão.");
            console.groupEnd();
            return;
        }

        // Caminho do documento
        const caminho = `empresarios/${empresaId}/servicos/${servicoIdParaExcluir}`;
        console.log("Caminho do documento para deleteDoc:", caminho);

        // Cria referência ao documento do serviço
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoIdParaExcluir);
        console.log("Objeto servicoRef:", servicoRef);

        // Tenta excluir o documento
        await deleteDoc(servicoRef);
        console.log("deleteDoc executado SEM ERROS!");

        alert("Serviço excluído com sucesso!");
        // Recarrega a lista de serviços
        carregarServicosDoFirebase();
    } catch (error) {
        // Mostra detalhes do erro
        console.error("Erro ao excluir serviço:", error.code, error.message, error);
        alert("Ocorreu um erro ao excluir o serviço: " + error.message);
    }
    console.groupEnd();
}

// Diagnóstico: log de clique com debug detalhado
listaServicosDiv.addEventListener('click', function(e) {
    const target = e.target.closest('.btn-acao');
    if (!target) return;

    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('btn-editar')) {
        window.location.href = `novo-servico.html?id=${id}`;
    }

    if (target.classList.contains('btn-excluir')) {
        console.log("Botão excluir clicado, id:", id); // Diagnóstico
        excluirServicoDebug(id);
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresa = await getEmpresaDoUsuario(user.uid);
        if (empresa) {
            empresaId = empresa.id;
            isDono = empresa.donoId === user.uid;
            carregarServicosDoFirebase();
            if (btnAddServico) btnAddServico.style.display = isDono ? '' : 'none';
        } else {
            listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Botão de adicionar novo serviço (opcional, só para dono)
if (btnAddServico) {
    btnAddServico.addEventListener('click', () => {
        window.location.href = 'novo-servico.html';
    });
}
