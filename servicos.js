// servicos.js
// RESPONSABILIDADE: Gerenciar a listagem, exclusão e navegação dos serviços cadastrados pela empresa no painel Pronti.
// OTIMIZAÇÕES: Garante persistência do login, exibe feedback de carregamento e reduz delay na experiência do usuário.

import { collection, doc, getDocs, deleteDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');
let empresaId = null;
let isDono = false;

// Modal customizado de confirmação
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
        if (listaServicosDiv) {
            listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>`;
        }
        return;
    }
    servicos.sort((a, b) => a.nome.localeCompare(b.nome));
    if (listaServicosDiv) {
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
}

// Busca a empresa do usuário (dono ou profissional)
async function getEmpresaDoUsuario(uid) {
    // Primeiro busca como dono
    let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    let snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    // Depois busca como profissional
    q = query(collection(db, "empresarios"), where("profissionaisUids", "array-contains", uid));
    snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return null;
}

async function carregarServicosDoFirebase() {
    if (!empresaId) {
        if (listaServicosDiv) {
            listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
        }
        return;
    }
    if (listaServicosDiv) {
        listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
    }
    try {
        // Use limit() se tiver muitos serviços para melhorar performance, ajuste conforme necessário
        const servicosCol = collection(db, "empresarios", empresaId, "servicos");
        // const snap = await getDocs(query(servicosCol, limit(30))); // Descomente para limitar a 30
        const snap = await getDocs(servicosCol);
        const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarServicos(servicos);
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        if (listaServicosDiv) {
            listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
        }
    }
}

// Função de excluir serviço com debug detalhado
async function excluirServicoDebug(servicoIdParaExcluir) {
    try {
        // Confirmação do modal
        const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
        if (!isDono) {
            alert("Apenas o dono pode excluir serviços.");
            return;
        }
        if (!confirmado) {
            return;
        }

        // Cria referência ao documento do serviço
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoIdParaExcluir);

        // Tenta excluir o documento
        await deleteDoc(servicoRef);

        alert("Serviço excluído com sucesso!");
        // Recarrega a lista de serviços
        carregarServicosDoFirebase();
    } catch (error) {
        alert("Ocorreu um erro ao excluir o serviço: " + error.message);
    }
}

// Diagnóstico: log de clique com debug detalhado
if (listaServicosDiv) {
    listaServicosDiv.addEventListener('click', function(e) {
        const target = e.target.closest('.btn-acao');
        if (!target) return;

        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-editar')) {
            window.location.href = `novo-servico.html?id=${id}`;
        }

        if (target.classList.contains('btn-excluir')) {
            excluirServicoDebug(id);
        }
    });
}

// Melhoria: mostra o loader assim que inicia o script
document.getElementById('loader')?.classList.remove('hidden');
document.getElementById('app-content')?.classList.add('hidden');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Mostra o loader enquanto carrega a empresa e os serviços
        document.getElementById('loader')?.classList.remove('hidden');
        document.getElementById('app-content')?.classList.add('hidden');
        const empresa = await getEmpresaDoUsuario(user.uid);
        if (empresa) {
            empresaId = empresa.id;
            isDono = empresa.donoId === user.uid;
            await carregarServicosDoFirebase();
            if (btnAddServico) btnAddServico.style.display = isDono ? '' : 'none';
            // Oculta o loader e mostra o app quando terminar tudo
            document.getElementById('loader')?.classList.add('hidden');
            document.getElementById('app-content')?.classList.remove('hidden');
        } else {
            if (listaServicosDiv) {
                listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
            }
            document.getElementById('loader')?.classList.add('hidden');
            document.getElementById('app-content')?.classList.remove('hidden');
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

/*
    DICAS DE PERFORMANCE:
    - Se você tem muitos serviços, use o método limit() do Firestore na consulta.
    - Otimize suas regras do Firestore para retornar apenas os documentos realmente necessários.
    - Utilize indexação no Firestore se o dataset for grande.
    - Loader só é removido depois de buscar e renderizar os serviços.
*/
