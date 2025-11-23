// ======================================================================
// ARQUIVO: servicos.js (VERSÃO ORGANIZADA — SERVIÇOS + SERVIÇOS_PET)
// ======================================================================
import {
  collection,
  doc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
const listaServicosDiv = document.getElementById('lista-servicos'); 
const btnAddServico = document.querySelector('.btn-new');           
const btnPromocoes = document.getElementById('btnPromocoes');      
const tituloServicosContainer = document.getElementById('titulo-servicos'); 

// --- Estado ---
let empresaId = null;
let isDono = false;
const adminUID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId") || null;
}

// --- Inicialização e Auth ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  try {
    empresaId = getEmpresaIdAtiva();
    if (!empresaId) {
      if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Nenhuma empresa ativa selecionada.</p>';
      return;
    }

    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    if (empresaSnap.exists()) {
      isDono = (empresaSnap.data().donoId === user.uid) || (user.uid === adminUID);
    } else {
      isDono = (user.uid === adminUID);
    }

    if (btnAddServico) btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
    if (btnPromocoes) btnPromocoes.style.display = isDono ? 'inline-flex' : 'none';

    iniciarListeners();

  } catch (err) {
    console.error("Erro init servicos:", err);
    if (listaServicosDiv) listaServicosDiv.innerHTML = `<p style="color:red;">Erro ao inicializar serviços.</p>`;
  }
});

// --- Listeners em tempo real para ambas coleções ---
let unsubscribeServicos = null;
let unsubscribeServicosPet = null;

function iniciarListeners() {
  if (!empresaId) return;
  if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

  const servicosCol = collection(db, "empresarios", empresaId, "servicos");
  const servicosPetCol = collection(db, "empresarios", empresaId, "servicos_pet");

  const q1 = query(servicosCol);
  const q2 = query(servicosPetCol);

  if (unsubscribeServicos) unsubscribeServicos();
  if (unsubscribeServicosPet) unsubscribeServicosPet();

  unsubscribeServicos = onSnapshot(q1, (snap) => {
    const servicos = snap.docs.map(d => ({ id: d.id, ...d.data(), __type: 'normal' }));
    mergeAndRender(servicos, null);
  }, (err) => {
    console.error("Erro realtime servicos:", err);
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar serviços.</p>';
  });

  unsubscribeServicosPet = onSnapshot(q2, (snap) => {
    const servicosPet = snap.docs.map(d => ({ id: d.id, ...d.data(), __type: 'pet' }));
    mergeAndRender(null, servicosPet);
  }, (err) => {
    console.error("Erro realtime servicos_pet:", err);
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar serviços PET.</p>';
  });
}

// --- Buffer local ---
let bufferServicos = [];
let bufferServicosPet = [];

function mergeAndRender(servicos = null, servicosPet = null) {
  if (servicos !== null) bufferServicos = servicos;
  if (servicosPet !== null) bufferServicosPet = servicosPet;
  renderizarTudo(bufferServicos || [], bufferServicosPet || []);
}

