// <script type="module" src="./menu-lateral.js"></script>

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

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
  // TODO: adicione lógica para "dono" se precisar

  const menus = document.querySelectorAll("[data-menu-id]");
  const cards = document.querySelectorAll(".card-acesso");

  // Carrega permissões globais
  const snap = await getDoc(doc(db, "configuracoesGlobais", "permissoes"));
  const permissoesGlobais = snap.exists() ? snap.data() : {};

  // --- MENUS ---
  menus.forEach(menu => {
    const menuId = menu.dataset.menuId; // << pega do HTML
    const acesso = permissoesGlobais[menuId]?.[userRole] ?? true;
    menu.style.display = acesso ? "list-item" : "none"; // "list-item" porque é <li>
  });

  // --- CARDS ---
  cards.forEach(card => {
    const cardMenu = card.dataset.menu; // << pega do HTML dos cards
    const acesso = permissoesGlobais[cardMenu]?.[userRole] ?? true;
    card.style.display = acesso ? "block" : "none";
  });
});
