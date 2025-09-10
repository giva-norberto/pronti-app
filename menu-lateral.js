// Adiciona a classe .hidden ao head se não existir (para esconder itens por permissão)
(function() {
  if (!document.querySelector('style[data-permissao]')) {
    const style = document.createElement('style');
    style.setAttribute('data-permissao', 'true');
    style.innerHTML = `.hidden { display: none !important; }`;
    document.head.appendChild(style);
  }
})();

// Pega o perfil do usuário do localStorage (ajuste conforme seu sistema)
const perfil = localStorage.getItem('perfil'); // Exemplo: 'admin', 'funcionario', 'cliente'

// Esconde/mostra itens do menu conforme o perfil
if (perfil !== 'admin') {
  document.querySelector('[data-menu-id="administracao"]')?.classList.add('hidden');
  document.querySelector('[data-menu-id="permissoes"]')?.classList.add('hidden');
}
if (perfil !== 'admin' && perfil !== 'funcionario') {
  document.querySelector('[data-menu-id="relatorios"]')?.classList.add('hidden');
}
// Exemplo extra: cliente não pode ver serviços
if (perfil === 'cliente') {
  document.querySelector('[data-menu-id="servicos"]')?.classList.add('hidden');
}

// Marca como ativo o menu da página atual (baseado na URL)
const urlAtual = window.location.pathname.split('/').pop();
document.querySelectorAll('.sidebar-links a').forEach(link => {
  if (link.getAttribute('href') === urlAtual) {
    link.classList.add('active');
  }
});

// Botão sair: limpa localStorage e redireciona para login
document.getElementById("btn-logout")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});
