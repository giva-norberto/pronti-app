// PEGUE O PERFIL DO USUÁRIO (ex: 'admin', 'funcionario', 'cliente', etc)
const perfil = localStorage.getItem('perfil');

// PERMISSÕES DOS MENUS
if (perfil !== 'admin') {
  // Só admin vê Administração e Permissões
  document.querySelector('[data-menu-id="administracao"]')?.classList.add('hidden');
  document.querySelector('[data-menu-id="permissoes"]')?.classList.add('hidden');
}
if (perfil !== 'admin' && perfil !== 'funcionario') {
  // Só admin e funcionario veem Relatórios
  document.querySelector('[data-menu-id="relatorios"]')?.classList.add('hidden');
}

// Você pode adicionar mais regras conforme quiser
// Exemplo: se cliente, esconde serviços
if (perfil === 'cliente') {
  document.querySelector('[data-menu-id="servicos"]')?.classList.add('hidden');
}

// MARCA O MENU ATIVO (baseado na URL atual)
const urlAtual = window.location.pathname.split('/').pop();
document.querySelectorAll('.sidebar-links a').forEach(link => {
  if (link.getAttribute('href') === urlAtual) {
    link.classList.add('active');
  }
});

// BOTÃO SAIR
document.getElementById("btn-logout")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

// CSS OPCIONAL para esconder menus (adicione ao menu-lateral.html, se ainda não tiver)
const style = document.createElement('style');
style.innerHTML = `
  .hidden { display: none !important; }
`;
document.head.appendChild(style);
