// ======================================================================
// ARQUIVO: servicos.js (DEBUG COMPLETO REVISADO - IDENTIFICAÇÃO DE DONO, ADMIN, PROFISSIONAL, EMPRESA E SERVIÇOS)
// ======================================================================

import { collection, doc, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- DOM Elements ---
let listaServicosDiv, btnAddServico, loader, appContent;

// --- State Variables ---
let empresaId = null;
let isDono = false;
let isAdmin = false;
let isProfissional = false;
let isInitialized = false;
let isProcessing = false;
let userUid = null;
let empresaDataDebug = null;

// --- Initialize DOM ---
function initializeDOMElements() {
  listaServicosDiv = document.getElementById('lista-servicos');
  btnAddServico = document.querySelector('.btn-new');
  loader = document.getElementById('loader');
  appContent = document.getElementById('app-content');
  console.log("[DEBUG] DOM Elements:", { listaServicosDiv, btnAddServico, loader, appContent });
}

// --- Helpers ---
function getEmpresaIdAtiva() {
  try { 
    const eid = localStorage.getItem("empresaAtivaId"); 
    console.log("[DEBUG] getEmpresaIdAtiva:", eid);
    return eid;
  } catch (e) { console.error("[DEBUG] getEmpresaIdAtiva erro:", e); return null; }
}

function setEmpresaIdAtiva(id) {
  try {
    if (id) {
      localStorage.setItem("empresaAtivaId", id);
      console.log("[DEBUG] setEmpresaIdAtiva:", id);
    } else {
      localStorage.removeItem("empresaAtivaId");
      console.log("[DEBUG] setEmpresaIdAtiva removido");
    }
  } catch (e) {
    console.error("[DEBUG] setEmpresaIdAtiva erro:", e);
  }
}

function formatarPreco(preco) {
  if (preco == null || isNaN(preco)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(preco));
}

function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Render Services ---
function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;
  console.log("[DEBUG] Renderizando serviços:", servicos);

  if (!servicos || servicos.length === 0) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
    return;
  }

  const agrupados = {};
  servicos.forEach(servico => {
    if (!servico) return;
    const cat = servico.categoria?.trim() || "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(servico);
  });

  const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => {
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
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(servico.id || '')}" type="button">Editar</button>
                ${(isDono || isAdmin) ? `<button class="btn-acao btn-excluir" data-id="${sanitizeHTML(servico.id || '')}" type="button">Excluir</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

// --- Load Services from Firebase ---
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
    const servicos = snap.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(), 
      nome: doc.data().nome || '', 
      descricao: doc.data().descricao || '', 
      preco: doc.data().preco || 0, 
      duracao: doc.data().duracao || 0, 
      categoria: doc.data().categoria || '' 
    }));
    console.log("[DEBUG] Serviços Firestore:", servicos);
    renderizarServicos(servicos);
  } catch (error) {
    console.error("[DEBUG] Erro ao carregar serviços:", error);
    if (listaServicosDiv) listaServicosDiv.innerHTML = `<div style="color:red;text-align:center;padding:20px;"><p>Erro ao carregar os serviços.</p><p style="font-size:12px;">${error.message || 'Erro desconhecido'}</p><button onclick="window.location.reload()" style="margin-top:10px;padding:8px 16px;background:#4facfe;color:white;border:none;border-radius:4px;cursor:pointer;">Tentar Novamente</button></div>`;
  } finally {
    isProcessing = false;
  }
}

// --- Delete Service ---
async function excluirServico(servicoId) {
  if (isProcessing || !servicoId) return;
  if (!(isDono || isAdmin)) { await showAlert("Acesso Negado", "Apenas o dono ou admin pode excluir serviços."); return; }

  isProcessing = true;
  try {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.");
    if (!confirmado) return;

    await deleteDoc(doc(db, "empresarios", empresaId, "servicos", servicoId));
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
  } catch (error) {
    await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${error.message || 'Erro desconhecido'}`);
  } finally {
    isProcessing = false;
  }
}

// --- Verify Access ---
async function verificarAcessoEmpresa(user, empresaId) {
  try {
    if (!user || !empresaId) return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null };
    userUid = user.uid;

    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresasPermitidas = (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) ? mapaSnap.data().empresas : [];
    if (!empresasPermitidas.includes(empresaId)) return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null };

    const empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
    if (!empresaSnap.exists()) return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null };

    const empresaData = empresaSnap.data();
    empresaDataDebug = empresaData;
    const isOwner = empresaData.donoId === user.uid;

    let isProfissional_ = false, ehDonoProfissional = false, profDataDebug = null;
    try {
      const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
      if (profSnap.exists()) {
        isProfissional_ = true;
        profDataDebug = profSnap.data();
        ehDonoProfissional = !!profDataDebug.ehDono;
      }
    } catch {}

    const isDonoFinal = isOwner || ehDonoProfissional;
    const hasAccess = isDonoFinal || isProfissional_ || isAdmin;
    return { hasAccess, isDono: isDonoFinal || isAdmin, isProfissional: isProfissional_, empresaData, profDataDebug };
  } catch (e) {
    console.error("[DEBUG] ERRO EM verificarAcessoEmpresa:", e);
    return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null };
  }
}

