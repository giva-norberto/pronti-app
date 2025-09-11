// Pegue o perfil do usuário do localStorage
const perfil = localStorage.getItem('perfil'); // "admin", "dono", "funcionario"

function aplicarPermissoesGlobaisMenu() {
  firebase.firestore().collection("configuracoesGlobais").doc("permissoes")
    .get()
    .then(doc => {
      if (!doc.exists) {
        alert("Permissões globais de menu não configuradas!");
        return;
      }
      const permissoes = doc.data();
      Object.keys(permissoes).forEach(menuId => {
        const podeVer = permissoes[menuId]?.[perfil];
        if (!podeVer) {
          document.querySelector(`[data-menu-id="${menuId}"]`)?.classList.add("hidden");
        }
      });
    });
}

// Garante .hidden no CSS (caso não tenha)
(function() {
  if (!document.querySelector('style[data-permissao]')) {
    const style = document.createElement('style');
    style.setAttribute('data-permissao', 'true');
    style.innerHTML = `.hidden { display: none !important; }`;
    document.head.appendChild(style);
  }
})();

// Marca ativo
const urlAtual = window.location.pathname.split('/').pop();
document.querySelectorAll('.sidebar-links a').forEach(link => {
  if (link.getAttribute('href') === urlAtual) link.classList.add('active');
});

// Botão sair
document.getElementById("btn-logout")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

// Execute depois do menu estar no DOM!
aplicarPermissoesGlobaisMenu();
