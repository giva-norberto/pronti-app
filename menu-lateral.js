// Certifique-se de incluir no HTML assim:
// <script type="module" src="./menu-lateral.js"></script>

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Defina o papel do usuário; ajuste conforme sua lógica real
  const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
  let userRole = "funcionario";
  if (user.uid === ADMIN_UID) userRole = "admin";
  // Aqui você pode adicionar lógica para "dono" se tiver

  // Pega todos os itens do menu
  const menus = document.querySelectorAll("[data-menu-id]");
  const cards = document.querySelectorAll(".card-acesso");

  // Carrega permissões globais do Firestore
  const snap = await getDoc(doc(db, "configuracoesGlobais", "permissoes"));
  const permissoesGlobais = snap.exists() ? snap.data() : {};

  // Função para mostrar/ocultar menus
  menus.forEach(menu => {
    const menuId = menu.dataset.menuId;
    const acesso = permissoesGlobais[menuId]?.[userRole] ?? true;
    menu.style.display = acesso ? "block" : "none";
  });

  // Função para mostrar/ocultar cards
  cards.forEach(card => {
    const cardMenu = card.dataset.menu;
    const acesso = permissoesGlobais[cardMenu]?.[userRole] ?? true;
    card.style.display = acesso ? "block" : "none";
  });

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => auth.signOut().then(() => window.location.href = "login.html"));
  }
});
