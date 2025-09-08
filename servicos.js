// ======================================================================
// ARQUIVO: servicos.js (DEBUG COMPLETO REVISADO - IDENTIFICAÇÃO DE DONO, ADMIN, PROFISSIONAL, EMPRESA E SERVIÇOS)
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
  // Adicionar verificação para garantir que os elementos foram encontrados
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
  console.log("[DEBUG] formatarPreco: Formatando preço:", preco);
  if (preco === undefined || preco === null || isNaN(preco)) {
    console.log("[DEBUG] formatarPreco: Preço inválido, retornando R$ 0,00.");
    return "R$ 0,00";
  }
  const formattedPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(preco));
  console.log("[DEBUG] formatarPreco: Preço formatado:", formattedPrice);
  return formattedPrice;
}

function sanitizeHTML(str) {
  console.log("[DEBUG] sanitizeHTML: Sanitizando string:", str);
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  const sanitized = div.innerHTML;
  console.log("[DEBUG] sanitizeHTML: String sanitizada:", sanitized);
  return sanitized;
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
    console.log("[DEBUG] renderizarServicos: Nenhum serviço para renderizar, exibindo mensagem padrão.");
    return;
  }
  const agrupados = {};
  servicos.forEach(servico => {
    if (!servico || typeof servico !== "object") {
      console.warn("[DEBUG] renderizarServicos: Serviço inválido encontrado, ignorando:", servico);
      return;
    }
    const cat = (servico.categoria && typeof servico.categoria === "string" && servico.categoria.trim())
      ? servico.categoria.trim()
      : "Sem Categoria";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(servico);
    console.log("[DEBUG] renderizarServicos: Serviço agrupado na categoria \"" + cat + "\":", servico.nome);
  });

  const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, "pt-BR"));
  console.log("[DEBUG] renderizarServicos: Categorias ordenadas:", categoriasOrdenadas);

  listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => {
    const servicosCategoria = agrupados[cat].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    console.log("[DEBUG] renderizarServicos: Renderizando categoria \"" + cat + "\" com " + servicosCategoria.length + " serviços.");
    return `
      <div class="categoria-bloco">
        <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
          ${sanitizeHTML(cat)}
        </h2>
        ${servicosCategoria.map(servico => {
          console.log("[DEBUG] renderizarServicos: Renderizando serviço \"" + servico.nome + "\" (ID: " + servico.id + ").");
          return `
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
                <button class="btn-acao btn-editar" data-id="${sanitizeHTML(servico.id || "")}" type="button">Editar</button>
                ${(isDono || isAdmin) ? `
                  <button class="btn-acao btn-excluir" data-id="${sanitizeHTML(servico.id || "")}" type="button">Excluir</button>
                ` : ""}
              </div>
            </div>
          </div>
        `;
        }).join("")}
      </div>
    `;
  }).join("");
  console.log("[DEBUG] renderizarServicos: Renderização de serviços concluída.");
}

