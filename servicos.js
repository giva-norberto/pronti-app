// ======================================================================
// ARQUIVO: servicos.js (VERSÃO FINAL MULTIEMPRESAS, CRASH-FREE, E ACESSO ROBUSTO)
// ======================================================================

import {
  collection, doc, getDocs, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
let listaServicosDiv, btnAddServico, loader, appContent;

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;
let isAdmin = false;
let isInitialized = false;
let isProcessing = false; // Previne múltiplas execuções simultâneas

// --- Inicialização segura do DOM ---
function initializeDOMElements() {
  try {
    listaServicosDiv = document.getElementById('lista-servicos');
    btnAddServico = document.querySelector('.btn-new');
    loader = document.getElementById('loader');
    appContent = document.getElementById('app-content');
  } catch (error) {
    console.error("❌ [ERROR] Erro ao inicializar elementos DOM:", error);
  }
}

// --- Funções Auxiliares ---
function getEmpresaIdAtiva() {
  try {
    const empresaId = localStorage.getItem("empresaAtivaId");
    console.log("🔍 [DEBUG] EmpresaId do localStorage:", empresaId);
    return empresaId;
  } catch (error) {
    console.error("❌ [ERROR] Erro ao acessar localStorage:", error);
    return null;
  }
}

function setEmpresaIdAtiva(id) {
  try {
    if (id) {
      localStorage.setItem("empresaAtivaId", id);
      console.log("💾 [DEBUG] EmpresaId salvo no localStorage:", id);
    } else {
      localStorage.removeItem("empresaAtivaId");
      console.log("🗑️ [DEBUG] EmpresaId removido do localStorage");
    }
  } catch (error) {
    console.error("❌ [ERROR] Erro ao manipular localStorage:", error);
  }
}

function formatarPreco(preco) {
  try {
    if (preco === undefined || preco === null || isNaN(preco)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(Number(preco));
  } catch (error) {
    console.error("❌ [ERROR] Erro ao formatar preço:", error);
    return 'R$ 0,00';
  }
}

// --- Função para sanitizar HTML e prevenir XSS ---
function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Funções de Renderização e Ações ---
function renderizarServicos(servicos) {
  try {
    if (!listaServicosDiv) {
      console.error("❌ [ERROR] Elemento lista-servicos não encontrado");
      return;
    }

    if (!servicos || servicos.length === 0) {
      listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
      return;
    }

    // Agrupa os serviços por categoria com validação
    const agrupados = {};
    servicos.forEach(servico => {
      if (!servico || typeof servico !== 'object') return;
      const cat = (servico.categoria && typeof servico.categoria === 'string' && servico.categoria.trim()) 
        ? servico.categoria.trim() 
        : "Sem Categoria";
      if (!agrupados[cat]) agrupados[cat] = [];
      agrupados[cat].push(servico);
    });

    const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => 
      a.localeCompare(b, 'pt-BR')
    );

    const htmlContent = categoriasOrdenadas.map(cat => {
      const servicosCategoria = agrupados[cat].sort((a, b) => 
        (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
      );

      return `
        <div class="categoria-bloco">
          <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
            ${sanitizeHTML(cat)}
          </h2>
          ${servicosCategoria.map(servico => `
            <div class="servico-card" data-servico-id="${sanitizeHTML(servico.id || '')}">
              <div class="servico-header">
                <h3 class="servico-titulo">${sanitizeHTML(servico.nome || 'Sem nome')}</h3>
              </div>
              <p class="servico-descricao">${sanitizeHTML(servico.descricao || 'Sem descrição.')}</p>
              <div class="servico-footer">
                <div>
                  <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                  <span class="servico-duracao"> • ${sanitizeHTML(String(servico.duracao || 0))} min</span>
                </div>
                <div class="servico-acoes">
                  <button class="btn-acao btn-editar" data-id="${sanitizeHTML(servico.id || '')}" type="button">
                    Editar
                  </button>
                  ${(isDono || isAdmin) ? `
                    <button class="btn-acao btn-excluir" data-id="${sanitizeHTML(servico.id || '')}" type="button">
                      Excluir
                    </button>
                  ` : ""}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

    listaServicosDiv.innerHTML = htmlContent;
    console.log("✅ [DEBUG] Serviços renderizados com sucesso");

  } catch (error) {
    console.error("❌ [ERROR] Erro ao renderizar serviços:", error);
    if (listaServicosDiv) {
      listaServicosDiv.innerHTML = `
        <div style="color:red; text-align: center; padding: 20px;">
          <p>Erro ao exibir os serviços.</p>
          <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Recarregar Página
          </button>
        </div>
      `;
    }
  }
}

async function carregarServicosDoFirebase() {
  if (isProcessing) {
    console.log("⚠️ [DEBUG] Carregamento já em andamento, ignorando...");
    return;
  }

  if (!empresaId) {
    console.error("❌ [ERROR] Tentativa de carregar serviços sem empresaId");
    if (listaServicosDiv) {
      listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
    }
    return;
  }

  isProcessing = true;
  console.log("📋 [DEBUG] Carregando serviços para empresa:", empresaId);
  
  try {
    if (listaServicosDiv) {
      listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
    }

    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        nome: data.nome || '',
        descricao: data.descricao || '',
        preco: data.preco || 0,
        duracao: data.duracao || 0,
        categoria: data.categoria || ''
      };
    });

    console.log("✅ [DEBUG] Serviços carregados:", servicos.length);
    renderizarServicos(servicos);

  } catch (error) {
    console.error("❌ [ERROR] Erro ao carregar serviços:", error);
    if (listaServicosDiv) {
      listaServicosDiv.innerHTML = `
        <div style="color:red; text-align: center; padding: 20px;">
          <p>Erro ao carregar os serviços.</p>
          <p style="font-size: 12px; margin-top: 8px;">${error.message || 'Erro desconhecido'}</p>
          <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Tentar Novamente
          </button>
        </div>
      `;
    }
  } finally {
    isProcessing = false;
  }
}

async function excluirServico(servicoId) {
  if (isProcessing) {
    console.log("⚠️ [DEBUG] Operação já em andamento, ignorando exclusão...");
    return;
  }

  if (!servicoId) {
    console.error("❌ [ERROR] ID do serviço não fornecido");
    await showAlert("Erro", "ID do serviço não encontrado.");
    return;
  }

  if (!(isDono || isAdmin)) {
    await showAlert("Acesso Negado", "Apenas o dono ou admin pode excluir serviços.");
    return;
  }

  isProcessing = true;

  try {
    const confirmado = await showCustomConfirm(
      "Confirmar Exclusão", 
      "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
    );
    
    if (!confirmado) {
      isProcessing = false;
      return;
    }

    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    await deleteDoc(servicoRef);
    
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();

  } catch (error) {
    console.error("❌ [ERROR] Erro ao excluir serviço:", error);
    await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${error.message || 'Erro desconhecido'}`);
  } finally {
    isProcessing = false;
  }
}

// --- Função para verificar se usuário tem acesso à empresa ---
// Busca o array 'empresas' em mapaUsuarios, ou permissões diretas.
async function verificarAcessoEmpresa(user, empresaId) {
  try {
    if (!user || !empresaId) {
      return { hasAccess: false, isDono: false, reason: "PARAMETROS_INVALIDOS" };
    }

    // Busca a lista de empresas do usuário em mapaUsuarios
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    let empresasPermitidas = [];
    if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
      empresasPermitidas = mapaSnap.data().empresas;
    }

    // Se o ID não está no array de empresas do usuário, não há acesso
    if (!empresasPermitidas.includes(empresaId)) {
      return { hasAccess: false, isDono: false, reason: "SEM_PERMISSAO_EM_MAPAUSUARIOS" };
    }

    // Busca dados da empresa
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    if (!empresaSnap.exists()) {
      return { hasAccess: false, isDono: false, reason: "EMPRESA_NAO_EXISTE" };
    }
    const empresaData = empresaSnap.data();

    // Verifica se é dono
    const isOwner = empresaData.donoId === user.uid;

    // Busca profissional na subcoleção (melhor que array no doc!)
    let isProfissional = false;
    let ehDonoProfissional = false;
    try {
      const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
      if (profSnap.exists()) {
        isProfissional = true;
        const profData = profSnap.data();
        ehDonoProfissional = !!profData.ehDono;
      }
    } catch {}

    const isDonoFinal = isOwner || ehDonoProfissional;
    const hasAccess = isDonoFinal || isProfissional || isAdmin;

    return {
      hasAccess,
      isDono: isDonoFinal || isAdmin,
      isProfissional,
      empresaNome: empresaData.nome || 'Empresa sem nome',
      reason: hasAccess ? "OK" : "SEM_PERMISSAO"
    };

  } catch (error) {
    console.error("❌ [ERROR] Erro ao verificar acesso à empresa:", error);
    return { hasAccess: false, isDono: false, reason: "ERRO_VERIFICACAO" };
  }
}

// --- Função para buscar empresas do usuário (via mapaUsuarios) ---
async function buscarEmpresasDoUsuario(user) {
  try {
    if (!user) return [];
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) 
      ? mapaSnap.data().empresas 
      : [];
    // Busca dados de cada empresa
    const promessas = empresas.map(async id => {
      const empresaSnap = await getDoc(doc(db, "empresarios", id));
      if (empresaSnap.exists()) {
        const empresaData = empresaSnap.data();
        // Busca profissional na subcoleção
        let isProfissional = false, ehDonoProfissional = false;
        try {
          const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
          if (profSnap.exists()) {
            isProfissional = true;
            ehDonoProfissional = !!profSnap.data().ehDono;
          }
        } catch {}
        const isDonoFinal = empresaData.donoId === user.uid || ehDonoProfissional;
        return {
          id,
          nome: empresaData.nome || empresaData.nomeFantasia || 'Empresa sem nome',
          isDono: isDonoFinal || isAdmin,
          isProfissional
        };
      }
      return null;
    });
    const empresasObjs = await Promise.all(promessas);
    return empresasObjs.filter(Boolean);
  } catch (error) {
    console.error("❌ [ERROR] Erro ao buscar empresas do usuário:", error);
    return [];
  }
}

// --- Função para mostrar/esconder loader ---
function toggleLoader(show) {
  try {
    if (loader) loader.style.display = show ? 'block' : 'none';
    if (appContent) appContent.style.display = show ? 'none' : 'block';
  } catch (error) {
    console.error("❌ [ERROR] Erro ao manipular loader:", error);
  }
}

// --- Função para configurar UI baseado nas permissões ---
function configurarUI() {
  try {
    if (btnAddServico) {
      btnAddServico.style.display = (isDono || isAdmin) ? 'inline-flex' : 'none';
    }
  } catch (error) {
    console.error("❌ [ERROR] Erro ao configurar UI:", error);
  }
}

// --- Event Listeners com proteção contra erros ---
function setupEventListeners() {
  try {
    // Event listener para ações dos serviços
    if (listaServicosDiv) {
      listaServicosDiv.addEventListener('click', async function(e) {
        try {
          if (isProcessing) return;

          const target = e.target.closest('.btn-acao');
          if (!target) return;

          const id = target.dataset.id;
          if (!id) return;

          e.preventDefault();
          e.stopPropagation();

          if (target.classList.contains('btn-editar')) {
            if (isDono || isAdmin) {
              window.location.href = `novo-servico.html?id=${encodeURIComponent(id)}`;
            } else {
              await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
            }
          } else if (target.classList.contains('btn-excluir')) {
            await excluirServico(id);
          }
        } catch (error) {
          console.error("❌ [ERROR] Erro no event listener de serviços:", error);
          await showAlert("Erro", "Ocorreu um erro inesperado. Tente novamente.");
        }
      });
    }

    // Event listener para adicionar serviço
    if (btnAddServico) {
      btnAddServico.addEventListener('click', async (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();

          if (isProcessing) return;

          if (isDono || isAdmin) {
            window.location.href = 'novo-servico.html';
          } else {
            await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
          }
        } catch (error) {
          console.error("❌ [ERROR] Erro no event listener de adicionar serviço:", error);
          await showAlert("Erro", "Ocorreu um erro inesperado. Tente novamente.");
        }
      });
    }

    console.log("✅ [DEBUG] Event listeners configurados com sucesso");

  } catch (error) {
    console.error("❌ [ERROR] Erro ao configurar event listeners:", error);
  }
}

// --- Ponto de Entrada Principal ---
function initializeApp() {
  // Aguarda o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
    return;
  }

  console.log("🚀 [DEBUG] Inicializando aplicação de serviços");
  
  // Inicializa elementos DOM
  initializeDOMElements();
  
  // Configura event listeners
  setupEventListeners();

  // Configura autenticação
  onAuthStateChanged(auth, async (user) => {
    try {
      if (isInitialized) return;

      console.log("🔐 [DEBUG] Estado de autenticação alterado");
      
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      console.log("✅ [DEBUG] Usuário logado:", user.uid);

      const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
      isAdmin = (user.uid === ADMIN_UID);

      toggleLoader(true);

      // 1. Pega o ID da empresa ativa do localStorage
      const empresaIdSalva = getEmpresaIdAtiva();

      if (empresaIdSalva) {
        // 2. Se há uma empresa salva, verifica se o usuário ainda tem acesso
        const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);

        if (verificacao.hasAccess) {
          // ✅ Usuário tem acesso à empresa salva
          empresaId = empresaIdSalva;
          isDono = verificacao.isDono;

          configurarUI();
          await carregarServicosDoFirebase();
          isInitialized = true;
          return;

        } else {
          // ❌ Usuário perdeu acesso à empresa salva
          setEmpresaIdAtiva(null);
        }
      }

      // 3. Se não há empresa salva OU perdeu acesso, busca empresas disponíveis
      const empresasDisponiveis = await buscarEmpresasDoUsuario(user);

      if (empresasDisponiveis.length === 0) {
        // Usuário não tem acesso a nenhuma empresa
        if (loader) {
          loader.innerHTML = `
            <div style="color:red; text-align: center; padding: 20px;">
              <p>Você não tem acesso a nenhuma empresa.</p>
              <p>Entre em contato com o administrador.</p>
            </div>
          `;
        }
        return;

      } else if (empresasDisponiveis.length === 1) {
        // Usuário tem acesso a apenas uma empresa - seleciona automaticamente
        const empresa = empresasDisponiveis[0];
        empresaId = empresa.id;
        isDono = empresa.isDono;
        setEmpresaIdAtiva(empresaId);

        configurarUI();
        await carregarServicosDoFirebase();

      } else {
        // Usuário tem acesso a múltiplas empresas - precisa selecionar
        window.location.href = 'selecionar-empresa.html';
        return;
      }

    } catch (error) {
      console.error("❌ [ERROR] Erro fatal durante a inicialização:", error);
      if (loader) {
        loader.innerHTML = `
          <div style="color:red; text-align: center; padding: 20px;">
            <p>Ocorreu um erro ao carregar a página.</p>
            <p style="font-size: 12px; margin-top: 8px;">${error.message || 'Erro desconhecido'}</p>
            <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Tentar Novamente
            </button>
          </div>
        `;
      }
    } finally {
      toggleLoader(false);
      isInitialized = true;
    }
  }, (error) => {
    console.error("❌ [ERROR] Erro no onAuthStateChanged:", error);
    if (loader) {
      loader.innerHTML = `
        <div style="color:red; text-align: center; padding: 20px;">
          <p>Erro de autenticação.</p>
          <button onclick="window.location.href='login.html'" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Ir para Login
          </button>
        </div>
      `;
    }
  });
}

// --- Funções de Debug (remover em produção) ---
window.debugServicos = {
  getEmpresaId: () => empresaId,
  getIsDono: () => isDono,
  getIsAdmin: () => isAdmin,
  getLocalStorage: () => getEmpresaIdAtiva(),
  getIsProcessing: () => isProcessing,
  clearEmpresa: () => {
    setEmpresaIdAtiva(null);
    window.location.reload();
  },
  recarregar: () => window.location.reload(),
  forceReload: () => {
    isInitialized = false;
    isProcessing = false;
    window.location.reload();
  }
};

// --- Inicialização ---
initializeApp();

console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugServicos");
