// ======================================================================
// menu-lateral.js (REVISADO PARA GARANTIR O FUNCIONAMENTO DO BOTÃO 'SAIR')
// ======================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from './userService.js';

/**
 * Esta é a função principal que as suas páginas devem chamar.
 * Ela foi dividida em duas partes para garantir que o botão 'Sair'
 * e o link ativo funcionem imediatamente, antes de qualquer verificação.
 */
export async function ativarMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // --- PASSO 1: CONFIGURAÇÃO IMEDIATA (SÍNCRONA) ---
    // Esta parte do código é executada instantaneamente, sem esperas.
    // Isso garante que o botão 'Sair' e o link ativo SEMPRE funcionem.
    
    // --- BOTÃO SAIR ---
    const btnLogout = sidebar.querySelector('#btn-logout');
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true';
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                localStorage.clear();
                window.location.href = 'login.html';
            } catch {
                alert('Erro ao sair');
            }
        });
    }

    // --- DESTAQUE DA PÁGINA ATUAL ---
    const links = sidebar.querySelectorAll('.sidebar-links a');
    const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    links.forEach(link => {
        link.classList.remove('active'); // Garante que a classe é removida antes de adicionar
        const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });


    // --- PASSO 2: APLICAÇÃO DE PERMISSÕES (ASSÍNCRONA) ---
    // Esta parte, que pode causar redirecionamentos, é executada por último.
    // Mesmo que 'verificarAcesso' redirecione a página, o botão 'Sair'
    // já foi configurado e funcionará.
    
    try {
        const sessao = await verificarAcesso();
        
        // Se a sessão for inválida, 'verificarAcesso' já terá redirecionado.
        // Se o código continuar, significa que o acesso foi validado.
        const papel = sessao.papel || (sessao.isOwner ? 'dono' : 'indefinido');

        links.forEach(link => {
            const menuId = link.dataset.menuId;
            if (!menuId) return;

            // Sua lógica de permissões original - 100% MANTIDA
            // Funcionario: só vê menus gerais
            if (papel === 'funcionario' && ['servicos','clientes','perfil','relatorios','administracao','permissoes', 'planos'].includes(menuId)) {
                link.style.display = 'none';
            }

            // Dono: não vê menus admin
            if (papel === 'dono' && ['administracao','permissoes'].includes(menuId)) {
                link.style.display = 'none';
            }
            
            // (O seu código original não tem esta condição, mas ela pode ser útil)
            // if (papel === 'admin') {
            //     link.style.display = '';
            // }
        });
    } catch(e) {
        // O erro de redirecionamento do verificarAcesso será capturado aqui,
        // mas a página já estará a ser redirecionada. O importante é que não quebra a execução.
        console.error('Acesso negado ou erro ao aplicar permissões do menu:', e.message);
    }
}
