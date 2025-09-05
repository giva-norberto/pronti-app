// ======================================================================
// ARQUIVO: servicos.js (VERSÃO CORRIGIDA PARA ESTABILIDADE E PERMISSÕES)
// ======================================================================

import {
  collection, doc, getDocs, getDoc, deleteDoc, query, where
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
let isProcessing = false;

// --- Inicialização segura do DOM ---
function initializeDOMElements() {
  listaServicosDiv = document.getElementById("lista-servicos");
  btnAddServico = document.querySelector(".btn-new");
  loader = document.getElementById("loader");
  appContent = document.getElementById("app-content");
}

// --- Funções Auxiliares ---
function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId");
}

function setEmpresaIdAtiva(id) {
  if (id) localStorage.setItem("empresaAtivaId", id);
  else localStorage.removeItem("empresaAtivaId");
}

function formatarPreco(preco) {
  if (preco === undefined || preco === null || isNaN(preco)) return "R$ 0,00";
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
    if (!servico || typeof servico !== "object") return;
    const cat = (servico.categoria && typeof servico.categoria === "string" && servico.categoria.trim())
      ? servico.categoria.trim()
      : "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(servico);
  });

  const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, "pt-BR"));
  listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => {
    const servicosCategoria = agrupados[cat].sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR")
    );
    return `
      <div class="categoria-bloco">
        <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
          ${sanitizeHTML(cat)}
        </h2>
        ${servicosCategoria.map(servico => `
          <div class="servico-card" data-servico-id="${sanitizeHTML(servico.id || "")}">
            <div class="servico-header">
              <h3 class="servico-titulo">${sanitizeHTML(servico.nome || "Sem nome")}</h3>
            </div>
            <p class="servico-descricao">${sanitizeHTML(servico.descricao || "Sem descrição.")}</p>
            <div class="servico-footer">
              <div>
                <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                <span class="servico-duracao"> • ${sanitizeHTML(String(servico.duracao || 0))} min</span>
              </div>
              <div class="servico-acoes">
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(servico.id || "")}" type="button">
                  Editar
                </button>
                ${(isDono || isAdmin) ? `
                  <button class="btn-acao btn-excluir" data-id="${sanitizeHTML(servico.id || "")}" type="button">
                    Excluir
                  </button>
                ` : ""}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

