// ======================================================================
// ARQUIVO: servicos.js (VERSÃO DEFINITIVA - LIMPA E COM LISTENER)
// ======================================================================

import {
  collection, doc, getDocs, getDoc, deleteDoc, onSnapshot, query
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
let listaServicosDiv, btnAddServico, loader;

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;
let donoUid = null;
let isAdmin = false;
let isInitialized = false;
let isProcessing = false;
let userUid = null;

// --- Inicialização segura do DOM ---
function initializeDOMElements() {
  listaServicosDiv = document.getElementById("lista-servicos");
  btnAddServico = document.querySelector(".btn-new");
  loader = document.getElementById("loader"); // O script precisa apenas do loader
  console.log("[DEBUG] initializeDOMElements: Elementos DOM inicializados.");
  if (!listaServicosDiv) console.error("[DEBUG] #lista-servicos não encontrado!");
  if (!btnAddServico) console.error("[DEBUG] .btn-new não encontrado!");
  if (!loader) console.error("[DEBUG] #loader não encontrado!");
}

// --- Funções Auxiliares ---
function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId");
}

function setEmpresaIdAtiva(id) {
  if (id) {
    localStorage.setItem("empresaAtivaId", id);
  } else {
    localStorage.removeItem("empresaAtivaId");
  }
}

function formatarPreco(preco) {
  if (preco === undefined || preco === null || isNaN(preco)) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(preco));
}

function sanitizeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Funções de Renderização e Ações ---
function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;

  if (!servicos || servicos.length === 0) {
    listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? "Clique em \"Adicionar Novo Serviço\" para começar." : ""}</p>`;
    return;
  }
  const agrupados = {};
  servicos.forEach(servico => {
    const cat = (servico.categoria && typeof servico.categoria === "string" && servico.categoria.trim())
      ? servico.categoria.trim()
      : "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(servico);
  });

  const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, "pt-BR"));

  listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => {
    const servicosCategoria = agrupados[cat].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    return `
      <div class="categoria-bloco">
        <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
          ${sanitizeHTML(cat)}
        </h2>
        ${servicosCategoria.map(servico => `
          <div class="servico-card" data-servico-id="${sanitizeHTML(servico.id || "")}">
            <div class="servico-header">
              <h3 class="servico-titulo">${sanitizeHTML(servico.nome || "Sem nome")}</h3>
              ${donoUid ? `<span style="font-size:0.8em;color:#4f46e5;">Dono: ${sanitizeHTML(donoUid)}</span>` : ""}
            </div>
            <p class="servico-descricao">${sanitizeHTML(servico.descricao || "Sem descrição.")}</p>
            <div class="servico-footer">
              <div>
                <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                <span class="servico-duracao"> • ${sanitizeHTML(String(servico.duracao || 0))} min</span>
              </div>
              <div class="servico-acoes">
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(servico.id || "")}" type="button">Editar</button>
                ${(isDono || isAdmin) ? `<button class="btn-acao btn-excluir" data-id="${sanitizeHTML(servico.id || "")}" type="button">Excluir</button>` : ""}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

// --- Listener em Tempo Real ---
function iniciarListenerDeServicos() {
  if (!empresaId) return;

  const servicosCol = collection(db, "empresarios", empresaId, "servicos");
  const q = query(servicosCol);

  onSnapshot(q, (snapshot) => {
    console.log("[DEBUG] Listener de serviços recebeu uma atualização do Firebase.");
    const servicos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarServicos(servicos);
  }, (error) => {
    console.error("Erro no listener de serviços:", error);
    if(listaServicosDiv) listaServicosDiv.innerHTML = `<p style="color:red;">Erro ao carregar serviços em tempo real.</p>`;
  });
}

// --- Excluir Serviço ---
async function excluirServico(servicoId) {
  if (isProcessing) return;
  if (!servicoId) {
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
    if (!confirmado) return;

    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    await deleteDoc(servicoRef);
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
  } catch (error) {
    await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${error.message || "Erro desconhecido"}`);
  } finally {
    isProcessing = false;
  }
}

