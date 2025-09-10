// Firebase v9 modular imports (ajuste o caminho do seu config e inicialização se precisar)
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Inicialize seu Firebase se ainda não estiver feito no projeto!
const firebaseConfig = {
  // ...suas credenciais/config do Firebase...
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Pegue o perfil do usuário do localStorage (ex: "admin", "dono", "funcionario")
const perfil = localStorage.getItem('perfil'); // <--- já deve estar salvo após login

// Esconde/exibe os menus conforme as permissões globais do Firestore
async function aplicarPermissoesGlobaisMenu() {
  const docRef = doc(db, "configuracoesGlobais", "permissoes");
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    alert("Permissões globais de menu não configuradas!");
    return;
  }
  const permissoes = docSnap.data();

  // Para cada item do menu, verifica se o papel tem permissão
  Object.keys(permissoes).forEach(menuId => {
    const podeVer = permissoes[menuId]?.[perfil];
    if (!podeVer) {
      document.querySelector(`[data-menu-id="${menuId}"]`)?.classList.add("hidden");
    }
  });
}

// Garante a classe .hidden para esconder menus
(function() {
  if (!document.querySelector('style[data-permissao]')) {
    const style = document.createElement('style');
    style.setAttribute('data-permissao', 'true');
    style.innerHTML = `.hidden { display: none !important; }`;
    document.head.appendChild(style);
  }
})();

// Marca o menu ativo baseado na URL
const urlAtual = window.location.pathname.split('/').pop();
document.querySelectorAll('.sidebar-links a').forEach(link => {
  if (link.getAttribute('href') === urlAtual) {
    link.classList.add('active');
  }
});

// Botão sair
document.getElementById("btn-logout")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

// Execute isso DEPOIS do menu estar no DOM (após o fetch do menu-lateral.html)
aplicarPermissoesGlobaisMenu();
