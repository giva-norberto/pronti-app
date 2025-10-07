// ======================================================================
// menu.js (REVISADO PARA GARANTIR O FUNCIONAMENTO DO BOTÃO 'SAIR')
// Gerencia o menu lateral, logout e permissões
// ======================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { verificarAcesso } from './userService.js';

/**
 * Esta é a função principal que as suas páginas devem chamar.
 * Ela foi dividida em duas partes para garantir que o botão 'Sair'
 * e o link ativo funcionem imediatamente, antes de qualquer verificação assíncrona.
 */
export async function ativarMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.warn("Elemento #sidebar não encontrado. A inicialização do menu foi cancelada.");
        return;
    }

    // --- PASSO 1: CONFIGURAÇÃO IMEDIATA (SÍNCRONA) ---
    // Esta parte do código é executada instantaneamente, sem esperas.
    // Isso garante que o botão 'Sair' e o link ativo SEMPRE funcionem,
    // mesmo que a verificação de acesso posterior cause um redirecionamento.
    
    // --- BOTÃO SAIR ---
    const btnLogout = sidebar.querySelector('#btn-logout');
    if (btnLogout && !btnLogout.dataset.listenerAttached) {
        btnLogout.dataset.listenerAttached = 'true'; // Previne múltiplos listeners
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                localStorage.clear();
                sessionStorage.clear(); // Garante que a sessão seja limpa também
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Erro ao fazer logout:", error);
                alert('Erro ao sair da conta.');
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
    // já foi configurado e estará funcional no breve momento em que a página é visível.
    
    try {
        const sessao = await verificarAcesso();
        
        // Se a sessão for inválida, 'verificarAcesso' já terá redirecionado a página.
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
            
            // Lógica para Admin (se um dia precisar)
            // if (papel === 'admin') {
            //     link.style.display = ''; // Garante que o admin vê tudo
            // }
        });
    } catch(e) {
        // O erro de redirecionamento do verificarAcesso será capturado aqui,
        // mas a página já estará a ser redirecionada. O importante é que não quebra a execução.
        console.warn('Acesso negado ou erro ao aplicar permissões do menu:', e.message);
    }
}
