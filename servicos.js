// ======================================================================
// ARQUIVO: servicos.js (VERSÃO FINAL MULTIEMPRESAS, CRASH-FREE, ACESSO ROBUSTO)
// ======================================================================

import { collection, doc, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- DOM Elements ---
let listaServicosDiv, btnAddServico, loader, appContent;

// --- State ---
let empresaId = null;
let isDono = false;
let isAdmin = false;
let isInitialized = false;
let isProcessing = false;

// --- DOM Initialization ---
function initializeDOMElements() {
  listaServicosDiv = document.getElementById('lista-servicos');
  btnAddServico = document.querySelector('.btn-new');
  loader = document.getElementById('loader');
  appContent = document.getElementById('app-content');
}

// --- LocalStorage Helpers ---
function getEmpresaIdAtiva() {
  try {
    return localStorage.getItem("empresaAtivaId");
  } catch { return null; }
}

function setEmpresaIdAtiva(id) {
  try {
    if(id) localStorage.setItem("empresaAtivaId", id);
    else localStorage.removeItem("empresaAtivaId");
  } catch {}
}

// --- Utility Functions ---
function formatarPreco(preco) {
  if (!preco || isNaN(preco)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(preco));
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function toggleLoader(show) {
  if(loader) loader.style.display = show ? 'block' : 'none';
  if(appContent) appContent.style.display = show ? 'none' : 'block';
}

// --- Renderização ---
function renderizarServicos(servicos) {
  if(!listaServicosDiv) return;

  if(!servicos || servicos.length===0) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono||isAdmin)?'Clique em "Adicionar Novo Serviço"':''}</p>`;
    return;
  }

  const agrupados = {};
  servicos.forEach(s => {
    const cat = s.categoria?.trim() || "Sem Categoria";
    if(!agrupados[cat]) agrupados[cat]=[];
    agrupados[cat].push(s);
  });

  const categoriasOrdenadas = Object.keys(agrupados).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const html = categoriasOrdenadas.map(cat=>{
    const servicosCategoria = agrupados[cat].sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt-BR'));
    return `
      <div class="categoria-bloco">
        <h2 class="categoria-titulo" style="color:#6366f1; margin-top:24px;">${sanitizeHTML(cat)}</h2>
        ${servicosCategoria.map(s=>`
          <div class="servico-card" data-servico-id="${sanitizeHTML(s.id||'')}">
            <div class="servico-header">
              <h3>${sanitizeHTML(s.nome||'Sem nome')}</h3>
            </div>
            <p>${sanitizeHTML(s.descricao||'Sem descrição')}</p>
            <div class="servico-footer">
              <div>
                <span>${formatarPreco(s.preco)}</span> • <span>${s.duracao||0} min</span>
              </div>
              <div class="servico-acoes">
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(s.id||'')}">Editar</button>
                ${(isDono||isAdmin)?`<button class="btn-acao btn-excluir" data-id="${sanitizeHTML(s.id||'')}">Excluir</button>`:''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  listaServicosDiv.innerHTML = html;
}

// --- Firebase CRUD ---
async function carregarServicosDoFirebase() {
  if(isProcessing) return;
  empresaId = getEmpresaIdAtiva();
  if(!empresaId) return;

  isProcessing = true;
  if(listaServicosDiv) listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

  try {
    const snap = await getDocs(collection(db,"empresarios",empresaId,"servicos"));
    const servicos = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderizarServicos(servicos);
  } catch(e){
    console.error("Erro ao carregar serviços:",e);
    listaServicosDiv.innerHTML = `<p style="color:red;">Erro ao carregar serviços</p>`;
  } finally { isProcessing=false; }
}

async function excluirServico(servicoId) {
  if(isProcessing || !servicoId || !(isDono||isAdmin)) return;
  isProcessing = true;

  try {
    const confirmado = await showCustomConfirm("Confirma exclusão?","Esta ação não pode ser desfeita.");
    if(!confirmado) return;

    await deleteDoc(doc(db,"empresarios",empresaId,"servicos",servicoId));
    await showAlert("Sucesso!","Serviço excluído.");
    await carregarServicosDoFirebase();
  } catch(e){ console.error("Erro ao excluir serviço:",e); }
  finally{ isProcessing=false; }
}

// --- Verificar Acesso ---
async function verificarAcessoEmpresa(user,empresaId){
  if(!user || !empresaId) return {hasAccess:false,isDono:false};
  try{
    const mapaSnap = await getDoc(doc(db,"mapaUsuarios",user.uid));
    const empresas = mapaSnap.exists()? mapaSnap.data().empresas || [] : [];
    if(!empresas.includes(empresaId)) return {hasAccess:false,isDono:false};

    const empresaSnap = await getDoc(doc(db,"empresarios",empresaId));
    if(!empresaSnap.exists()) return {hasAccess:false,isDono:false};
    const empresaData = empresaSnap.data();
    const isOwner = empresaData.donoId===user.uid;

    let isProf=false, ehDonoProf=false;
    try{
      const profSnap = await getDoc(doc(db,"empresarios",empresaId,"profissionais",user.uid));
      if(profSnap.exists()){
        isProf=true;
        ehDonoProf=!!profSnap.data().ehDono;
      }
    }catch{}

    const isDonoFinal = isOwner||ehDonoProf;
    return {hasAccess:true,isDono:isDonoFinal,isProfissional:isProf};
  }catch(e){ console.error(e); return {hasAccess:false,isDono:false}; }
}

// --- Buscar Empresas do Usuário ---
async function buscarEmpresasDoUsuario(user){
  if(!user) return [];
  try{
    const mapaSnap = await getDoc(doc(db,"mapaUsuarios",user.uid));
    const empresasIds = mapaSnap.exists()? mapaSnap.data().empresas||[]:[];
    const promessas = empresasIds.map(async id=>{
      const snap = await getDoc(doc(db,"empresarios",id));
      if(!snap.exists()) return null;
      const data = snap.data();
      let isProf=false, ehDonoProf=false;
      try{
        const profSnap = await getDoc(doc(db,"empresarios",id,"profissionais",user.uid));
        if(profSnap.exists()){
          isProf=true;
          ehDonoProf=!!profSnap.data().ehDono;
        }
      }catch{}
      const isDonoFinal = data.donoId===user.uid||ehDonoProf;
      return {id,nome:data.nome||'Sem nome',isDono:isDonoFinal,isProfissional:isProf};
    });
    return (await Promise.all(promessas)).filter(Boolean);
  }catch(e){ console.error(e); return []; }
}

// --- UI Config ---
function configurarUI(){ if(btnAddServico) btnAddServico.style.display=(isDono||isAdmin)?'inline-flex':'none'; }

// --- Event Listeners ---
function setupEventListeners(){
  if(!listaServicosDiv || !btnAddServico) return;

  listaServicosDiv.addEventListener('click',async e=>{
    if(isProcessing) return;
    const target = e.target.closest('.btn-acao');
    if(!target) return;
    const id = target.dataset.id;
    if(!id) return;

    e.preventDefault(); e.stopPropagation();
    if(target.classList.contains('btn-editar')&&(isDono||isAdmin)){
      window.location.href=`novo-servico.html?id=${encodeURIComponent(id)}`;
    }else if(target.classList.contains('btn-excluir')){
      await excluirServico(id);
    }
  });

  btnAddServico.addEventListener('click',e=>{
    e.preventDefault(); e.stopPropagation();
    if(isDono||isAdmin) window.location.href='novo-servico.html';
  });
}

// --- Inicialização ---
function initializeApp(){
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initializeApp); return; }

  initializeDOMElements();
  setupEventListeners();

  onAuthStateChanged(auth,async user=>{
    while(!user){
      console.log("⏳ Usuário ainda não restaurado, aguardando 1s...");
      await new Promise(res=>setTimeout(res,1000));
      user=auth.currentUser;
    }

    isAdmin = user.uid==="BX6Q7HrVMrcCBqe72r7K76EBPkX2";

    toggleLoader(true);

    let empresaIdSalva = getEmpresaIdAtiva();
    if(empresaIdSalva){
      const ver = await verificarAcessoEmpresa(user,empresaIdSalva);
      if(ver.hasAccess){
        empresaId = empresaIdSalva; isDono=ver.isDono;
        configurarUI(); await carregarServicosDoFirebase();
        isInitialized=true; toggleLoader(false); return;
      } else setEmpresaIdAtiva(null);
    }

    const empresasDisp = await buscarEmpresasDoUsuario(user);
    if(empresasDisp.length===0){
      if(loader) loader.innerHTML='<p style="color:red;">Você não tem acesso a nenhuma empresa.</p>';
      toggleLoader(false); return;
    }

    const empresa = empresasDisp[0]; // auto-seleciona se só 1
    empresaId = empresa.id; isDono=empresa.isDono;
    setEmpresaIdAtiva(empresaId);

    configurarUI(); await carregarServicosDoFirebase();
    isInitialized=true;
    toggleLoader(false);
  });
}

// --- Debug ---
window.debugServicos={
  getEmpresaId:()=>empresaId,
  getIsDono:()=>isDono,
  getIsAdmin:()=>isAdmin,
  getLocalStorage:()=>getEmpresaIdAtiva(),
  recarregar:()=>window.location.reload()
};

// --- Start ---
initializeApp();
console.log("🔧 Funções de debug disponíveis em window.debugServicos");
