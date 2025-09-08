// ======================================================================
// ARQUIVO: servicos.js (VERSÃO FINAL COM LISTENER EM TEMPO REAL)
// ======================================================================

import {
  collection, doc, getDocs, getDoc, deleteDoc, onSnapshot, query
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
let listaServicosDiv, btnAddServico, loader, appContent;

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;
let donoUid = null; // UID do dono da empresa
let isAdmin = false;
let isProfissional = false;
let isInitialized = false;
let isProcessing = false;
let userUid = null;
let empresaDataDebug = null;

// --- Inicialização segura do DOM ---
function initializeDOMElements() {
  listaServicosDiv = document.getElementById("lista-servicos");
  btnAddServico = document.querySelector(".btn-new");
  loader = document.getElementById("loader");
  appContent = document.getElementById("app-content");
  console.log("[DEBUG] initializeDOMElements: Elementos DOM inicializados", {
    listaServicosDiv, btnAddServico, loader, appContent
  });
  if (!listaServicosDiv) console.error("[DEBUG] initializeDOMElements: #lista-servicos não encontrado!");
  if (!btnAddServico) console.error("[DEBUG] initializeDOMElements: .btn-new não encontrado!");
  if (!loader) console.error("[DEBUG] initializeDOMElements: #loader não encontrado!");
  if (!appContent) console.error("[DEBUG] initializeDOMElements: #app-content não encontrado!");
}

// --- Funções Auxiliares ---
function getEmpresaIdAtiva() {
  try { 
    const eid = localStorage.getItem("empresaAtivaId"); 
    console.log("[DEBUG] getEmpresaIdAtiva: ID da empresa ativa do localStorage:", eid);
    return eid;
  }
  catch (e) { 
    console.error("[DEBUG] getEmpresaIdAtiva: Erro ao obter empresa ativa do localStorage:", e);
    return null; 
  }
}

function setEmpresaIdAtiva(id) {
  try {
    if (id) {
      localStorage.setItem("empresaAtivaId", id);
      console.log("[DEBUG] setEmpresaIdAtiva: Empresa ativa definida para:", id);
    }
    else {
      localStorage.removeItem("empresaAtivaId");
      console.log("[DEBUG] setEmpresaIdAtiva: Empresa ativa removida do localStorage.");
    }
  } catch (e) {
    console.error("[DEBUG] setEmpresaIdAtiva: Erro ao definir/remover empresa ativa no localStorage:", e);
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
  console.log("[DEBUG] renderizarServicos: Iniciando renderização de serviços. Total:", servicos ? servicos.length : 0);
  if (!listaServicosDiv) {
    console.error("[DEBUG] renderizarServicos: Elemento listaServicosDiv não encontrado.");
    return;
  }

  if (!servicos || servicos.length === 0) {
    const msg = `<p>Nenhum serviço cadastrado. ${(isDono || isAdmin) ? "Clique em \"Adicionar Novo Serviço\" para começar." : ""}</p>`;
    listaServicosDiv.innerHTML = msg;
    return;
  }
  const agrupados = {};
  servicos.forEach(servico => {
    if (!servico || typeof servico !== "object") return;
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
                ${(isDono || isAdmin) ? `
                  <button class="btn-acao btn-excluir" data-id="${sanitizeHTML(servico.id || "")}" type="button">Excluir</button>
                ` : ""}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

// --- ⭐ NOVO: Listener de Serviços em Tempo Real ---
// Esta função substitui a antiga 'carregarServicosDoFirebase'.
// Ela "escuta" as mudanças no banco de dados e atualiza a tela automaticamente.
function iniciarListenerDeServicos() {
  console.log("[DEBUG] Iniciando listener de serviços em tempo real.");
  if (!empresaId) {
    if (listaServicosDiv) listaServicosDiv.innerHTML = "<p style=\"color:red;\">Empresa não encontrada.</p>";
    return;
  }
  
  const servicosCol = collection(db, "empresarios", empresaId, "servicos");
  const q = query(servicosCol);

  onSnapshot(q, (snapshot) => {
    console.log("[DEBUG] Listener de serviços recebeu uma atualização do Firebase.");
    const servicos = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        nome: data.nome || "",
        descricao: data.descricao || "",
        preco: data.preco || 0,
        duracao: data.duracao || 0,
        categoria: data.categoria || ""
      };
    });
    renderizarServicos(servicos);
  }, (error) => {
    console.error("Erro no listener de serviços:", error);
    if(listaServicosDiv) {
        listaServicosDiv.innerHTML = `<p style="color:red;">Ocorreu um erro ao carregar os serviços em tempo real.</p>`;
    }
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
    if (!confirmado) {
      isProcessing = false;
      return;
    }
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    await deleteDoc(servicoRef);
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    // ⭐ REMOVIDO: A linha 'await carregarServicosDoFirebase()' não é mais necessária.
    // O listener 'onSnapshot' detecta a exclusão e atualiza a tela sozinho.
  } catch (error) {
    await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${error.message || "Erro desconhecido"}`);
  } finally {
    isProcessing = false;
  }
}

// --- Verificação de Permissão e Identificação (Dono/Admin/Profissional) ---
async function verificarAcessoEmpresa(user, empresaId) {
  try {
    if (!user || !empresaId) {
      return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null, donoUid: null };
    }
    userUid = user.uid;
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    let empresasPermitidas = [];
    if (mapaSnap.exists()) {
      empresasPermitidas = Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];
    }
    if (!empresasPermitidas.includes(empresaId)) {
      return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null, donoUid: null };
    }
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    if (!empresaSnap.exists()) {
      return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null, donoUid: null };
    }
    const empresaData = empresaSnap.data();
    empresaDataDebug = empresaData;
    const isOwner = empresaData.donoId === user.uid;
    donoUid = empresaData.donoId || null;
    let isProfissional_ = false;
    let ehDonoProfissional = false;
    let profDataDebug = null;
    try {
      const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
      if (profSnap.exists()) {
        isProfissional_ = true;
        profDataDebug = profSnap.data();
        ehDonoProfissional = !!profDataDebug.ehDono;
      }
    } catch (e) {}
    const isDonoFinal = isOwner || ehDonoProfissional;
    const hasAccess = isDonoFinal || isProfissional_ || isAdmin;
    return {
      hasAccess,
      isDono: isDonoFinal || isAdmin,
      isProfissional: isProfissional_,
      empresaData,
      profDataDebug,
      donoUid: donoUid
    };
  } catch (e) {
    return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null, donoUid: null };
  }
}

// --- Buscar Empresas do Usuário ---
async function buscarEmpresasDoUsuario(user) {
  try {
    if (!user) return [];
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) 
      ? mapaSnap.data().empresas 
      : [];
    const promessas = empresas.map(async id => {
      const empresaSnap = await getDoc(doc(db, "empresarios", id));
      if (empresaSnap.exists()) {
        const empresaData = empresaSnap.data();
        let isProfissional = false, ehDonoProfissional = false;
        try {
          const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
          if (profSnap.exists()) {
            isProfissional = true;
            ehDonoProfissional = !!profSnap.data().ehDono;
          }
        } catch (e) {}
        const isDonoFinal = empresaData.donoId === user.uid || ehDonoProfissional;
        return {
          id,
          nome: empresaData.nome || empresaData.nomeFantasia || "Empresa sem nome",
          isDono: isDonoFinal || isAdmin,
          isProfissional
        };
      }
      return null;
    });
    const empresasObjs = await Promise.all(promessas);
    return empresasObjs.filter(Boolean);
  } catch (e) {
    return [];
  }
}

// --- Função para mostrar/esconder loader ---
function toggleLoader(show) {
  if (loader) loader.style.display = show ? "flex" : "none";
  if (appContent) appContent.style.display = show ? "none" : "block";
}

// --- Função para configurar UI baseado nas permissões ---
function configurarUI() {
  if (btnAddServico) {
    btnAddServico.style.display = (isDono || isAdmin) ? "inline-flex" : "none";
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  if (listaServicosDiv) {
    listaServicosDiv.addEventListener("click", async function(e) {
      if (isProcessing) return;
      const target = e.target.closest(".btn-acao");
      if (!target) return;
      const id = target.dataset.id;
      if (!id) return;
      e.preventDefault(); 
      e.stopPropagation();
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
    btnAddServico.addEventListener("click", async (e) => {
      e.preventDefault(); 
      e.stopPropagation();
      if (isProcessing) return;
      if (isDono || isAdmin) {
        window.location.href = "novo-servico.html";
      } else {
        await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
      }
    });
  }
}

// --- Ponto de Entrada Principal ---
function initializeApp() {
  console.log("[DEBUG] initializeApp: Iniciando aplicação.");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
    return;
  }
  initializeDOMElements();
  setupEventListeners();
  
  toggleLoader(true);
  if (appContent) appContent.style.display = 'none';

  onAuthStateChanged(auth, async (user) => {
    console.log("[DEBUG] onAuthStateChanged disparado. Usuário:", user ? user.uid : "NULO");

    if (user) {
      console.log(`[DEBUG] Usuário AUTENTICADO: ${user.uid}. Iniciando lógica da aplicação.`);
      
      if (isInitialized) {
          console.log("[DEBUG] Aplicação já inicializada. Ignorando evento de auth.");
          return;
      }
      isInitialized = true;
      userUid = user.uid;
      const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
      isAdmin = (user.uid === ADMIN_UID);
      
      const empresaIdSalva = getEmpresaIdAtiva();
      if (empresaIdSalva) {
        const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
        if (verificacao.hasAccess) {
          isDono = verificacao.isDono;
          isProfissional = verificacao.isProfissional;
          empresaDataDebug = verificacao.empresaData;
          donoUid = verificacao.donoUid;
          empresaId = empresaIdSalva;
          configurarUI();
          iniciarListenerDeServicos(); // ⭐ ALTERADO
          toggleLoader(false);
          return;
        } else {
          setEmpresaIdAtiva(null);
        }
      }

      const empresasDisponiveis = await buscarEmpresasDoUsuario(user);
      if (empresasDisponiveis.length === 0) {
        if (loader) {
          loader.innerHTML = `<div style="color:red; text-align: center; padding: 20px;"><p>Você não tem acesso a nenhuma empresa.</p></div>`;
        }
        toggleLoader(true);
        if (appContent) appContent.style.display = 'none';
        return;
      } 
       
       if (empresasDisponiveis.length === 1) {
        const empresa = empresasDisponiveis[0];
        empresaId = empresa.id;
        isDono = empresa.isDono;
        isProfissional = empresa.isProfissional;
        setEmpresaIdAtiva(empresaId);
        const empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
        donoUid = empresaSnap.exists() ? (empresaSnap.data().donoId || null) : null;
        configurarUI();
        iniciarListenerDeServicos(); // ⭐ ALTERADO
        toggleLoader(false);
      } else {
        window.location.href = "selecionar-empresa.html";
      }
    } else {
      if (loader) {
        loader.innerHTML = `<div style="color:red; text-align: center; padding: 20px;"><p>Sessão não encontrada ou expirada.</p><button onclick="window.location.href='login.html'">Ir para Login</button></div>`;
      }
      toggleLoader(true);
      if (appContent) appContent.style.display = 'none';
    }
  }, (error) => {
    console.error("[DEBUG] Erro no listener de autenticação:", error);
    if (loader) {
      loader.innerHTML = `<div style="color:red; text-align: center; padding: 20px;"><p>Ocorreu um erro de autenticação.</p><button onclick="window.location.href='login.html'">Ir para Login</button></div>`;
    }
    toggleLoader(true);
    if (appContent) appContent.style.display = 'none';
  });
  console.log("[DEBUG] initializeApp: Função initializeApp concluída. Aguardando resposta do onAuthStateChanged.");
}

initializeApp();