async function carregarServicosDoFirebase() {
  if (isProcessing) return;
  if (!empresaId) {
    if (listaServicosDiv) listaServicosDiv.innerHTML = "<p style=\"color:red;\">Empresa não encontrada.</p>";
    return;
  }
  isProcessing = true;
  if (listaServicosDiv) listaServicosDiv.innerHTML = "<p>Carregando serviços...</p>";
  try {
    // AQUI: A query agora filtra pelo empresaId, alinhando com as regras de segurança.
    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const q = query(servicosCol, where("empresaId", "==", empresaId)); // Adicionado filtro where
    const snap = await getDocs(q);
    const servicos = snap.docs.map(doc => {
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
  } catch (error) {
    if (listaServicosDiv) {
      listaServicosDiv.innerHTML = `<div style="color:red; text-align: center; padding: 20px;">
        <p>Erro ao carregar os serviços.</p>
        <p style="font-size: 12px; margin-top: 8px;">${error.message || "Erro desconhecido"}</p>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Tentar Novamente
        </button>
      </div>`;
    }
  } finally {
    isProcessing = false;
  }
}

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
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.");
    if (!confirmado) {
      isProcessing = false;
      return;
    }
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    await deleteDoc(servicoRef);
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
  } catch (error) {
    await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${error.message || "Erro desconhecido"}`);
  } finally {
    isProcessing = false;
  }
}

// --- Função para verificar se usuário tem acesso à empresa ---
// Esta função foi simplificada para usar o mapaUsuarios como fonte de verdade
// e evitar queries amplas que causavam erros de permissão.
async function verificarAcessoEmpresa(user, empresaIdParam) {
  if (!user || !empresaIdParam) return { hasAccess: false, isDono: false, reason: "PARAMETROS_INVALIDOS" };
  try {
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    if (!mapaSnap.exists() || mapaSnap.data().empresaId !== empresaIdParam) {
      return { hasAccess: false, isDono: false, reason: "NAO_ASSOCIADO_MAPA" };
    }

    const empresaRef = doc(db, "empresarios", empresaIdParam);
    const empresaSnap = await getDoc(empresaRef);
    if (!empresaSnap.exists()) return { hasAccess: false, isDono: false, reason: "EMPRESA_NAO_EXISTE" };
    const empresaData = empresaSnap.data();

    const isOwnerOfThisCompany = empresaData.donoId === user.uid;
    
    // Verifica se é um profissional ativo na subcoleção
    const profissionalRef = doc(db, "empresarios", empresaIdParam, "profissionais", user.uid);
    const profissionalSnap = await getDoc(profissionalRef);
    const isProfissionalAtivo = profissionalSnap.exists() && profissionalSnap.data().status === 'ativo';

    const hasAccess = isOwnerOfThisCompany || isProfissionalAtivo || isAdmin; // isAdmin já é global
    const isDonoFinal = isOwnerOfThisCompany || isAdmin; // Apenas o dono ou admin tem controle total

    return {
      hasAccess,
      isDono: isDonoFinal,
      isProfissional: isProfissionalAtivo,
      empresaNome: empresaData.nome || 'Empresa sem nome',
      reason: hasAccess ? "OK" : "SEM_PERMISSAO"
    };
  } catch (error) {
    console.error("Erro em verificarAcessoEmpresa:", error);
    return { hasAccess: false, isDono: false, reason: "ERRO_VERIFICACAO" };
  }
}

// --- Função para buscar empresas do usuário ---
// Esta função foi completamente reescrita para ser eficiente e segura.
async function buscarEmpresasDoUsuario(user) {
  if (!user) return [];
  try {
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    if (!mapaSnap.exists() || !mapaSnap.data().empresaId) {
      return []; // Usuário não associado a nenhuma empresa via mapa
    }
    const empresaIdDoMapa = mapaSnap.data().empresaId;

    const empresaRef = doc(db, "empresarios", empresaIdDoMapa);
    const empresaSnap = await getDoc(empresaRef);

    if (!empresaSnap.exists()) {
      // Empresa do mapa não existe, limpar mapa ou redirecionar
      console.warn(`Empresa ${empresaIdDoMapa} do mapaUsuarios não existe.`);
      return [];
    }

    const empresaData = empresaSnap.data();
    const isOwnerOfThisCompany = empresaData.donoId === user.uid;
    
    // Verifica se é um profissional ativo na subcoleção
    const profissionalRef = doc(db, "empresarios", empresaIdDoMapa, "profissionais", user.uid);
    const profissionalSnap = await getDoc(profissionalRef);
    const isProfissionalAtivo = profissionalSnap.exists() && profissionalSnap.data().status === 'ativo';

    if (isOwnerOfThisCompany || isProfissionalAtivo || isAdmin) {
      return [{
        id: empresaSnap.id,
        nome: empresaData.nome || 'Empresa sem nome',
        isDono: isOwnerOfThisCompany || isAdmin,
        isProfissional: isProfissionalAtivo
      }];
    } else {
      return []; // Não tem acesso a esta empresa
    }
  } catch (error) {
    console.error("Erro em buscarEmpresasDoUsuario:", error);
    return [];
  }
}

// --- Função para mostrar/esconder loader ---
function toggleLoader(show) {
  if (loader) loader.style.display = show ? "block" : "none";
  if (appContent) appContent.style.display = show ? "none" : "block";
}

// --- Função para configurar UI baseado nas permissões ---
function configurarUI() {
  if (btnAddServico) btnAddServico.style.display = (isDono || isAdmin) ? "inline-flex" : "none";
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
    return;
  }
  initializeDOMElements();
  setupEventListeners();
  onAuthStateChanged(auth, async (user) => {
    try {
      if (isInitialized) return; // Evita re-inicialização
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
      isAdmin = (user.uid === ADMIN_UID);
      toggleLoader(true);

      const empresaIdSalva = getEmpresaIdAtiva();
      let acessoVerificado = false;

      if (empresaIdSalva) {
        const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
        if (verificacao.hasAccess) {
          empresaId = empresaIdSalva;
          isDono = verificacao.isDono;
          acessoVerificado = true;
        } else {
          setEmpresaIdAtiva(null); // Limpa localStorage se acesso negado
        }
      }

      if (!acessoVerificado) {
        const empresasDisponiveis = await buscarEmpresasDoUsuario(user);
        if (empresasDisponiveis.length === 0) {
          if (loader) {
            loader.innerHTML = `<div style="color:red; text-align: center; padding: 20px;">
              <p>Você não tem acesso a nenhuma empresa.</p>
              <p>Entre em contato com o administrador.</p>
            </div>`;
          }
          return;
        } else if (empresasDisponiveis.length === 1) {
          const empresa = empresasDisponiveis[0];
          empresaId = empresa.id;
          isDono = empresa.isDono;
          setEmpresaIdAtiva(empresaId);
        } else {
          window.location.href = "selecionar-empresa.html";
          return;
        }
      }
      
      // Se chegou aqui, empresaId e isDono estão definidos e o usuário tem acesso.
      configurarUI();
      await carregarServicosDoFirebase();

    } catch (error) {
      console.error("Erro na inicialização do app de serviços:", error);
      if (loader) {
        loader.innerHTML = `<div style="color:red; text-align: center; padding: 20px;">
          <p>Ocorreu um erro ao carregar a página.</p>
          <p style="font-size: 12px; margin-top: 8px;">${error.message || "Erro desconhecido"}</p>
          <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Tentar Novamente
          </button>
        </div>`;
      }
    } finally {
      toggleLoader(false);
      isInitialized = true;
    }
  });
}

// --- Funções de Debug (remover em produção) ---
window.debugServicos = {
  getEmpresaId: () => empresaId,
  getIsDono: () => isDono,
  getIsAdmin: () => isAdmin,
  getLocalStorage: () => getEmpresaIdAtiva(),
  getIsProcessing: () => isProcessing,
  clearEmpresa: () => {
    setEmpresaIdAtiva(null);
    window.location.reload();
  },
  recarregar: () => window.location.reload(),
  forceReload: () => {
    isInitialized = false;
    isProcessing = false;
    window.location.reload();
  }
};

// --- Inicialização ---
initializeApp();

console.log("🔧 [DEBUG] Funções de debug disponíveis em window.debugServicos");

