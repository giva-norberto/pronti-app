// ======================================================================
// ARQUIVO: servicos.js (COM LÓGICA DE INICIALIZAÇÃO ROBUSTA)
// ======================================================================

// 1. Importa as funções da versão correta e consistente do Firebase
import {
  collection, doc, getDocs, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 2. IMPORTANTE: Garante que está importando do arquivo de configuração MESTRE
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
const listaServicosDiv = document.getElementById('lista-servicos' );
const btnAddServico = document.querySelector('.btn-new');
const loader = document.getElementById('loader');
const appContent = document.getElementById('app-content');

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;

// --- Funções Auxiliares ---

function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId");
}

function formatarPreco(preco) {
  if (preco === undefined || preco === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

// --- Funções de Renderização e Ações (Sem alterações na lógica principal) ---

function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;

  if (!servicos || servicos.length === 0) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${isDono ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
    return;
  }
  servicos.sort((a, b) => a.nome.localeCompare(b.nome));
  listaServicosDiv.innerHTML = servicos.map(servico => `
    <div class="servico-card">
      <div class="servico-header">
        <h3 class="servico-titulo">${servico.nome}</h3>
      </div>
      <p class="servico-descricao">${servico.descricao || 'Sem descrição.'}</p>
      <div class="servico-footer">
        <div>
          <span class="servico-preco">${formatarPreco(servico.preco)}</span>
          <span class="servico-duracao"> • ${servico.duracao || 0} min</span>
        </div>
        <div class="servico-acoes">
          <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
          ${isDono ? `<button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>` : ""}
        </div>
      </div>
    </div>
  `).join('');
}

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

async function excluirServico(servicoId) {
  if (!isDono) {
    await showAlert("Acesso Negado", "Apenas o dono pode excluir serviços.");
    return;
  }
  const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço?");
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

// --- Ponto de Entrada Principal (Lógica de Inicialização Melhorada) ---

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  if (loader) loader.style.display = 'block';
  if (appContent) appContent.style.display = 'none';

  try {
    // 1. Pega o ID da empresa ativa.
    empresaId = getEmpresaIdAtiva();

    // 2. Se NÃO HOUVER ID, aí sim redireciona para a seleção.
    if (!empresaId) {
      console.log("Nenhuma empresa ativa encontrada. Redirecionando para seleção...");
      window.location.href = 'selecionar-empresa.html';
      return; // Para a execução aqui.
    }

    // 3. Se HÁ um ID, verifica se ele é válido e se o usuário tem permissão.
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);

    // 4. Se a empresa não existe ou o usuário não é o dono, ele não tem permissão.
    if (!empresaSnap.exists() || empresaSnap.data().donoId !== user.uid) {
      isDono = false;
      // Esconde o botão de adicionar, pois o usuário não é o dono.
      if (btnAddServico) btnAddServico.style.display = 'none';
      // Mesmo não sendo dono, ele pode ser um profissional e ver os serviços.
      // Então, carregamos os serviços, mas a UI vai se adaptar (sem botões de excluir).
    } else {
      // Se a empresa existe e o usuário é o dono, define a permissão.
      isDono = true;
      // Mostra o botão de adicionar.
      if (btnAddServico) btnAddServico.style.display = 'inline-flex';
    }

    // 5. Com as permissões definidas, carrega os serviços na tela.
    await carregarServicosDoFirebase();

  } catch (error) {
    console.error("Erro fatal durante a inicialização:", error);
    if (loader) loader.innerHTML = `<p style="color:red;">Ocorreu um erro crítico ao carregar a página.</p>`;
  } finally {
    // 6. Esconde o loader e mostra o conteúdo, independentemente do resultado.
    if (loader) loader.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
  }
});


// --- Listeners de Eventos (Sem alterações) ---

if (listaServicosDiv) {
  listaServicosDiv.addEventListener('click', function(e) {
    const target = e.target.closest('.btn-acao');
    if (!target) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('btn-editar')) {
      // Adicionada verificação de dono aqui também por segurança extra.
      if (isDono) {
        window.location.href = `novo-servico.html?id=${id}`;
      } else {
        showAlert("Acesso Negado", "Apenas o dono pode editar serviços.");
      }
    }
    if (target.classList.contains('btn-excluir')) {
      excluirServico(id);
    }
  });
}

if (btnAddServico) {
  btnAddServico.addEventListener('click', (e) => {
    e.preventDefault();
    if (isDono) {
      window.location.href = 'novo-servico.html';
    }
  });
}