async function verificarAcessoEmpresa(user, id) {
    const empresaRef = doc(db, "empresarios", id);
    const empresaSnap = await getDoc(empresaRef);
    if (!empresaSnap.exists()) return { hasAccess: false, isDono: false };
    const empresaData = empresaSnap.data();
    const isOwner = empresaData.donoId === user.uid;
    donoUid = empresaData.donoId || null;
    let ehDonoProfissional = false;
    try {
        const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
        if (profSnap.exists()) ehDonoProfissional = !!profSnap.data().ehDono;
    } catch (e) {}
    const isDonoFinal = isOwner || ehDonoProfissional;
    // Simplificando a verificação de acesso para corresponder à lógica de dono
    const hasAccess = isDonoFinal || isAdmin;
    return { hasAccess, isDono: isDonoFinal || isAdmin };
}

async function buscarEmpresasDoUsuario(user) {
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresasIds = mapaSnap.exists() ? mapaSnap.data().empresas || [] : [];
    const promessas = empresasIds.map(async id => {
        const empresaSnap = await getDoc(doc(db, "empresarios", id));
        if (empresaSnap.exists()) {
            const verificacao = await verificarAcessoEmpresa(user, id);
            return {
                id,
                nome: empresaSnap.data().nome || empresaSnap.data().nomeFantasia || "Empresa sem nome",
                isDono: verificacao.isDono
            };
        }
        return null;
    });
    return (await Promise.all(promessas)).filter(Boolean);
}

// --- Função para mostrar/esconder loader ---
function toggleLoader(show) {
    // A função agora controla apenas o #loader, pois #app-content não é mais necessário.
  if (loader) {
    loader.style.display = show ? "flex" : "none";
  }
}

function configurarUI() {
  if (btnAddServico) {
    btnAddServico.style.display = (isDono || isAdmin) ? "inline-flex" : "none";
  }
}

function setupEventListeners() {
  if (listaServicosDiv) {
    listaServicosDiv.addEventListener("click", async function(e) {
      const target = e.target.closest(".btn-acao");
      if (!target) return;
      const id = target.dataset.id;
      if (!id) return;
      e.preventDefault();
      if (target.classList.contains("btn-editar")) {
        if (isDono || isAdmin) {
          window.location.href = `novo-servico.html?id=${encodeURIComponent(id)}`;
        } else {
          await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
        }
      } else if (target.classList.contains("btn-excluir")) {
        await excluirServico(id);
      }
    });
  }
  if (btnAddServico) {
    btnAddServico.addEventListener("click", (e) => {
      if (!(isDono || isAdmin)) {
        e.preventDefault();
        showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
      }
    });
  }
}

function initializeApp() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
    return;
  }
  initializeDOMElements();
  setupEventListeners();
  
  toggleLoader(true);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (isInitialized) return;
      isInitialized = true;
      userUid = user.uid;
      const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
      isAdmin = (user.uid === ADMIN_UID);
      
      let empresaIdSalva = getEmpresaIdAtiva();
      if (empresaIdSalva) {
        const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
        if (verificacao.hasAccess) {
          empresaId = empresaIdSalva;
          isDono = verificacao.isDono;
        } else {
          setEmpresaIdAtiva(null);
          empresaIdSalva = null;
        }
      }

      if (!empresaIdSalva) {
        const empresas = await buscarEmpresasDoUsuario(user);
        if (empresas.length === 1) {
          empresaId = empresas[0].id;
          setEmpresaIdAtiva(empresaId);
          const verificacao = await verificarAcessoEmpresa(user, empresaId);
          isDono = verificacao.isDono;
        } else if (empresas.length > 1) {
          window.location.href = "selecionar-empresa.html";
          return;
        } else {
          // Caso de 0 empresas
          if(loader) loader.innerHTML = `<p style="color:red;">Você não tem acesso a nenhuma empresa.</p>`;
          return;
        }
      }
      
      configurarUI();
      iniciarListenerDeServicos();
      toggleLoader(false);

    } else {
      window.location.href = "login.html";
    }
  });
}

initializeApp();
