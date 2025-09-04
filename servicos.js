// ======================================================================
// ARQUIVO: servicos.js (VERSÃO FINAL, COMPLETA, MULTIEMPRESAS, ADMIN E DONO NÃO BLOQUEADOS)
// ======================================================================

// 1. Importa as funções da versão correta e consistente do Firebase
import {
  collection, doc, getDocs, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');
const loader = document.getElementById('loader');
const appContent = document.getElementById('app-content');

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;
let isAdmin = false;
let isInitialized = false;

// --- Funções Auxiliares ---
function getEmpresaIdAtiva() {
  const empresaId = localStorage.getItem("empresaAtivaId");
  console.log("🔍 [DEBUG] EmpresaId do localStorage:", empresaId);
  return empresaId;
}
function setEmpresaIdAtiva(id) {
  if (id) {
    localStorage.setItem("empresaAtivaId", id);
    console.log("💾 [DEBUG] EmpresaId salvo no localStorage:", id);
  } else {
    localStorage.removeItem("empresaAtivaId");
    console.log("🗑️ [DEBUG] EmpresaId removido do localStorage");
  }
}
function formatarPreco(preco) {
  if (preco === undefined || preco === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

// --- Funções de Renderização e Ações ---
function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;
  if (!servicos || servicos.length === 0) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
    return;
  }
  // Agrupa os serviços por categoria
  const agrupados = {};
  servicos.forEach(servico => {
    const cat = (servico.categoria && servico.categoria.trim()) ? servico.categoria.trim() : "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(servico);
  });
  const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => `
    <div class="categoria-bloco">
      <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">${cat}</h2>
      ${agrupados[cat].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(servico => `
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
              ${(isDono || isAdmin) ? `<button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>` : ""}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function carregarServicosDoFirebase() {
  if (!empresaId) {
    console.error("❌ [ERROR] Tentativa de carregar serviços sem empresaId");
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
    return;
  }
  console.log("📋 [DEBUG] Carregando serviços para empresa:", empresaId);
  if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
  try {
    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("✅ [DEBUG] Serviços carregados:", servicos.length);
    renderizarServicos(servicos);
  } catch (error) {
    console.error("❌ [ERROR] Erro ao carregar serviços:", error);
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
  }
}

async function excluirServico(servicoId) {
  if (!(isDono || isAdmin)) {
    await showAlert("Acesso Negado", "Apenas o dono ou admin pode excluir serviços.");
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
    console.error("❌ [ERROR] Erro ao excluir serviço:", error);
    await showAlert("Erro", "Ocorreu um erro ao excluir o serviço: " + (error.message || error));
  }
}

// --- Função para verificar se usuário tem acesso à empresa ---
async function verificarAcessoEmpresa(user, empresaId) {
  try {
    console.log("🔐 [DEBUG] Verificando acesso à empresa:", empresaId);
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    if (!empresaSnap.exists()) {
      console.log("❌ [DEBUG] Empresa não existe no Firestore");
      return { hasAccess: false, isDono: false, reason: "EMPRESA_NAO_EXISTE" };
    }
    const empresaData = empresaSnap.data();
    const isOwner = empresaData.donoId === user.uid;
    let isProfissional = false;
    if (empresaData.profissionais && Array.isArray(empresaData.profissionais)) {
      isProfissional = empresaData.profissionais.some(prof => prof.uid === user.uid);
    }
    const hasAccess = isOwner || isProfissional;
    console.log("🔐 [DEBUG] Resultado da verificação:", {
      isOwner,
      isProfissional,
      hasAccess,
      empresaNome: empresaData.nome
    });
    return {
      hasAccess,
      isDono: isOwner,
      isProfissional,
      empresaNome: empresaData.nome,
      reason: hasAccess ? "OK" : "SEM_PERMISSAO"
    };
  } catch (error) {
    console.error("❌ [ERROR] Erro ao verificar acesso à empresa:", error);
    return { hasAccess: false, isDono: false, reason: "ERRO_VERIFICACAO" };
  }
}

// --- Função para buscar empresas do usuário ---
async function buscarEmpresasDoUsuario(user) {
  try {
    console.log("🔍 [DEBUG] Buscando empresas do usuário:", user.uid);
    const empresasCol = collection(db, "empresarios");
    const empresasSnap = await getDocs(empresasCol);
    const empresasDoUsuario = [];
    empresasSnap.forEach(doc => {
      const empresaData = doc.data();
      const isOwner = empresaData.donoId === user.uid;
      let isProfissional = false;
      if (empresaData.profissionais && Array.isArray(empresaData.profissionais)) {
        isProfissional = empresaData.profissionais.some(prof => prof.uid === user.uid);
      }
      if (isOwner || isProfissional) {
        empresasDoUsuario.push({
          id: doc.id,
          nome: empresaData.nome,
          isDono: isOwner,
          isProfissional
        });
      }
    });
    console.log("🏢 [DEBUG] Empresas encontradas:", empresasDoUsuario);
    return empresasDoUsuario;
  } catch (error) {
    console.error("❌ [ERROR] Erro ao buscar empresas do usuário:", error);
    return [];
  }
}

// --- Ponto de Entrada Principal (Lógica Corrigida) ---
onAuthStateChanged(auth, async (user) => {
  if (isInitialized) {
    console.log("⚠️ [DEBUG] onAuthStateChanged já foi inicializado, ignorando...");
    return;
  }
  console.log("🚀 [DEBUG] Iniciando onAuthStateChanged");
  if (!user) {
    console.log("❌ [DEBUG] Usuário não logado, redirecionando para login");
    window.location.href = 'login.html';
    return;
  }
  console.log("✅ [DEBUG] Usuário logado:", user.uid);
  if (loader) loader.style.display = 'block';
  if (appContent) appContent.style.display = 'none';

  const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
  isAdmin = (user.uid === ADMIN_UID);

  // --- ADMIN SEMPRE TEM ACESSO ---
  if (isAdmin) {
    empresaId = getEmpresaIdAtiva();
    if (!empresaId) {
      // Tenta buscar qualquer empresa (primeira existente)
      const empresasCol = collection(db, "empresarios");
      const snap = await getDocs(empresasCol);
      if (!snap.empty) {
        empresaId = snap.docs[0].id;
        setEmpresaIdAtiva(empresaId);
      }
    }
    if (!empresaId) {
      listaServicosDiv.innerHTML = '<p style="color:red;">Nenhuma empresa encontrada.</p>';
      if (loader) loader.style.display = 'none';
      if (appContent) appContent.style.display = 'block';
      isInitialized = true;
      return;
    }
    if (btnAddServico) btnAddServico.style.display = 'inline-flex';
    await carregarServicosDoFirebase();
    if (loader) loader.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    isInitialized = true;
    return;
  }

  // --- FLUXO NORMAL (DONO/PROF) ---
  try {
    const empresaIdSalva = getEmpresaIdAtiva();
    if (empresaIdSalva) {
      const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
      if (verificacao.hasAccess) {
        empresaId = empresaIdSalva;
        isDono = verificacao.isDono;
        if (btnAddServico) btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
        await carregarServicosDoFirebase();
        isInitialized = true;
        if (loader) loader.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        return;
      } else {
        setEmpresaIdAtiva(null);
      }
    }
    const empresasDisponiveis = await buscarEmpresasDoUsuario(user);
    if (empresasDisponiveis.length === 0) {
      if (loader) loader.innerHTML = '<p style="color:red;">Você não tem acesso a nenhuma empresa. Entre em contato com o administrador.</p>';
      isInitialized = true;
      if (appContent) appContent.style.display = 'block';
      return;
    } else if (empresasDisponiveis.length === 1) {
      const empresa = empresasDisponiveis[0];
      empresaId = empresa.id;
      isDono = empresa.isDono;
      setEmpresaIdAtiva(empresaId);
      if (btnAddServico) btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
      await carregarServicosDoFirebase();
      isInitialized = true;
      if (loader) loader.style.display = 'none';
      if (appContent) appContent.style.display = 'block';
      return;
    } else {
      window.location.href = 'selecionar-empresa.html';
      return;
    }
  } catch (error) {
    console.error("❌ [ERROR] Erro fatal durante a inicialização:", error);
    if (loader) {
      loader.innerHTML = `
        <div style="color:red; text-align: center; padding: 20px;">
          <p>Ocorreu um erro ao carregar a página.</p>
          <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Tentar Novamente
          </button>
        </div>
      `;
    }
  } finally {
    if (loader) loader.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    isInitialized = true;
  }
});

// --- Listeners de Eventos ---
if (listaServicosDiv) {
  listaServicosDiv.addEventListener('click', async function(e) {
    const target = e.target.closest('.btn-acao');
    if (!target) return;
    const id = target.dataset.id;
    if (!id) return;
    if (target.classList.contains('btn-editar')) {
      if (isDono || isAdmin) {
        window.location.href = `novo-servico.html?id=${id}`;
      } else {
        await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
      }
    }
    if (target.classList.contains('btn-excluir')) {
      await excluirServico(id);
    }
  });
}
if (btnAddServico) {
  btnAddServico.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isDono || isAdmin) {
      window.location.href = 'novo-servico.html';
    } else {
      await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
    }
  });
}

// --- Função para debug (remover em produção) ---
window.debugServicos = {
  getEmpresaId: () => empresaId,
  getIsDono: () => isDono,
  getIsAdmin: () => isAdmin,
  getLocalStorage: () => localStorage.getItem("empresaAtivaId"),
  clearEmpresa: () => {
    setEmpresaIdAtiva(null);
    window.location.reload();
  },
  recarregar: () => window.location.reload()
};

console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugServicos");
