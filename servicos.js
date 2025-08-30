// ======================================================================
// ARQUIVO: servicos.js (VERSÃO CORRIGIDA - SEM REDIRECIONAMENTO INDEVIDO)
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
const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');
const loader = document.getElementById('loader');
const appContent = document.getElementById('app-content');

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;
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
    
    // Verifica se é profissional da empresa
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
    
    // Busca empresas onde o usuário é dono
    const empresasCol = collection(db, "empresarios");
    const empresasSnap = await getDocs(empresasCol);
    
    const empresasDoUsuario = [];
    
    empresasSnap.forEach(doc => {
      const empresaData = doc.data();
      const isOwner = empresaData.donoId === user.uid;
      
      // Verifica se é profissional
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
  // Evita execução múltipla
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

  try {
    // 1. Pega o ID da empresa ativa do localStorage
    const empresaIdSalva = getEmpresaIdAtiva();

    if (empresaIdSalva) {
      // 2. Se há uma empresa salva, verifica se o usuário ainda tem acesso
      console.log("🔍 [DEBUG] Verificando empresa salva:", empresaIdSalva);
      
      const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
      
      if (verificacao.hasAccess) {
        // ✅ Usuário tem acesso à empresa salva
        console.log("✅ [DEBUG] Acesso confirmado à empresa salva");
        empresaId = empresaIdSalva;
        isDono = verificacao.isDono;
        
        // Configura UI baseado nas permissões
        if (btnAddServico) {
          btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
        }
        
        // Carrega os serviços
        await carregarServicosDoFirebase();
        isInitialized = true;
        return;
        
      } else {
        // ❌ Usuário perdeu acesso à empresa salva
        console.log("❌ [DEBUG] Usuário perdeu acesso à empresa salva:", verificacao.reason);
        setEmpresaIdAtiva(null); // Remove do localStorage
      }
    }

    // 3. Se não há empresa salva OU perdeu acesso, busca empresas disponíveis
    console.log("🔍 [DEBUG] Buscando empresas disponíveis para o usuário");
    const empresasDisponiveis = await buscarEmpresasDoUsuario(user);

    if (empresasDisponiveis.length === 0) {
      // Usuário não tem acesso a nenhuma empresa
      console.log("❌ [DEBUG] Usuário não tem acesso a nenhuma empresa");
      if (loader) loader.innerHTML = '<p style="color:red;">Você não tem acesso a nenhuma empresa. Entre em contato com o administrador.</p>';
      return;
      
    } else if (empresasDisponiveis.length === 1) {
      // Usuário tem acesso a apenas uma empresa - seleciona automaticamente
      console.log("✅ [DEBUG] Usuário tem acesso a apenas uma empresa, selecionando automaticamente");
      const empresa = empresasDisponiveis[0];
      
      empresaId = empresa.id;
      isDono = empresa.isDono;
      setEmpresaIdAtiva(empresaId);
      
      // Configura UI
      if (btnAddServico) {
        btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
      }
      
      // Carrega os serviços
      await carregarServicosDoFirebase();
      
    } else {
      // Usuário tem acesso a múltiplas empresas - precisa selecionar
      console.log("🔄 [DEBUG] Usuário tem acesso a múltiplas empresas, redirecionando para seleção");
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
    // Esconde o loader e mostra o conteúdo
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
      if (isDono) {
        window.location.href = `novo-servico.html?id=${id}`;
      } else {
        await showAlert("Acesso Negado", "Apenas o dono pode editar serviços.");
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
    if (isDono) {
      window.location.href = 'novo-servico.html';
    } else {
      await showAlert("Acesso Negado", "Apenas o dono pode adicionar serviços.");
    }
  });
}

// --- Função para debug (remover em produção) ---
window.debugServicos = {
  getEmpresaId: () => empresaId,
  getIsDono: () => isDono,
  getLocalStorage: () => localStorage.getItem("empresaAtivaId"),
  clearEmpresa: () => {
    setEmpresaIdAtiva(null);
    window.location.reload();
  },
  recarregar: () => window.location.reload()
};

console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugServicos");