// --- Buscar Empresas do Usuário ---
async function buscarEmpresasDoUsuario(user) {
  if (!user) return [];
  try {
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresas = (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) ? mapaSnap.data().empresas : [];

    const promessas = empresas.map(async id => {
      const empresaSnap = await getDoc(doc(db, "empresarios", id));
      if (!empresaSnap.exists()) return null;

      const empresaData = empresaSnap.data();
      let isProfissional = false, ehDonoProfissional = false;
      try {
        const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
        if (profSnap.exists()) { isProfissional = true; ehDonoProfissional = !!profSnap.data().ehDono; }
      } catch {}

      return { id, nome: empresaData.nome || empresaData.nomeFantasia || 'Empresa sem nome', isDono: empresaData.donoId === user.uid || ehDonoProfissional || isAdmin, isProfissional };
    });

    return (await Promise.all(promessas)).filter(Boolean);
  } catch { return []; }
}

// --- Loader ---
function toggleLoader(show) {
  if (loader) loader.style.display = show ? 'block' : 'none';
  if (appContent) appContent.style.display = show ? 'none' : 'block';
}

// --- Configure UI ---
function configurarUI() { if (btnAddServico) btnAddServico.style.display = (isDono || isAdmin) ? 'inline-flex' : 'none'; }

// --- Event Listeners ---
function setupEventListeners() {
  if (listaServicosDiv) listaServicosDiv.addEventListener('click', async e => {
    if (isProcessing) return;
    const target = e.target.closest('.btn-acao');
    if (!target) return;
    const id = target.dataset.id;
    if (!id) return;
    e.preventDefault(); e.stopPropagation();

    if (target.classList.contains('btn-editar')) {
      if (isDono || isAdmin) window.location.href = `novo-servico.html?id=${encodeURIComponent(id)}`;
      else await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
    }
    if (target.classList.contains('btn-excluir')) await excluirServico(id);
  });

  if (btnAddServico) btnAddServico.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    if (isProcessing) return;
    if (isDono || isAdmin) window.location.href = 'novo-servico.html';
    else await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
  });
}

// --- Main App Init ---
function initializeApp() {
  if (document.readyState === 'loading') return document.addEventListener('DOMContentLoaded', initializeApp);

  initializeDOMElements();
  setupEventListeners();

  onAuthStateChanged(auth, async user => {
    while (!user) { await new Promise(res => setTimeout(res, 500)); user = auth.currentUser; }
    if (isInitialized) return;

    userUid = user.uid;
    const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
    isAdmin = user.uid === ADMIN_UID;

    toggleLoader(true);

    const empresaIdSalva = getEmpresaIdAtiva();
    if (empresaIdSalva) {
      const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
      isDono = verificacao.isDono;
      isProfissional = verificacao.isProfissional;
      empresaDataDebug = verificacao.empresaData;

      if (verificacao.hasAccess) { empresaId = empresaIdSalva; configurarUI(); await carregarServicosDoFirebase(); isInitialized = true; toggleLoader(false); return; }
      else setEmpresaIdAtiva(null);
    }

    const empresasDisponiveis = await buscarEmpresasDoUsuario(user);
    if (empresasDisponiveis.length === 0) {
      if (loader) loader.innerHTML = `<div style="color:red;text-align:center;padding:20px;"><p>Você não tem acesso a nenhuma empresa.</p><p>Entre em contato com o administrador.</p></div>`;
      toggleLoader(false); isInitialized = true; return;
    }

    if (empresasDisponiveis.length === 1) {
      const empresa = empresasDisponiveis[0];
      empresaId = empresa.id;
      isDono = empresa.isDono;
      isProfissional = empresa.isProfissional;
      setEmpresaIdAtiva(empresaId);
      configurarUI();
      await carregarServicosDoFirebase();
      isInitialized = true;
      toggleLoader(false);
    } else {
      // Múltiplas empresas: redireciona para seleção
      window.location.href = 'selecionar-empresa.html';
      isInitialized = true;
      toggleLoader(false);
    }
  }, error => {
    if (loader) loader.innerHTML = `<div style="color:red;text-align:center;padding:20px;"><p>Erro de autenticação.</p><button onclick="window.location.href='login.html'" style="margin-top:10px;padding:8px 16px;background:#4facfe;color:white;border:none;border-radius:4px;cursor:pointer;">Ir para Login</button></div>`;
  });
}

// --- Debug ---
window.debugServicos = {
  getEmpresaId: () => empresaId,
  getIsDono: () => isDono,
  getIsAdmin: () => isAdmin,
  getIsProfissional: () => isProfissional,
  getLocalStorage: () => getEmpresaIdAtiva(),
  getUserUid: () => userUid,
  getEmpresaData: () => empresaDataDebug,
  getIsProcessing: () => isProcessing,
  clearEmpresa: () => { setEmpresaIdAtiva(null); window.location.reload(); },
  recarregar: () => window.location.reload(),
  forceReload: () => { isInitialized = false; isProcessing = false; window.location.reload(); }
};

initializeApp();
console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugServicos");
