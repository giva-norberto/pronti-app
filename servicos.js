// ======================================================================
// ARQUIVO: servicos.js (VERSÃO RESUMIDA PARA TESTE)
// ======================================================================

import {
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 

// --- DOM ---
const listaServicosDiv = document.getElementById('lista-servicos');

// --- Helpers ---
function getEmpresaIdAtiva() {
  return localStorage.getItem("empresaAtivaId");
}

function renderizarServicos(servicos) {
  if (!listaServicosDiv) return;
  if (!servicos.length) {
    listaServicosDiv.innerHTML = "<p>Nenhum serviço cadastrado.</p>";
    return;
  }
  listaServicosDiv.innerHTML = servicos.map(s => `
    <div>
      <strong>${s.nome || "Sem nome"}</strong> - ${s.duracao || 0}min - R$${s.preco || 0}
    </div>
  `).join("");
}

async function carregarServicos(empresaId) {
  try {
    listaServicosDiv.innerHTML = "<p>Carregando...</p>";
    const snap = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    const servicos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarServicos(servicos);
  } catch (err) {
    console.error("Erro ao carregar serviços:", err);
    listaServicosDiv.innerHTML = "<p style='color:red;'>Erro ao carregar serviços</p>";
  }
}

// --- Inicialização ---
onAuthStateChanged(auth, async (user) => {
  console.log("onAuthStateChanged:", user?.uid || "sem user");

  if (!user) {
    // NÃO redireciona de imediato, só avisa
    listaServicosDiv.innerHTML = "<p style='color:red;'>Usuário não autenticado</p>";
    return;
  }

  const empresaId = getEmpresaIdAtiva();
  console.log("empresaId localStorage:", empresaId);

  if (!empresaId) {
    listaServicosDiv.innerHTML = "<p style='color:red;'>Nenhuma empresa selecionada</p>";
    return;
  }

  await carregarServicos(empresaId);
});