// --- Renderização principal ---
function renderizarTudo(servicos, servicosPet) {
  if (!listaServicosDiv) return;

  if ((!servicos || servicos.length === 0) && (!servicosPet || servicosPet.length === 0)) {
    listaServicosDiv.innerHTML = `<p style="color: #fff; font-weight: 500;">Nenhum serviço cadastrado. ${isDono ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
    return;
  }

  const agruparPorCategoria = (items) => {
    const agrup = {};
    items.forEach(s => {
      const cat = (s.categoria && s.categoria.trim()) ? s.categoria.trim() : "Outros";
      if (!agrup[cat]) agrup[cat] = [];
      agrup[cat].push(s);
    });
    Object.keys(agrup).forEach(cat => {
      agrup[cat].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    });
    return agrup;
  };

  const agrupNormais = agruparPorCategoria(servicos || []);
  const agrupPets = agruparPorCategoria(servicosPet || []);

  // <<< REMOVIDO O TÍTULO "Serviços" DO BLOCO NORMAL >>>
  const renderCategoriaBlocos = (agrup, isPetSection) => {
    const cats = Object.keys(agrup).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return cats.map(cat => {
      const cards = agrup[cat].map(s => renderServicoCard(s, isPetSection)).join("");
      return `<div class="categoria-bloco">
                <h2 class="categoria-titulo">${sanitizeHTML(cat)}</h2>
                ${cards}
              </div>`;
    }).join("");
  };

  // <<< REMOVIDO O TÍTULO "Serviços" >>>
  const htmlNormais = Object.keys(agrupNormais).length ? `<section class="sec-servicos-normais">
      ${renderCategoriaBlocos(agrupNormais, false)}
    </section>` : '';

  const htmlPets = Object.keys(agrupPets).length ? `<section class="sec-servicos-pet">
      <h1 class="sec-titulo">Serviços PET</h1>
      ${renderCategoriaBlocos(agrupPets, true)}
    </section>` : '';

  listaServicosDiv.innerHTML = htmlPets + htmlNormais;
}

// --- Render cartão de serviço ---
// Layout PET: nome, descrição, preços por porte. NÃO mostra título "Serviços PET".
function renderServicoCard(servico, isPetSection) {
  const nome = sanitizeHTML(servico.nome);
  const desc = sanitizeHTML(servico.descricao || "");
  const precosPorPorte = Array.isArray(servico.precos) ? servico.precos : [];
  const isPet = isPetSection || servico.tipo === 'pets';

  if (isPet) {
    // Remove o cabeçalho "Serviços PET"
    return `
    <div class="servico-card servico-card-pet" data-id="${servico.id}" data-type="pet" style="border:2px solid #38bdf8;border-radius:16px;box-shadow:0 1px 12px #0002;background:#fff;margin-bottom:18px;padding:22px;max-width:360px;">
      <div class="servico-header" style="display:flex;align-items:center;">
        <h3 class="servico-titulo" style="font-size:1.28em;font-weight:700;color:#222;margin:0;flex:1;">
          ${nome}
        </h3>
      </div>
      <p class="servico-descricao" style="color:#888;font-size:1em;margin:7px 0 12px 0;padding-bottom:8px;">
        ${desc}
      </p>
      <hr style="margin-bottom:12px; margin-top:0;border:0;border-bottom:1px dashed #a0aec0;">
      <div style="margin-bottom:12px;">
        <div style="font-weight:600;color:#222;">Preços por Porte:</div>
        ${precosPorPorte.length > 0 ? 
            precosPorPorte.map(p => `<div style="font-size:1.03em;margin:3px 0;">
              <span style="font-weight:500;">${sanitizeHTML(p.porte)}:</span> 
              ${formatarPreco(p.preco)} ${p.duracao ? `• ${p.duracao} min` : ""}
            </div>`).join("")
          : `<div style="color:#486;">(Sem preços por porte)</div>`
        }
      </div>
      <div style="display:flex;justify-content:center;gap:16px;margin-top:15px;">
        <button class="btn-acao btn-editar" data-id="${servico.id}" data-type="pet"
          style="background:#38bdf8;color:#fff;padding:9px 28px;font-weight:600;border:none;border-radius:6px;font-size:1.08em;box-shadow:0 2px 8px #0001;cursor:pointer;">
          Editar
        </button>
        <button class="btn-acao btn-excluir" data-id="${servico.id}" data-type="pet"
          style="background:#ef4444;color:#fff;padding:9px 28px;font-weight:600;border:none;border-radius:6px;font-size:1.08em;box-shadow:0 2px 8px #0001;cursor:pointer;">
          Excluir
        </button>
      </div>
    </div>
    `;
  }

  // Layout NORMAL
  const preco = formatarPreco(servico.preco);
  const duracao = servico.duracao ? (`${servico.duracao} min`) : "";
  return `
    <div class="servico-card servico-card-normal" data-id="${servico.id}" data-type="normal" style="background:#fff;padding:20px;border-radius:10px;margin-bottom:15px;box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
      <div class="servico-header">
        <h3 class="servico-titulo" style="font-size:1.21em;">${nome}</h3>
      </div>
      <p class="servico-descricao" style="color:#666;margin-bottom:8px;">${desc}</p>
      <div class="servico-footer" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span class="servico-preco" style="font-size:1.18em;color:#28a745;font-weight:bold;">${preco}</span>
          ${duracao ? `<span class="servico-duracao" style="color:#888;"> • ${duracao}</span>` : ""}
        </div>
        ${isDono ? `
          <div class="servico-acoes" style="display:flex;gap:10px;">
            <button class="btn-acao btn-editar" data-id="${servico.id}" data-type="normal" style="background:#38bdf8;color:#fff;font-weight:600;border:none;border-radius:5px;padding:7px 17px;cursor:pointer;">Editar</button>
            <button class="btn-acao btn-excluir" data-id="${servico.id}" data-type="normal" style="background:#ef4444;color:#fff;font-weight:600;border:none;border-radius:5px;padding:7px 17px;cursor:pointer;">Excluir</button>
          </div>` : ""}
      </div>
    </div>
  `;
}

// --- Excluir serviço ---
async function excluirServico(servicoId, tipo) {
  if (!isDono) {
    await showAlert("Acesso Negado", "Apenas o dono pode excluir serviços.");
    return;
  }
  const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.");
  if (!confirmado) return;

  try {
    const caminho = tipo === 'pet' ? ["empresarios", empresaId, "servicos_pet", servicoId] : ["empresarios", empresaId, "servicos", servicoId];
    const servicoRef = doc(db, ...caminho);
    await deleteDoc(servicoRef);
    await showAlert("Sucesso", "Serviço excluído com sucesso.");
  } catch (err) {
    console.error("Erro ao excluir serviço:", err);
    await showAlert("Erro", "Não foi possível excluir o serviço: " + (err.message || err));
  }
}

// --- Utilitários ---
function formatarPreco(preco) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco || 0);
  } catch (e) {
    return "R$ 0,00";
  }
}
function sanitizeHTML(str) {
  if (!str) return "";
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

// --- Event Listeners ---
if (listaServicosDiv) {
  listaServicosDiv.addEventListener('click', function(e) {
    const target = e.target.closest('.btn-acao');
    if (!target) return;
    const id = target.dataset.id;
    // Sempre redireciona para novo-servico.html, independente do tipo
    if (target.classList.contains('btn-editar')) {
      window.location.href = `novo-servico.html?id=${id}`;
    }
    if (target.classList.contains('btn-excluir')) {
      const tipo = target.dataset.type || 'normal';
      excluirServico(id, tipo);
    }
  });
}

if (btnAddServico) {
  btnAddServico.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isDono) {
      showAlert("Acesso Negado", "Apenas o dono pode adicionar serviços.");
    } else {
      window.location.href = 'novo-servico.html';
    }
  });
}

if (btnPromocoes) {
  btnPromocoes.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isDono) {
      showAlert("Acesso Negado", "Apenas o dono pode gerenciar promoções.");
    } else {
      window.location.href = 'promocoes.html';
    }
  });
}
