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

function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Renderização de serviços ---
function renderizarServicos(servicos) {
  try {
    if (!listaServicosDiv) return;

    if (!servicos || servicos.length === 0) {
      listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
      return;
    }

    const agrupados = {};
    servicos.forEach(servico => {
      if (!servico || typeof servico !== 'object') return;
      const cat = (servico.categoria && servico.categoria.trim()) ? servico.categoria.trim() : "Sem Categoria";
      if (!agrupados[cat]) agrupados[cat] = [];
      agrupados[cat].push(servico);
    });

    const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const htmlContent = categoriasOrdenadas.map(cat => {
      const servicosCategoria = agrupados[cat].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
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

  } catch (error) {
    console.error("❌ [ERROR] Erro ao renderizar serviços:", error);
    if (listaServicosDiv) listaServicosDiv.innerHTML = `<p style="color:red;">Erro ao exibir os serviços.</p>`;
  }
}

// --- Carregar serviços ---
async function carregarServicosDoFirebase() {
  if (isProcessing) return;

  empresaId = getEmpresaIdAtiva();
  if (!empresaId) {
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
    return;
  }

  isProcessing = true;

  try {
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderizarServicos(servicos);

  } catch (error) {
    console.error("❌ [ERROR] Erro ao carregar serviços:", error);
    if (listaServicosDiv) listaServicosDiv.innerHTML = `<p style="color:red;">Erro ao carregar os serviços.</p>`;
  } finally {
    isProcessing = false;
  }
}

// --- Excluir serviço ---
async function excluirServico(servicoId) {
  if (isProcessing) return;
  if (!servicoId) return await showAlert("Erro", "ID do serviço não encontrado.");
  if (!(isDono || isAdmin)) return await showAlert("Acesso Negado", "Apenas o dono ou admin pode excluir serviços.");

  isProcessing = true;

  try {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço?");
    if (!confirmado) return;

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

// --- Verificar acesso à empresa ---
async function verificarAcessoEmpresa(user, empresaId) {
  try {
    if (!user || !empresaId) return { hasAccess: false, isDono: false };

    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    let empresasPermitidas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];

    if (!empresasPermitidas.includes(empresaId)) return { hasAccess: false, isDono: false };

    const empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
    if (!empresaSnap.exists()) return { hasAccess: false, isDono: false };

    const empresaData = empresaSnap.data();
    const isOwner = empresaData.donoId === user.uid;

    let isProfissional = false, ehDonoProfissional = false;
    try {
      const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
      if (profSnap.exists()) {
        isProfissional = true;
        ehDonoProfissional = !!profSnap.data().ehDono;
      }
    } catch {}

    const isDonoFinal = isOwner || ehDonoProfissional;
    const hasAccess = isDonoFinal || isProfissional || isAdmin;

    return { hasAccess, isDono: isDonoFinal || isAdmin };

  } catch (error) {
    console.error("❌ [ERROR] Erro ao verificar acesso:", error);
    return { hasAccess: false, isDono: false };
  }
}

// --- Buscar empresas do usuário ---
async function buscarEmpresasDoUsuario(user) {
  try {
    if (!user) return [];
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];

    const promessas = empresas.map(async id => {
      const empresaSnap = await getDoc(doc(db, "empresarios", id));
      if (!empresaSnap.exists()) return null;

      const empresaData = empresaSnap.data();
      let isProfissional = false, ehDonoProfissional = false;

      try {
        const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
        if (profSnap.exists()) {
          isProfissional = true;
          ehDonoProfissional = !!profSnap.data().ehDono;
        }
      } catch {}

      const isDonoFinal = empresaData.donoId === user.uid || ehDonoProfissional;

      return { id, nome: empresaData.nome || 'Empresa sem nome', isDono: isDonoFinal || isAdmin, isProfissional };
    });

    return (await Promise.all(promessas)).filter(Boolean);

  } catch (error) {
    console.error("❌ [ERROR] Erro ao buscar empresas:", error);
    return [];
  }
}

// --- Loader ---
function toggleLoader(show) {
  try {
    if (loader) loader.style.display = show ? 'block' : 'none';
    if (appContent) appContent.style.display = show ? 'none' : 'block';
  } catch (error) {}
}

// --- Configurar UI ---
function configurarUI() {
  try {
    if (btnAddServico) btnAddServico.style.display = (isDono || isAdmin) ? 'inline-flex' : 'none';
  } catch (error) {}
}

// --- Event Listeners ---
function setupEventListeners() {
  try {
    if (listaServicosDiv) {
      listaServicosDiv.addEventListener('click', async (e) => {
        if (isProcessing) return;
        const target = e.target.closest('.btn-acao');
        if (!target) return;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-editar')) {
          if (isDono || isAdmin) window.location.href = `novo-servico.html?id=${encodeURIComponent(id)}`;
          else await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
        } else if (target.classList.contains('btn-excluir')) {
          await excluirServico(id);
        }
      });
    }

    if (btnAddServico) {
      btnAddServico.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isDono || isAdmin) window.location.href = 'novo-servico.html';
        else await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
      });
    }

  } catch (error) {
    console.error("❌ [ERROR] Erro ao configurar event listeners:", error);
  }
}

// --- Inicialização ---
function initializeApp() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
    return;
  }

  initializeDOMElements();
  setupEventListeners();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (isInitialized) return;
      if (!user) return window.location.href = 'login.html';

      const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
      isAdmin = (user.uid === ADMIN_UID);

      toggleLoader(true);

      const empresaIdSalva = getEmpresaIdAtiva();
      if (empresaIdSalva) {
        const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
        if (verificacao.hasAccess) {
          empresaId = empresaIdSalva;
          isDono = verificacao.isDono;
          configurarUI();
          await carregarServicosDoFirebase();
          isInitialized = true;
          toggleLoader(false);
          return;
        } else {
          setEmpresaIdAtiva(null);
        }
      }

      const empresasDisponiveis = await buscarEmpresasDoUsuario(user);
      if (empresasDisponiveis.length === 0) {
        if (loader) loader.innerHTML = `<p style="color:red;">Você não tem acesso a nenhuma empresa.</p>`;
        toggleLoader(false);
        return;
      } else if (empresasDisponiveis.length === 1) {
        empresaId = empresasDisponiveis[0].id;
        isDono = empresasDisponiveis[0].isDono;
        setEmpresaIdAtiva(empresaId);
        configurarUI();
        await carregarServicosDoFirebase();
      } else {
        window.location.href = 'selecionar-empresa.html';
        return;
      }

    } catch (error) {
      console.error("❌ [ERROR] Inicialização falhou:", error);
    } finally {
      toggleLoader(false);
      isInitialized = true;
    }
  });
}

window.debugServicos = {
  getEmpresaId: () => empresaId,
  getIsDono: () => isDono,
  getIsAdmin: () => isAdmin,
  getLocalStorage: () => getEmpresaIdAtiva(),
  getIsProcessing: () => isProcessing,
  clearEmpresa: () => { setEmpresaIdAtiva(null); window.location.reload(); },
  recarregar: () => window.location.reload(),
};

initializeApp();
console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugServicos");
