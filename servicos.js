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
  listaServicosDiv = document.getElementById('lista-servicos');
  btnAddServico = document.querySelector('.btn-new');
  loader = document.getElementById('loader');
  appContent = document.getElementById('app-content');
}

// --- Funções Auxiliares ---
function getEmpresaIdAtiva() {
  try {
    return localStorage.getItem("empresaAtivaId");
  } catch {
    return null;
  }
}
function setEmpresaIdAtiva(id) {
  try {
    if (id) localStorage.setItem("empresaAtivaId", id);
    else localStorage.removeItem("empresaAtivaId");
  } catch {}
}
function formatarPreco(preco) {
  if (preco === undefined || preco === null || isNaN(preco)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(preco));
}
function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Renderização de Serviços ---
function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;

  if (!servicos || servicos.length === 0) {
    listaServicosDiv.innerHTML =
      `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
    return;
  }

  const agrupados = {};
  servicos.forEach(s => {
    const cat = (s.categoria && typeof s.categoria === 'string' && s.categoria.trim()) ?
      s.categoria.trim() : "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(s);
  });

  const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => {
    const servicosCategoria = agrupados[cat].sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
    );
    return `
      <div class="categoria-bloco">
        <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
          ${sanitizeHTML(cat)}
        </h2>
        ${servicosCategoria.map(s => `
          <div class="servico-card" data-servico-id="${sanitizeHTML(s.id || '')}">
            <div class="servico-header">
              <h3 class="servico-titulo">${sanitizeHTML(s.nome || 'Sem nome')}</h3>
            </div>
            <p class="servico-descricao">${sanitizeHTML(s.descricao || 'Sem descrição.')}</p>
            <div class="servico-footer">
              <div>
                <span class="servico-preco">${formatarPreco(s.preco)}</span>
                <span class="servico-duracao"> • ${sanitizeHTML(String(s.duracao || 0))} min</span>
              </div>
              <div class="servico-acoes">
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(s.id || '')}" type="button">Editar</button>
                ${(isDono || isAdmin) ? `
                  <button class="btn-acao btn-excluir" data-id="${sanitizeHTML(s.id || '')}" type="button">Excluir</button>
                ` : ""}
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');
}

async function carregarServicosDoFirebase() {
  if (isProcessing) return;
  empresaId = getEmpresaIdAtiva();
  if (!empresaId) {
    listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
    return;
  }

  isProcessing = true;
  try {
    listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarServicos(servicos);
  } catch (error) {
    listaServicosDiv.innerHTML =
      `<div style="color:red; text-align:center; padding:20px;">
        <p>Erro ao carregar os serviços.</p>
        <p style="font-size:12px; margin-top:8px;">${error.message || 'Erro desconhecido'}</p>
        <button onclick="window.location.reload()" style="margin-top:10px; padding:8px 16px; background:#4facfe; color:white; border:none; border-radius:4px; cursor:pointer;">Tentar Novamente</button>
      </div>`;
  } finally {
    isProcessing = false;
  }
}

async function excluirServico(servicoId) {
  if (isProcessing) return;
  if (!servicoId) return showAlert("Erro", "ID do serviço não encontrado.");
  if (!(isDono || isAdmin)) return showAlert("Acesso Negado", "Apenas o dono ou admin pode excluir serviços.");

  isProcessing = true;
  try {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Deseja excluir este serviço?");
    if (!confirmado) return;
    await deleteDoc(doc(db, "empresarios", empresaId, "servicos", servicoId));
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
  } catch (error) {
    await showAlert("Erro", `Erro ao excluir: ${error.message || 'Erro desconhecido'}`);
  } finally {
    isProcessing = false;
  }
}

// --- Verificação de Acesso ---
async function verificarAcessoEmpresa(user, empresaId) {
  if (!user || !empresaId) return { hasAccess: false, isDono: false };

  const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
  const empresas = (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) ? mapaSnap.data().empresas : [];
  if (!empresas.includes(empresaId)) return { hasAccess: false, isDono: false };

  const empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
  if (!empresaSnap.exists()) return { hasAccess: false, isDono: false };
  const empresaData = empresaSnap.data();

  const isOwner = empresaData.donoId === user.uid;
  let ehDonoProfissional = false, isProfissional = false;
  const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
  if (profSnap.exists()) {
    isProfissional = true;
    ehDonoProfissional = !!profSnap.data().ehDono;
  }
  const isDonoFinal = isOwner || ehDonoProfissional;
  return { hasAccess: isDonoFinal || isProfissional || isAdmin, isDono: isDonoFinal || isAdmin };
}

async function buscarEmpresasDoUsuario(user) {
  if (!user) return [];
  const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
  const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];
  const promessas = empresas.map(async id => {
    const snap = await getDoc(doc(db, "empresarios", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    const isOwner = data.donoId === user.uid;
    let ehDonoProfissional = false, isProfissional = false;
    const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
    if (profSnap.exists()) {
      isProfissional = true;
      ehDonoProfissional = !!profSnap.data().ehDono;
    }
    return { id, nome: data.nome || "Empresa sem nome", isDono: isOwner || ehDonoProfissional || isAdmin, isProfissional };
  });
  return (await Promise.all(promessas)).filter(Boolean);
}

// --- UI ---
function toggleLoader(show) {
  if (loader) loader.style.display = show ? 'block' : 'none';
  if (appContent) appContent.style.display = show ? 'none' : 'block';
}
function configurarUI() {
  if (btnAddServico) btnAddServico.style.display = (isDono || isAdmin) ? 'inline-flex' : 'none';
}

// --- Eventos ---
function setupEventListeners() {
  if (listaServicosDiv) {
    listaServicosDiv.addEventListener('click', async e => {
      const target = e.target.closest('.btn-acao'); if (!target) return;
      const id = target.dataset.id; if (!id) return;
      if (target.classList.contains('btn-editar')) {
        if (isDono || isAdmin) window.location.href = `novo-servico.html?id=${encodeURIComponent(id)}`;
        else await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
      } else if (target.classList.contains('btn-excluir')) {
        await excluirServico(id);
      }
    });
  }
  if (btnAddServico) {
    btnAddServico.addEventListener('click', async e => {
      e.preventDefault();
      if (isDono || isAdmin) window.location.href = 'novo-servico.html';
      else await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
    });
  }
}

// --- Inicialização Principal ---
function initializeApp() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
    return;
  }
  initializeDOMElements();
  setupEventListeners();

  onAuthStateChanged(auth, async (user) => {
    if (isInitialized) return;
    if (!user) { window.location.href = 'login.html'; return; }

    isAdmin = (user.uid === "BX6Q7HrVMrcCBqe72r7K76EBPkX2");
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
      loader.innerHTML = `<div style="color:red; text-align:center; padding:20px;"><p>Você não tem acesso a nenhuma empresa.</p></div>`;
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

    toggleLoader(false);
    isInitialized = true;
  });
}

// --- Inicialização ---
initializeApp();
