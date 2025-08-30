// servicos.js
// Gerencia a listagem, exclusão e navegação dos serviços.

import {
  collection,
  doc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./vitrini-firebase.js";
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');
const loader = document.getElementById('loader');
const appContent = document.getElementById('app-content');

let empresaId = null;
let isDono = false;

// Obtém o empresaId da empresa ativa do localStorage (MULTIEMPRESA)
function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId") || null;
}

// Permite dono ou profissional acessar a empresa
async function getEmpresaDoUsuario(uid) {
  // Dono
  let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
  let snapshot = await getDocs(q);
  if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

  // Profissional
  q = query(collection(db, "empresarios"), where("profissionaisUids", "array-contains", uid));
  snapshot = await getDocs(q);
  if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

  return null;
}

// Inicialização e autenticação
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  empresaId = getEmpresaIdAtiva();
  if (!empresaId) {
    // Força o usuário a selecionar uma empresa ativa
    if (loader) loader.innerHTML = '<p style="color:red;">Nenhuma empresa ativa selecionada. Selecione uma empresa primeiro.</p>';
    if (appContent) appContent.style.display = 'none';
    window.location.href = 'selecionar-empresa.html';
    return;
  }

  try {
    // Busca empresa pelo ID salvo
    let empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
    let empresa;
    if (empresaSnap.exists()) {
      empresa = { id: empresaSnap.id, ...empresaSnap.data() };
      isDono = empresa.donoId === user.uid;
    } else {
      // Tenta buscar empresa do usuário (dono ou profissional)
      empresa = await getEmpresaDoUsuario(user.uid);
      isDono = empresa && empresa.donoId === user.uid;
      if (empresa && empresa.id) empresaId = empresa.id;
      // Atualiza no localStorage se achou por outro caminho
      if (empresa && empresa.id) localStorage.setItem("empresaAtivaId", empresa.id);
    }

    // Se mesmo assim não achou, força seleção
    if (!empresa || !empresa.id) {
      if (loader) loader.innerHTML = '<p style="color:red;">Não foi possível encontrar uma empresa ativa. Selecione uma empresa primeiro.</p>';
      if (appContent) appContent.style.display = 'none';
      window.location.href = 'selecionar-empresa.html';
      return;
    }

    await carregarServicosDoFirebase();

    if (btnAddServico) btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
    if (loader) loader.style.display = 'none';
    if (appContent) appContent.style.display = 'block';

  } catch (error) {
    console.error("Erro fatal durante a inicialização:", error);
    if (loader) loader.innerHTML = `<p style="color:red;">Ocorreu um erro crítico ao carregar a página.</p>`;
    if (appContent) appContent.style.display = 'none';
  }
});

async function carregarServicosDoFirebase() {
  if (!empresaId) {
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
    return;
  }
  if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>A carregar serviços...</p>';

  try {
    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarServicos(servicos);
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
  }
}

function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;

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

async function excluirServico(servicoId) {
  if (!isDono) {
    await showAlert("Acesso Negado", "Apenas o dono pode excluir serviços.");
    return;
  }
  const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
  if (!confirmado) return;

  try {
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    await deleteDoc(servicoRef);
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
  } catch (error) {
    await showAlert("Erro", "Ocorreu um erro ao excluir o serviço: " + (error.message || error));
  }
}

function formatarPreco(preco) {
  if (preco === undefined || preco === null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

// Delegação de eventos para editar e excluir
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
      excluirServico(id);
    }
  });
}

if (btnAddServico) {
  btnAddServico.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'novo-servico.html';
  });
}
