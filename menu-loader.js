import { verificarAcesso } from './userservice.js';

document.addEventListener("DOMContentLoaded", async function () {
  let sidebarHTML = '';
  try {
    const acesso = await verificarAcesso();

    if (acesso.isOwner) {
      // MENU DO DONO
      sidebarHTML = `
      <aside class="sidebar" id="sidebar">
        <a href="dashboard.html" class="sidebar-brand">Pronti</a>
        <hr />
        <nav class="sidebar-links">
          <a href="dashboard.html"><span>🏠</span> Início</a>
          <a href="agenda.html"><span>📅</span> Agenda</a>
          <a href="servicos.html"><span>🛎️</span> Serviços</a>
          <a href="profissionais.html"><span>👥</span> Equipe</a>
          <a href="clientes.html"><span>👤</span> Clientes</a>
          <a href="configuracoes.html"><span>⚙️</span> Configurações</a>
        </nav>
        <div class="sidebar-footer">
          <button id="btn-logout" class="btn-logout">Sair</button>
        </div>
      </aside>
      `;
    } else {
      // MENU DO FUNCIONÁRIO
      sidebarHTML = `
      <aside class="sidebar" id="sidebar">
        <a href="index.html" class="sidebar-brand">Pronti</a>
        <hr />
        <nav class="sidebar-links">
          <a href="agenda.html"><span>📅</span> Agenda</a>
          <a href="perfil.html"><span>🙍‍♂️</span> Meu Perfil</a>
        </nav>
        <div class="sidebar-footer">
          <button id="btn-logout" class="btn-logout">Sair</button>
        </div>
      </aside>
      `;
    }

    // Insere menu no topo do body
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // Ativa link atual
    const links = document.querySelectorAll('.sidebar-links a');
    const current = window.location.pathname.split('/').pop().toLowerCase();
    links.forEach(link => {
      let href = link.getAttribute('href').split('?')[0].toLowerCase();
      if (href === current || (href === 'index.html' && (current === '' || current === 'index.html'))) {
        link.classList.add('active');
      }
    });

    // Logout handler
    document.getElementById('btn-logout').onclick = function () {
      localStorage.clear();
      sessionStorage.clear();
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js').then(({ getAuth, signOut }) => {
        signOut(getAuth()).then(() => window.location.href = "login.html");
      });
    };

  } catch (err) {
    // Não mostra menu se não autenticado
    console.warn('Sidebar não carregada:', err);
  }
});
