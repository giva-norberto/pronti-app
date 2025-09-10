// menu-lateral.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// 🔥 Garante que só roda depois que o DOM está pronto
document.addEventListener("DOMContentLoaded", () => {
  // --- BOTÃO SAIR ---
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "login.html";
      } catch (err) {
        console.error("Erro ao sair:", err);
        alert("Erro ao sair, tente novamente.");
      }
    });
  }

  // --- CONTROLE DE MENUS E CARDS ---
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    let userRole = "funcionario";
    if (user.uid === ADMIN_UID) userRole = "admin";
    // 👉 Aqui depois você pode colocar lógica para dono

    const menus = document.querySelectorAll("[data-menu-id]");
    const cards = document.querySelectorAll(".card-acesso");

    // Carrega permissões globais do Firestore
    const snap = await getDoc(doc(db, "configuracoesGlobais", "permissoes"));
    const permissoesGlobais = snap.exists() ? snap.data() : {};

    // --- MENUS ---
    menus.forEach(menu => {
      const menuId = menu.dataset.menuId;
      const acesso = permissoesGlobais[menuId]?.[userRole] ?? true;
      menu.style.display = acesso ? "" : "none"; // "" = mostra normal
    });

    // --- CARDS ---
    cards.forEach(card => {
      const cardMenu = card.dataset.menu;
      const acesso = permissoesGlobais[cardMenu]?.[userRole] ?? true;
      card.style.display = acesso ? "" : "none"; // "" = mostra normal
    });
  });
});