// --- Firebase - Carregar Serviços ---
async function carregarServicosDoFirebase() {
  console.log("[DEBUG] carregarServicosDoFirebase: Iniciando carregamento de serviços do Firebase.");
  if (isProcessing) {
    console.log("[DEBUG] carregarServicosDoFirebase: Já existe um processo em andamento, abortando.");
    return;
  }
  empresaId = getEmpresaIdAtiva();

  if (!empresaId) {
    console.warn("[DEBUG] carregarServicosDoFirebase: empresaId não encontrada, não é possível carregar serviços.");
    if (listaServicosDiv) listaServicosDiv.innerHTML = "<p style=\"color:red;\">Empresa não encontrada.</p>";
    return;
  }
  console.log("[DEBUG] carregarServicosDoFirebase: Carregando serviços para empresaId:", empresaId);
  isProcessing = true;
  try {
    if (listaServicosDiv) listaServicosDiv.innerHTML = "<p>Carregando serviços...</p>";
    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    console.log("[DEBUG] carregarServicosDoFirebase: Buscando documentos da coleção 'servicos' para empresa:", empresaId);
    const snap = await getDocs(servicosCol);
    console.log("[DEBUG] carregarServicosDoFirebase: Documentos de serviços recebidos. Quantidade:", snap.docs.length);
    const servicos = snap.docs.map(doc => {
      const data = doc.data();
      console.log("[DEBUG] carregarServicosDoFirebase: Processando documento de serviço (ID: " + doc.id + "):", data);
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
    console.log("[DEBUG] carregarServicosDoFirebase: Serviços mapeados para renderização:", servicos);
    renderizarServicos(servicos);
  } catch (error) {
    console.error("[DEBUG] carregarServicosDoFirebase: Erro ao carregar serviços do Firebase:", error);
    if (listaServicosDiv) {
      listaServicosDiv.innerHTML = `
        <div style="color:red; text-align: center; padding: 20px;">
          <p>Erro ao carregar os serviços.</p>
          <p style="font-size: 12px; margin-top: 8px;">${error.message || "Erro desconhecido"}</p>
          <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Tentar Novamente
          </button>
        </div>
      `;
    }
  } finally {
    isProcessing = false;
    console.log("[DEBUG] carregarServicosDoFirebase: Carregamento de serviços finalizado.");
  }
}

// --- Excluir Serviço ---
async function excluirServico(servicoId) {
  console.log("[DEBUG] excluirServico: Tentando excluir serviço com ID:", servicoId);
  if (isProcessing) {
    console.log("[DEBUG] excluirServico: Já existe um processo em andamento, abortando exclusão.");
    return;
  }
  if (!servicoId) {
    console.error("[DEBUG] excluirServico: ID do serviço não fornecido.");
    await showAlert("Erro", "ID do serviço não encontrado.");
    return;
  }
  if (!(isDono || isAdmin)) {
    console.warn("[DEBUG] excluirServico: Acesso negado. Usuário não é dono nem admin.");
    await showAlert("Acesso Negado", "Apenas o dono ou admin pode excluir serviços.");
    return;
  }
  isProcessing = true;
  try {
    console.log("[DEBUG] excluirServico: Solicitando confirmação para exclusão do serviço.");
    const confirmado = await showCustomConfirm(
      "Confirmar Exclusão", 
      "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
    );
    if (!confirmado) {
      console.log("[DEBUG] excluirServico: Exclusão cancelada pelo usuário.");
      return;
    }
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    console.log("[DEBUG] excluirServico: Referência do documento a ser excluído:", servicoRef.path);
    await deleteDoc(servicoRef);
    console.log("[DEBUG] excluirServico: Serviço excluído com sucesso do Firebase.");
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
  } catch (error) {
    console.error("[DEBUG] excluirServico: Erro ao excluir o serviço:", error);
    await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${error.message || "Erro desconhecido"}`);
  } finally {
    isProcessing = false;
    console.log("[DEBUG] excluirServico: Processo de exclusão finalizado.");
  }
}

// --- Verificação de Permissão e Identificação (Dono/Admin/Profissional) ---
async function verificarAcessoEmpresa(user, empresaId) {
  console.log("[DEBUG] verificarAcessoEmpresa: Iniciando verificação de acesso para user:", user ? user.uid : "NULO", "e empresaId:", empresaId);
  try {
    if (!user || !empresaId) {
      console.log("[DEBUG] verificarAcessoEmpresa: user ou empresaId nulo. Retornando acesso negado.", {user, empresaId});
      return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null };
    }
    userUid = user.uid;
    console.log("[DEBUG] verificarAcessoEmpresa: UID do usuário atual:", user.uid, "| Empresa ID a verificar:", empresaId);
    
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    let empresasPermitidas = [];
    if (mapaSnap.exists()) {
      empresasPermitidas = Array.isArray(mapaSnap.data().empresas) ? mapaSnap.data().empresas : [];
      console.log("[DEBUG] verificarAcessoEmpresa: Documento mapaUsuarios existe. Empresas permitidas:", empresasPermitidas);
    } else {
      console.log("[DEBUG] verificarAcessoEmpresa: Documento mapaUsuarios NÃO existe para o usuário.");
    }
    
    if (!empresasPermitidas.includes(empresaId)) {
      console.log("[DEBUG] verificarAcessoEmpresa: Usuário NÃO possui permissão para esta empresa (não listada em mapaUsuarios).");
      return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null };
    }
    
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    
    if (!empresaSnap.exists()) {
      console.log("[DEBUG] verificarAcessoEmpresa: Documento da empresa (empresarios/" + empresaId + ") NÃO existe.");
      return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null };
    }
    
    const empresaData = empresaSnap.data();
    empresaDataDebug = empresaData;
    const isOwner = empresaData.donoId === user.uid;
    console.log("[DEBUG] verificarAcessoEmpresa: Dados da empresa:", empresaData);
    console.log("[DEBUG] verificarAcessoEmpresa: donoId da empresa:", empresaData.donoId, "| user.uid:", user.uid, "| isOwner (comparação direta):", isOwner);

    let isProfissional_ = false;
    let ehDonoProfissional = false;
    let profDataDebug = null;
    try {
      const profSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", user.uid));
      if (profSnap.exists()) {
        isProfissional_ = true;
        profDataDebug = profSnap.data();
        ehDonoProfissional = !!profDataDebug.ehDono;
        console.log("[DEBUG] verificarAcessoEmpresa: Profissional encontrado na subcoleção. Dados:", profDataDebug, "| ehDonoProfissional:", ehDonoProfissional);
      } else {
        console.log("[DEBUG] verificarAcessoEmpresa: Usuário NÃO é profissional nesta empresa (não encontrado na subcoleção 'profissionais').");
      }
    } catch (e) {
      console.error("[DEBUG] verificarAcessoEmpresa: Erro ao buscar profissional na subcoleção:", e);
    }
    
    const isDonoFinal = isOwner || ehDonoProfissional;
    // isAdmin é uma variável global definida no onAuthStateChanged
    const hasAccess = isDonoFinal || isProfissional_ || isAdmin;
    
    console.log("[DEBUG] verificarAcessoEmpresa: Resultados Finais de Acesso:", {
      isDonoFinal: isDonoFinal,
      isAdmin: isAdmin,
      isProfissional: isProfissional_,
      hasAccess: hasAccess,
      empresaData: empresaData,
      profDataDebug: profDataDebug
    });
    
    return {
      hasAccess,
      isDono: isDonoFinal || isAdmin, // isDono para UI/lógica de permissão de edição/exclusão
      isProfissional: isProfissional_,
      empresaData,
      profDataDebug
    };
  } catch (e) {
    console.error("[DEBUG] verificarAcessoEmpresa: ERRO GERAL na função verificarAcessoEmpresa:", e);
    return { hasAccess: false, isDono: false, isProfissional: false, empresaData: null, profDataDebug: null };
  }
}

// --- Buscar Empresas do Usuário ---
async function buscarEmpresasDoUsuario(user) {
  console.log("[DEBUG] buscarEmpresasDoUsuario: Iniciando busca por empresas do usuário:", user ? user.uid : "NULO");
  try {
    if (!user) {
      console.log("[DEBUG] buscarEmpresasDoUsuario: Usuário nulo, retornando array vazio.");
      return [];
    }
    const mapaSnap = await getDoc(doc(db, "mapaUsuarios", user.uid));
    const empresas = mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas) 
      ? mapaSnap.data().empresas 
      : [];
    console.log("[DEBUG] buscarEmpresasDoUsuario: Empresas IDs encontradas em mapaUsuarios:", empresas);

    const promessas = empresas.map(async id => {
      console.log("[DEBUG] buscarEmpresasDoUsuario: Buscando dados para empresa ID:", id);
      const empresaSnap = await getDoc(doc(db, "empresarios", id));
      if (empresaSnap.exists()) {
        const empresaData = empresaSnap.data();
        console.log("[DEBUG] buscarEmpresasDoUsuario: Dados da empresa \"" + (empresaData.nome || empresaData.nomeFantasia) + "\" (ID: " + id + "):", empresaData);
        let isProfissional = false, ehDonoProfissional = false;
        try {
          const profSnap = await getDoc(doc(db, "empresarios", id, "profissionais", user.uid));
          if (profSnap.exists()) {
            isProfissional = true;
            ehDonoProfissional = !!profSnap.data().ehDono;
            console.log("[DEBUG] buscarEmpresasDoUsuario: Usuário é profissional nesta empresa. Dados do profissional:", profSnap.data(), "| ehDonoProfissional:", ehDonoProfissional);
          }
        } catch (e) {
          console.warn("[DEBUG] buscarEmpresasDoUsuario: Erro ao verificar se usuário é profissional para empresa \"" + id + "\":", e);
        }
        const isDonoFinal = empresaData.donoId === user.uid || ehDonoProfissional;
        console.log("[DEBUG] buscarEmpresasDoUsuario: Empresa \"" + (empresaData.nome || empresaData.nomeFantasia) + "\" (ID: " + id + ") - isDonoFinal:", isDonoFinal, "| isProfissional:", isProfissional);
        return {
          id,
          nome: empresaData.nome || empresaData.nomeFantasia || "Empresa sem nome",
          isDono: isDonoFinal || isAdmin, // isAdmin é global
          isProfissional
        };
      }
      console.log("[DEBUG] buscarEmpresasDoUsuario: Empresa com ID \"" + id + "\" não existe em 'empresarios'.");
      return null;
    });
    const empresasObjs = await Promise.all(promessas);
    const filteredEmpresas = empresasObjs.filter(Boolean);
    console.log("[DEBUG] buscarEmpresasDoUsuario: Empresas disponíveis para o usuário (filtradas):", filteredEmpresas);
    return filteredEmpresas;
  } catch (e) {
    console.error("[DEBUG] buscarEmpresasDoUsuario: Erro geral ao buscar empresas do usuário:", e);
    return [];
  }
}

// --- Função para mostrar/esconder loader ---
function toggleLoader(show) {
  console.log("[DEBUG] toggleLoader: " + (show ? "Mostrando" : "Escondendo") + " loader.");
  if (loader) loader.style.display = show ? "block" : "none";
  if (appContent) appContent.style.display = show ? "none" : "block";
}

// --- Função para configurar UI baseado nas permissões ---
function configurarUI() {
  console.log("[DEBUG] configurarUI: Configurando UI com base nas permissões. isDono:", isDono, "| isAdmin:", isAdmin, "| isProfissional:", isProfissional);
  if (btnAddServico) {
    btnAddServico.style.display = (isDono || isAdmin) ? "inline-flex" : "none";
    console.log("[DEBUG] configurarUI: Botão 'Adicionar Serviço' display set to:", btnAddServico.style.display);
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  console.log("[DEBUG] setupEventListeners: Configurando listeners de eventos.");
  if (listaServicosDiv) {
    listaServicosDiv.addEventListener("click", async function(e) {
      console.log("[DEBUG] EventListener: Click em listaServicosDiv.");
      if (isProcessing) {
        console.log("[DEBUG] EventListener: Processo em andamento, ignorando click.");
        return;
      }
      const target = e.target.closest(".btn-acao");
      if (!target) {
        console.log("[DEBUG] EventListener: Click não foi em um botão de ação.");
        return;
      }
      const id = target.dataset.id;
      if (!id) {
        console.error("[DEBUG] EventListener: ID do serviço não encontrado no botão de ação.");
        return;
      }
      e.preventDefault(); 
      e.stopPropagation();
      console.log("[DEBUG] EventListener: Botão de ação clicado. ID:", id, "Classes:", target.classList);

      if (target.classList.contains("btn-editar")) {
        console.log("[DEBUG] EventListener: Botão 'Editar' clicado.");
        if (isDono || isAdmin) {
          console.log("[DEBUG] EventListener: Redirecionando para novo-servico.html para edição.");
          window.location.href = `novo-servico.html?id=${encodeURIComponent(id)}`;
        } else {
          console.warn("[DEBUG] EventListener: Acesso negado para edição. Usuário não é dono nem admin.");
          await showAlert("Acesso Negado", "Apenas o dono ou admin pode editar serviços.");
        }
      } else if (target.classList.contains("btn-excluir")) {
        console.log("[DEBUG] EventListener: Botão 'Excluir' clicado.");
        await excluirServico(id);
      }
    });
  }
  if (btnAddServico) {
    btnAddServico.addEventListener("click", async (e) => {
      console.log("[DEBUG] EventListener: Click em btnAddServico.");
      e.preventDefault(); 
      e.stopPropagation();
      if (isProcessing) {
        console.log("[DEBUG] EventListener: Processo em andamento, ignorando click em btnAddServico.");
        return;
      }
      if (isDono || isAdmin) {
        console.log("[DEBUG] EventListener: Redirecionando para novo-servico.html para adicionar novo serviço.");
        window.location.href = "novo-servico.html";
      } else {
        console.warn("[DEBUG] EventListener: Acesso negado para adicionar serviço. Usuário não é dono nem admin.");
        await showAlert("Acesso Negado", "Apenas o dono ou admin pode adicionar serviços.");
      }
    });
  }
  console.log("[DEBUG] setupEventListeners: Listeners de eventos configurados com sucesso.");
}

// --- Ponto de Entrada Principal ---
function initializeApp() {
  console.log("[DEBUG] initializeApp: Iniciando aplicação.");
  // Garante que o DOM esteja completamente carregado antes de inicializar elementos
  if (document.readyState === "loading") {
    console.log("[DEBUG] initializeApp: DOM ainda não carregado, adicionando listener para DOMContentLoaded.");
    document.addEventListener("DOMContentLoaded", initializeApp);
    return;
  }
  
  initializeDOMElements();
  setupEventListeners();
  
  onAuthStateChanged(auth, async (user) => {
    console.log("[DEBUG] onAuthStateChanged: Estado de autenticação alterado. Usuário:", user ? user.uid : "NULO");
    
    // Remove o loop while(!user) para evitar bloqueio e confia no onAuthStateChanged para ser chamado novamente com o user
    if (!user) {
      console.log("[DEBUG] onAuthStateChanged: Usuário nulo. Aguardando próximo evento de autenticação.");
      toggleLoader(true); // Mantém o loader visível enquanto espera o usuário
      return; 
    }

    if (isInitialized) {
      console.log("[DEBUG] onAuthStateChanged: Aplicação já inicializada, ignorando.");
      return;
    }
    
    console.log("[DEBUG] onAuthStateChanged: Usuário autenticado. UID:", user.uid);
    userUid = user.uid;
    const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // UID do administrador fixo
    isAdmin = (user.uid === ADMIN_UID);
    console.log("[DEBUG] onAuthStateChanged: isAdmin (comparação com ADMIN_UID):", isAdmin);

    toggleLoader(true);
    const empresaIdSalva = getEmpresaIdAtiva();
    console.log("[DEBUG] onAuthStateChanged: Empresa ID salva no localStorage:", empresaIdSalva);

    if (empresaIdSalva) {
      console.log("[DEBUG] onAuthStateChanged: Empresa ID salva encontrada. Verificando acesso...");
      const verificacao = await verificarAcessoEmpresa(user, empresaIdSalva);
      isDono = verificacao.isDono;
      isProfissional = verificacao.isProfissional;
      empresaDataDebug = verificacao.empresaData;
      console.log("[DEBUG] onAuthStateChanged: Resultado da verificação de acesso para empresa ativa:\n", 
        "  Empresa ID:", empresaIdSalva, "\n",
        "  isDono:", isDono, "\n", 
        "  isAdmin:", isAdmin, "\n", 
        "  isProfissional:", isProfissional, "\n", 
        "  user.uid:", user.uid, "\n", 
        "  empresaData (dados completos da empresa):", verificacao.empresaData, "\n", 
        "  profDataDebug (dados do profissional, se aplicável):", verificacao.profDataDebug
      );
      if (verificacao.hasAccess) {
        console.log("[DEBUG] onAuthStateChanged: Usuário TEM acesso à empresa salva. Carregando serviços.");
        empresaId = empresaIdSalva;
        configurarUI();
        await carregarServicosDoFirebase();
        isInitialized = true;
        toggleLoader(false);
        return;
      } else {
        console.warn("[DEBUG] onAuthStateChanged: Usuário NÃO TEM acesso à empresa salva. Removendo empresa ativa do localStorage.");
        setEmpresaIdAtiva(null);
      }
    }
    
    console.log("[DEBUG] onAuthStateChanged: Buscando empresas disponíveis para o usuário.");
    const empresasDisponiveis = await buscarEmpresasDoUsuario(user);
    console.log("[DEBUG] onAuthStateChanged: Empresas disponíveis encontradas:", empresasDisponiveis);

    if (empresasDisponiveis.length === 0) {
      console.warn("[DEBUG] onAuthStateChanged: Nenhuma empresa disponível para o usuário.");
      if (loader) {
        loader.innerHTML = `
          <div style="color:red; text-align: center; padding: 20px;">
            <p>Você não tem acesso a nenhuma empresa.</p>
            <p>Entre em contato com o administrador.</p>
          </div>
        `;
      }
      toggleLoader(false);
      isInitialized = true;
      return;
    } else if (empresasDisponiveis.length === 1) {
      const empresa = empresasDisponiveis[0];
      empresaId = empresa.id;
      isDono = empresa.isDono;
      isProfissional = empresa.isProfissional;
      setEmpresaIdAtiva(empresaId);
      console.log("[DEBUG] onAuthStateChanged: Apenas uma empresa disponível. Definindo como ativa.\n", 
        "  Empresa ID:", empresaId, "\n", 
        "  isDono:", isDono, "\n", 
        "  isAdmin:", isAdmin, "\n", 
        "  isProfissional:", isProfissional, "\n", 
        "  user.uid:", user.uid
      );
      configurarUI();
      await carregarServicosDoFirebase();
      isInitialized = true;
      toggleLoader(false);
    } else {
      console.log("[DEBUG] onAuthStateChanged: Múltiplas empresas disponíveis. Redirecionando para seleção de empresa.");
      window.location.href = "selecionar-empresa.html";
      isInitialized = true;
      toggleLoader(false);
      return;
    }
  }, (error) => {
    console.error("[DEBUG] onAuthStateChanged: Erro de autenticação do Firebase:", error);
    if (loader) {
      loader.innerHTML = `
        <div style="color:red; text-align: center; padding: 20px;">
          <p>Erro de autenticação.</p>
          <button onclick="window.location.href=\'login.html\'" style="margin-top: 10px; padding: 8px 16px; background: #4facfe; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Ir para Login
          </button>
        </div>
      `;
    }
    toggleLoader(false);
    isInitialized = true;
  });
  console.log("[DEBUG] initializeApp: Função initializeApp concluída.");
}

// Inicia a aplicação quando o script é carregado
initializeApp();

