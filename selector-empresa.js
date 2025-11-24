// selector-empresa.js
// Este arquivo deve ser importado ANTES de carregar a vitrine.
// Ele determina qual layout deve ser carregado com base no tipo de empresa
// e redireciona para a vitrine correta sem alterar seus arquivos originais.

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

(async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const empresaId = params.get("empresa");

    if (!empresaId) {
      console.error("Nenhum ID de empresa foi fornecido na URL.");
      return;
    }

    const ref = doc(db, "empresarios", empresaId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.error("Empresa não encontrada no Firestore.");
      return;
    }

    const data = snap.data();
    const tipo = data.tipo || "padrao";

    // Escolher tela correta
    if (tipo === "pet") {
      window.location.href = `vitrine-pet.html?empresa=${empresaId}`;
    } else {
      window.location.href = `vitrine.html?empresa=${empresaId}`;
    }
  } catch (err) {
    console.error("Erro ao selecionar layout da empresa:", err);
  }
})();
