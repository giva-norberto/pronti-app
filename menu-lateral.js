// Exemplo: controle de permissões do menu lateral

// 1. Pegue o perfil do usuário do localStorage
const perfil = localStorage.getItem('perfil');

// 2. Esconda/mostre itens conforme perfil
if (perfil !== 'admin') {
  // Esconde Administração e Permissões para quem NÃO é admin
  const adminItem = document.querySelector('[data-menu-id="administracao"]');
  const permissoesItem = document.querySelector('[data-menu-id="permissoes"]');
  if (adminItem) adminItem.style.display = 'none';
  if (permissoesItem) permissoesItem.style.display = 'none';
}

// Exemplo: funcionário não vê relatórios
if (perfil === 'funcionario') {
  const relatoriosItem = document.querySelector('[data-menu-id="relatorios"]');
  if (relatoriosItem) relatoriosItem.style.display = 'none';
}

// 3. Botão sair
document.getElementById("btn-logout")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
});
