// ======================================================================
// ARQUIVO: servicos.js (VERSÃO REFINADA MULTIEMPRESAS, CRASH-FREE)
// ======================================================================

import {
  collection, doc, getDocs, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- DOM ---
let listaServicosDiv, btnAddServico, loader, appContent;

// --- Estado ---
let empresaId = null;
let isDono = false;
let isAdmin = false;
let isInitialized = false;
let isProcessing = false;

// --- Helpers ---
function getEmpresaIdAtiva() {
  try { return localStorage.getItem("empresaAtivaId"); }
  catch { return null; }
}
function setEmpresaIdAtiva(id) {
  try { id ? localStorage.setItem("empresaAtivaId", id) : localStorage.removeItem("empresaAtivaId"); }
  catch {}
}
function sanitizeHTML(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function formatarPreco(preco) { return (!preco || isNaN(preco)) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(preco)); }
function toggleLoader(show) { if (loader) loader.style.display = show ? 'block':'none'; if (appContent) appContent.style.display = show ? 'none':'block'; }

// --- Render ---
function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;
  if (!servicos || servicos.length===0) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono||isAdmin)?'Clique em "Adicionar Novo Serviço"':''}</p>`;
    return;
  }
  const agrupados = {};
  servicos.forEach(s => {
    const cat = (s.categoria?.trim() || "Sem Categoria");
    if(!agrupados[cat]) agrupados[cat]=[];
    agrupados[cat].push(s);
  });
  const html = Object.keys(agrupados).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(cat=>{
    return `<div class="categoria-bloco">
      <h2 class="categoria-titulo" style="color:#6366f1;margin:24px 0 12px;">${sanitizeHTML(cat)}</h2>
      ${agrupados[cat].sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt-BR')).map(s=>{
        return `<div class="servico-card" data-servico-id="${sanitizeHTML(s.id||'')}">
          <div class="servico-header"><h3 class="servico-titulo">${sanitizeHTML(s.nome||'Sem nome')}</h3></div>
          <p class="servico-descricao">${sanitizeHTML(s.descricao||'Sem descrição.')}</p>
          <div class="servico-footer">
            <div><span class="servico-preco">${formatarPreco(s.preco)}</span> • <span class="servico-duracao">${sanitizeHTML(String(s.duracao||0))} min</span></div>
            <div class="servico-acoes">
              <button class="btn-acao btn-editar" data-id="${sanitizeHTML(s.id||'')}" type="button">Editar</button>
              ${(isDono||isAdmin)?`<button class="btn-acao btn-excluir" data-id="${sanitizeHTML(s.id||'')}" type="button">Excluir</button>`:''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
  listaServicosDiv.innerHTML = html;
}

// --- Firebase ---
async function carregarServicosDoFirebase() {
  if(isProcessing) return;
  empresaId = getEmpresaIdAtiva();
  if(!empresaId){ listaServicosDiv.innerHTML='<p style="color:red;">Empresa não encontrada.</p>'; return;}
  isProcessing=true;
  if(listaServicosDiv) listaServicosDiv.innerHTML='<p>Carregando serviços...</p>';
  try {
    const snap = await getDocs(collection(db,"empresarios",empresaId,"servicos"));
    const servicos = snap.docs.map(d=>({id:d.id,...d.data(),nome:d.data().nome||'',descricao:d.data().descricao||'',preco:d.data().preco||0,duracao:d.data().duracao||0,categoria:d.data().categoria||''}));
    renderizarServicos(servicos);
  } catch(e){ listaServicosDiv.innerHTML=`<p style="color:red;">Erro ao carregar serviços: ${e.message}</p>`; }
  finally{ isProcessing=false; }
}

async function excluirServico(servicoId) {
  if(isProcessing || !servicoId || !(isDono||isAdmin)) return;
  isProcessing=true;
  try{
    const conf=await showCustomConfirm("Confirmar Exclusão","Deseja realmente excluir?");
    if(!conf){isProcessing=false;return;}
    await deleteDoc(doc(db,"empresarios",empresaId,"servicos",servicoId));
    await showAlert("Sucesso!","Serviço excluído");
    await carregarServicosDoFirebase();
  }catch(e){ await showAlert("Erro",`Erro ao excluir: ${e.message}`);}
  finally{ isProcessing=false; }
}

// --- Verificações ---
async function verificarAcessoEmpresa(user,empresaId){
  if(!user||!empresaId) return {hasAccess:false,isDono:false};
  const mapaSnap = await getDoc(doc(db,"mapaUsuarios",user.uid));
  const empresasPermitidas = mapaSnap.exists()? (Array.isArray(mapaSnap.data().empresas)?mapaSnap.data().empresas:[]):[];
  if(!empresasPermitidas.includes(empresaId)) return {hasAccess:false,isDono:false};
  const empresaSnap = await getDoc(doc(db,"empresarios",empresaId));
  if(!empresaSnap.exists()) return {hasAccess:false,isDono:false};
  const empresaData=empresaSnap.data();
  const isOwner = empresaData.donoId===user.uid;
  let isProf=false, ehDonoProf=false;
  try{ const profSnap=await getDoc(doc(db,"empresarios",empresaId,"profissionais",user.uid)); if(profSnap.exists()){isProf=true;ehDonoProf=!!profSnap.data().ehDono;}}catch{}
  return {hasAccess:isOwner||ehDonoProf||isAdmin, isDono:isOwner||ehDonoProf||isAdmin};
}

async function buscarEmpresasDoUsuario(user){
  if(!user) return [];
  const mapaSnap=await getDoc(doc(db,"mapaUsuarios",user.uid));
  const empresas= mapaSnap.exists()? (Array.isArray(mapaSnap.data().empresas)?mapaSnap.data().empresas:[]):[];
  const promessas=empresas.map(async id=>{
    const empresaSnap=await getDoc(doc(db,"empresarios",id));
    if(!empresaSnap.exists()) return null;
    const empresaData=empresaSnap.data();
    let isProf=false, ehDonoProf=false;
    try{ const profSnap=await getDoc(doc(db,"empresarios",id,"profissionais",user.uid)); if(profSnap.exists()){isProf=true; ehDonoProf=!!profSnap.data().ehDono;}}catch{}
    const isDonoFinal = empresaData.donoId===user.uid || ehDonoProf;
    return {id,nome:empresaData.nome||empresaData.nomeFantasia||'Empresa sem nome',isDono:isDonoFinal||isAdmin,isProfissional:isProf};
  });
  return (await Promise.all(promessas)).filter(Boolean);
}

// --- UI ---
function configurarUI(){ if(btnAddServico) btnAddServico.style.display=(isDono||isAdmin)?'inline-flex':'none'; }
function setupEventListeners(){
  if(listaServicosDiv) listaServicosDiv.addEventListener('click',async e=>{
    if(isProcessing) return;
    const t=e.target.closest('.btn-acao'); if(!t) return;
    const id=t.dataset.id; if(!id) return;
    if(t.classList.contains('btn-editar')){ if(isDono||isAdmin) window.location.href=`novo-servico.html?id=${encodeURIComponent(id)}`; else await showAlert("Acesso Negado","Apenas dono/admin");}
    else if(t.classList.contains('btn-excluir')) await excluirServico(id);
  });
  if(btnAddServico) btnAddServico.addEventListener('click',async e=>{ if(isProcessing) return; if(isDono||isAdmin) window.location.href='novo-servico.html'; else await showAlert("Acesso Negado","Apenas dono/admin"); });
}

// --- Inicialização ---
async function initializeApp(){
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initializeApp); return;}
  listaServicosDiv=document.getElementById('lista-servicos');
  btnAddServico=document.querySelector('.btn-new');
  loader=document.getElementById('loader');
  appContent=document.getElementById('app-content');
  setupEventListeners();

  const ADMIN_UID="BX6Q7HrVMrcCBqe72r7K76EBPkX2";
  let user=null;
  while(!user){ console.log("⏳ Usuário ainda não restaurado, aguardando 1s..."); await new Promise(r=>setTimeout(r,1000)); user=auth.currentUser; }
  if(!user){ window.location.href='login.html'; return;}
  console.log("✅ Usuário logado",user.uid);
  isAdmin=(user.uid===ADMIN_UID);
  toggleLoader(true);

  let empresaAtiva=getEmpresaIdAtiva();
  if(empresaAtiva){
    const acesso=await verificarAcessoEmpresa(user,empresaAtiva);
    if(acesso.hasAccess){ empresaId=empresaAtiva; isDono=acesso.isDono; configurarUI(); await carregarServicosDoFirebase(); toggleLoader(false); return;}
    else setEmpresaIdAtiva(null);
  }

  const empresasDisponiveis=await buscarEmpresasDoUsuario(user);
  if(empresasDisponiveis.length===0){ loader.innerHTML='<p style="color:red;">Você não tem acesso a nenhuma empresa.</p>'; return;}
  else if(empresasDisponiveis.length===1){ empresaId=empresasDisponiveis[0].id; isDono=empresasDisponiveis[0].isDono; setEmpresaIdAtiva(empresaId); configurarUI(); await carregarServicosDoFirebase();}
  else{ window.location.href='selecionar-empresa.html';}
  toggleLoader(false);
}

// --- Debug ---
window.debugServicos={getEmpresaId:()=>empresaId,getIsDono:()=>isDono,getIsAdmin:()=>isAdmin,getLocalStorage:()=>getEmpresaIdAtiva(),getIsProcessing:()=>isProcessing,recarregar:()=>window.location.reload(),forceReload:()=>{isInitialized=false;isProcessing=false;window.location.reload();}};
console.log("🔧 Funções de debug disponíveis em window.debugServicos");

initializeApp();
