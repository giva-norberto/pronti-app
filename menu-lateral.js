import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// Configuração direta de permissões
const PERMISSOES = {
  inicio:      { funcionario: true, dono: true, admin: true },
  dashboard:   { funcionario: false, dono: true, admin: true },
  agenda:      { funcionario: true, dono: true, admin: true },
  equipe:      { funcionario: true, dono: true, admin: true },
  servicos:    { funcionario: false, dono: true, admin: true },
  clientes:    { funcionario: false, dono: true, admin: true },
  perfil:      { funcionario: false, dono: true, admin: true },
  relatorios:  { funcionario: false, dono: true, admin: true },
  administracao:{ funcionario: false, dono: false, admin: true },
  permissoes:  { funcionario: false, dono: false, admin: true }
};

document.addEventListener("DOMContentLoaded", () => {
  // --- BOTÃO SAIR ---
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "login.html";
      } catch (err) {
        console.error("Erro ao sair:", err);
        alert("Erro ao sair, tente novamente.");
      }
    });
  }

  // --- CONTROLE DE MENUS E CARDS ---
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    let userRole = "funcionario";
    if (user.uid === ADMIN_UID) userRole = "admin";
    // Aqui você pode adicionar lógica para dono se quiser

    // Menus
    document.querySelectorAll("[data-menu-id]").forEach(menu => {
      const menuId = menu.dataset.menuId;
      const acesso = PERMISSOES[menuId]?.[userRole] ?? true;
      menu.style.display = acesso ? "" : "none";
    });

    // Cards
    document.querySelectorAll(".card-acesso").forEach(card => {
      const cardMenu = card.dataset.menu;
      const acesso = PERMISSOES[cardMenu]?.[userRole] ?? true;
      card.style.display = acesso ? "" : "none";
    });
  });
});
