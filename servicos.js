// ======================================================================
// ARQUIVO: servicos.js (VERSÃO RESUMIDA E ROBUSTA COM TIMEOUT AUTH)
// ======================================================================

import { collection, doc, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- DOM ---
let listaServicosDiv = document.getElementById('lista-servicos');
let btnAddServico = document.querySelector('.btn-new');
let loader = document.getElementById('loader');
let appContent = document.getElementById('app-content');

// --- Estado ---
let empresaId = null;
let isDono = false;
let isAdmin = false;
let isProcessing = false;

// --- Auxiliares ---
function getEmpresaIdAtiva() { return localStorage.getItem("empresaAtivaId"); }
function setEmpresaIdAtiva(id) { id ? localStorage.setItem("empresaAtivaId", id) : localStorage.removeItem("empresaAtivaId"); }
function formatarPreco(preco) { return preco == null || isNaN(preco) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(preco); }
function sanitizeHTML(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function toggleLoader(show) { if(loader) loader.style.display = show?'block':'none'; if(appContent) appContent.style.display = show?'none':'block'; }

// --- Render ---
function renderizarServicos(servicos) {
  if(!listaServicosDiv) return;
  if(!servicos?.length) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono||isAdmin)?'Clique em "Adicionar Novo Serviço"':''}</p>`;
    return;
  }

  const agrupados = {};
  servicos.forEach(s=>{ const cat = s.categoria?.trim()||'Sem Categoria'; agrupados[cat]??=[]; agrupados[cat].push(s); });
  const html = Object.keys(agrupados).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(cat=>{
    const servicosCategoria = agrupados[cat].sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt-BR'));
    return `<div class="categoria-bloco">
      <h2 style="color:#6366f1;margin:12px 0;">${sanitizeHTML(cat)}</h2>
      ${servicosCategoria.map(s=>`<div class="servico-card" data-id="${sanitizeHTML(s.id||'')}">
        <div class="servico-header"><h3>${sanitizeHTML(s.nome||'Sem nome')}</h3></div>
        <p>${sanitizeHTML(s.descricao||'Sem descrição.')}</p>
        <div><span>${formatarPreco(s.preco)}</span> • ${sanitizeHTML(String(s.duracao||0))} min</div>
        <div>
          <button class="btn-editar" data-id="${sanitizeHTML(s.id||'')}">Editar</button>
          ${(isDono||isAdmin)?`<button class="btn-excluir" data-id="${sanitizeHTML(s.id||'')}">Excluir</button>`:''}
        </div>
      </div>`).join('')}
    </div>`;
  }).join('');
  listaServicosDiv.innerHTML = html;
}

// --- Firebase ---
async function carregarServicosDoFirebase() {
  if(isProcessing) return;
  empresaId = getEmpresaIdAtiva();
  if(!empresaId){ listaServicosDiv.innerHTML='<p style="color:red;">Empresa não encontrada.</p>'; return; }
  isProcessing=true;
  try {
    listaServicosDiv.innerHTML='<p>Carregando serviços...</p>';
    const snap = await getDocs(collection(db,"empresarios",empresaId,"servicos"));
    const servicos = snap.docs.map(d=>({id:d.id,...d.data(),nome:d.data().nome||'',descricao:d.data().descricao||'',preco:d.data().preco||0,duracao:d.data().duracao||0,categoria:d.data().categoria||''}));
    renderizarServicos(servicos);
  } catch(e){ console.error(e); listaServicosDiv.innerHTML='<p style="color:red;">Erro ao carregar serviços.</p>'; }
  finally{ isProcessing=false; }
}

async function excluirServico(servicoId){
  if(isProcessing) return;
  if(!servicoId){ await showAlert("Erro","ID do serviço não encontrado."); return; }
  if(!(isDono||isAdmin)){ await showAlert("Acesso Negado","Apenas dono ou admin pode excluir."); return; }
  isProcessing=true;
  try{
    const conf=await showCustomConfirm("Confirmação","Excluir este serviço?");
    if(!conf){ isProcessing=false; return; }
    await deleteDoc(doc(db,"empresarios",empresaId,"servicos",servicoId));
    await showAlert("Sucesso","Serviço excluído!");
    await carregarServicosDoFirebase();
  }catch(e){ console.error(e); await showAlert("Erro",e.message||"Erro desconhecido"); }
  finally{ isProcessing=false; }
}

// --- Event Listeners ---
listaServicosDiv?.addEventListener('click',async e=>{
  const btn=e.target.closest('button');
  if(!btn) return;
  const id=btn.dataset.id;
  if(btn.classList.contains('btn-editar')) (isDono||isAdmin)?window.location.href=`novo-servico.html?id=${encodeURIComponent(id)}`:await showAlert("Acesso Negado","Apenas dono ou admin");
  else if(btn.classList.contains('btn-excluir')) await excluirServico(id);
});

btnAddServico?.addEventListener('click',async e=>{if(isDono||isAdmin) window.location.href='novo-servico.html'; else await showAlert("Acesso Negado","Apenas dono ou admin");});

// --- Auth & Inicialização ---
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    console.warn("⚠️ Usuário ainda não restaurado, aguardando 1s...");
    setTimeout(()=>{
      const u=auth.currentUser;
      if(!u){ window.location.href='login.html'; return; }
      empresaId = getEmpresaIdAtiva();
      carregarServicosDoFirebase();
    },1000);
    return;
  }
  const ADMIN_UID="BX6Q7HrVMrcCBqe72r7K76EBPkX2";
  isAdmin=(user.uid===ADMIN_UID);
  empresaId=getEmpresaIdAtiva();
  carregarServicosDoFirebase();
});
