// Lê permissões de menu do localStorage
const permissoes = JSON.parse(localStorage.getItem('menuPermissoes') || '{}');

// Para cada item do menu, esconde se não tiver permissão
Object.keys(permissoes).forEach(menuId => {
  if (!permissoes[menuId]) {
    document.querySelector(`[data-menu-id="${menuId}"]`)?.classList.add('hidden');
  }
});

// Marca ativo
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

// Garante .hidden no CSS (adicione ao seu menu-lateral.html se não tiver)
if (!document.querySelector('style[data-permissao]')) {
  const style = document.createElement('style');
  style.setAttribute('data-permissao', 'true');
  style.innerHTML = `.hidden { display: none !important; }`;
  document.head.appendChild(style);
}
