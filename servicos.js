// ======================================================================
// ARQUIVO: servicos.js (VERSÃO FINAL MULTIEMPRESAS, CRASH-FREE, COM WAIT USER)
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
    return localStorage.getItem("empresaAtivaId");
  } catch (error) {
    console.error("❌ [ERROR] Erro ao acessar localStorage:", error);
    return null;
  }
}

function setEmpresaIdAtiva(id) {
  try {
    if (id) localStorage.setItem("empresaAtivaId", id);
    else localStorage.removeItem("empresaAtivaId");
  } catch (error) {
    console.error("❌ [ERROR] Erro ao manipular localStorage:", error);
  }
}

function formatarPreco(preco) {
  try {
    if (!preco || isNaN(preco)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(preco));
  } catch {
    return 'R$ 0,00';
  }
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
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
    return;
  }

  const agrupados = {};
  servicos.forEach(s => {
    if (!s) return;
    const cat = s.categoria?.trim() || "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(s);
  });

  const htmlContent = Object.keys(agrupados).sort().map(cat => {
    const servicosCategoria = agrupados[cat].sort((a,b)=> (a.nome||'').localeCompare(b.nome||''));
    return `
      <div class="categoria-bloco">
        <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
          ${sanitizeHTML(cat)}
        </h2>
        ${servicosCategoria.map(s => `
          <div class="servico-card" data-servico-id="${sanitizeHTML(s.id||'')}">
            <div class="servico-header"><h3>${sanitizeHTML(s.nome||'Sem nome')}</h3></div>
            <p class="servico-descricao">${sanitizeHTML(s.descricao||'Sem descrição.')}</p>
            <div class="servico-footer">
              <div>
                <span class="servico-preco">${formatarPreco(s.preco)}</span>
                <span class="servico-duracao"> • ${sanitizeHTML(String(s.duracao||0))} min</span>
              </div>
              <div class="servico-acoes">
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(s.id||'')}">Editar</button>
                ${(isDono||isAdmin) ? `<button class="btn-acao btn-excluir" data-id="${sanitizeHTML(s.id||'')}">Excluir</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
  listaServicosDiv.innerHTML = htmlContent;
}

// --- Carregar Serviços ---
async function carregarServicosDoFirebase() {
  if (isProcessing) return;
  empresaId = getEmpresaIdAtiva();
  if (!empresaId) return;

  isProcessing = true;
  if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

  try {
    const snap = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    const servicos = snap.docs.map(d => ({ id:d.id, ...d.data(), nome:d.data().nome||'', descricao:d.data().descricao||'', preco:d.data().preco||0, duracao:d.data().duracao||0, categoria:d.data().categoria||'' }));
    renderizarServicos(servicos);
  } catch (error) {
    console.error("❌ Erro ao carregar serviços:", error);
  } finally {
    isProcessing = false;
  }
}

// --- Excluir Serviço ---
async function excluirServico(servicoId) {
  if (!servicoId || !(isDono||isAdmin)) return;
  const confirmado = await showCustomConfirm("Confirmar Exclusão","Tem certeza que deseja excluir este serviço?");
  if (!confirmado) return;
  try {
    await deleteDoc(doc(db,"empresarios",empresaId,"servicos",servicoId));
    await showAlert("Sucesso","Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
  } catch (error) {
    console.error("❌ Erro ao excluir serviço:", error);
  }
}

// --- Verificar Acesso Empresa ---
async function verificarAcessoEmpresa(user, empresaId) {
  if (!user || !empresaId) return { hasAccess:false, isDono:false };
  const mapaSnap = await getDoc(doc(db,"mapaUsuarios",user.uid));
  const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];
  if (!empresas.includes(empresaId)) return { hasAccess:false, isDono:false };
  const empresaSnap = await getDoc(doc(db,"empresarios",empresaId));
  if (!empresaSnap.exists()) return { hasAccess:false, isDono:false };
  const empresaData = empresaSnap.data();
  const isOwner = empresaData.donoId===user.uid;
  let isProf=false, ehDonoProf=false;
  try {
    const profSnap = await getDoc(doc(db,"empresarios",empresaId,"profissionais",user.uid));
    if (profSnap.exists()){ isProf=true; ehDonoProf=!!profSnap.data().ehDono; }
  } catch{}
  const isDonoFinal = isOwner || ehDonoProf;
  return { hasAccess: isDonoFinal || isAdmin, isDono: isDonoFinal||isAdmin };
}

// --- Buscar Empresas do Usuário ---
async function buscarEmpresasDoUsuario(user) {
  if (!user) return [];
  const mapaSnap = await getDoc(doc(db,"mapaUsuarios",user.uid));
  const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];
  const promessas = empresas.map(async id => {
    const empresaSnap = await getDoc(doc(db,"empresarios",id));
    if (!empresaSnap.exists()) return null;
    const empresaData = empresaSnap.data();
    let isProf=false, ehDonoProf=false;
    try {
      const profSnap = await getDoc(doc(db,"empresarios",id,"profissionais",user.uid));
      if (profSnap.exists()){ isProf=true; ehDonoProf=!!profSnap.data().ehDono; }
    } catch{}
    const isDonoFinal = empresaData.donoId===user.uid || ehDonoProf;
    return { id, nome:empresaData.nome||'Sem nome', isDono:isDonoFinal||isAdmin, isProfissional:isProf };
  });
  return (await Promise.all(promessas)).filter(Boolean);
}

// --- Loader ---
function toggleLoader(show) {
  if(loader) loader.style.display = show?'block':'none';
  if(appContent) appContent.style.display = show?'none':'block';
}

// --- Configurar UI ---
function configurarUI() { if(btnAddServico) btnAddServico.style.display=(isDono||isAdmin)?'inline-flex':'none'; }

// --- Event Listeners ---
function setupEventListeners() {
  if(!listaServicosDiv) return;
  listaServicosDiv.addEventListener('click', async e=>{
    const target=e.target.closest('.btn-acao'); if(!target) return;
    const id=target.dataset.id; if(!id) return;
    e.preventDefault(); e.stopPropagation();
    if(target.classList.contains('btn-editar')){ if(isDono||isAdmin) window.location.href=`novo-servico.html?id=${encodeURIComponent(id)}`; }
    else if(target.classList.contains('btn-excluir')) await excluirServico(id);
  });
  if(btnAddServico) btnAddServico.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); if(isDono||isAdmin) window.location.href='novo-servico.html'; });
}

// --- Inicialização ---
function initializeApp() {
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initializeApp); return; }
  initializeDOMElements(); setupEventListeners(); toggleLoader(true);

  const ADMIN_UID="BX6Q7HrVMrcCBqe72r7K76EBPkX2";

  const waitForUser = async ()=>{
    onAuthStateChanged(auth, async user=>{
      if(!user){
        console.log("⏳ Usuário ainda não restaurado, aguardando 1s...");
        setTimeout(waitForUser,1000); return;
      }
      console.log("✅ Usuário logado:",user.uid);
      isAdmin = user.uid===ADMIN_UID;

      // 1. Checa empresa ativa
      let empresaAtiva = getEmpresaIdAtiva();
      if(empresaAtiva){
        const acesso = await verificarAcessoEmpresa(user,empresaAtiva);
        if(acesso.hasAccess){ empresaId=empresaAtiva; isDono=acesso.isDono; configurarUI(); await carregarServicosDoFirebase(); toggleLoader(false); return; }
        else setEmpresaIdAtiva(null);
      }

      // 2. Busca empresas do usuário
      const empresas = await buscarEmpresasDoUsuario(user);
      if(empresas.length===0){ if(loader) loader.innerHTML=`<p>Você não tem acesso a nenhuma empresa.</p>`; toggleLoader(false); return; }
      else if(empresas.length===1){ empresaId=empresas[0].id; isDono=empresas[0].isDono; setEmpresaIdAtiva(empresaId); configurarUI(); await carregarServicosDoFirebase(); toggleLoader(false); return; }
      else{ window.location.href='selecionar-empresa.html'; return; }
    });
  };
  waitForUser();
}

// --- Debug ---
window.debugServicos = { getEmpresaId:()=>empresaId, getIsDono:()=>isDono, getIsAdmin:()=>isAdmin, getLocalStorage:getEmpresaIdAtiva, recarregar:()=>window.location.reload() };

// --- Inicializa ---
initializeApp();
console.log("🔧 Funções de debug disponíveis em window.debugServicos");
