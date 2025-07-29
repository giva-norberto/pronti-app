// Conteúdo do arquivo app.js

// Esta função carrega o menu e o insere na página
async function carregarMenu() {
    // 1. Encontra o local na página onde o menu deve ser inserido.
    const placeholder = document.getElementById('menu-placeholder');
    if (!placeholder) {
        console.error("Placeholder do menu não encontrado!");
        return;
    }

    try {
        // 2. Busca o conteúdo do arquivo menu.html
        const response = await fetch('menu.html');
        if (!response.ok) {
            throw new Error(`Erro ao carregar menu.html: ${response.statusText}`);
        }
        const menuHTML = await response.text();

        // 3. Coloca o HTML do menu dentro do placeholder
        placeholder.innerHTML = menuHTML;

        // 4. Lógica para marcar o link da página atual como "ativo"
        const paginaAtual = window.location.pathname.split('/').pop();
        if (paginaAtual) {
            const linkAtivo = document.querySelector(`.sidebar-links a[href="${paginaAtual}"]`);
            if (linkAtivo) {
                // Remove a classe 'active' de qualquer outro link que a tenha
                document.querySelectorAll('.sidebar-links a.active').forEach(link => link.classList.remove('active'));
                // Adiciona a classe 'active' ao link correto
                linkAtivo.classList.add('active');
            }
        }
    } catch (error) {
        console.error("Não foi possível carregar o menu:", error);
        placeholder.innerHTML = "<p style='color:red; padding: 20px;'>Erro ao carregar o menu.</p>";
    }
}

// Executa a função assim que o conteúdo da página estiver pronto
document.addEventListener('DOMContentLoaded', carregarMenu);
