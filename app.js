// app.js (Versão Corrigida)

// Importa as funções que VAMOS USAR, e o 'auth' e 'db' que JÁ FORAM CRIADOS
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app, db, auth } from "./firebase-config.js"; // <-- AQUI ESTÁ A CORREÇÃO

// Função que carrega o menu e o insere na página
async function carregarMenu() {
    const placeholder = document.getElementById('menu-placeholder');
    if (!placeholder) {
        console.error("Placeholder do menu não encontrado!");
        return;
    }

    try {
        const response = await fetch('menu.html');
        if (!response.ok) {
            throw new Error(`Erro ao carregar menu.html: ${response.statusText}`);
        }
        const menuHTML = await response.text();
        placeholder.innerHTML = menuHTML;
        marcarLinkAtivo();
    } catch (error) {
        console.error("Não foi possível carregar o menu:", error);
        placeholder.innerHTML = "<p style='color:red; padding: 20px;'>Erro ao carregar o menu.</p>";
    }
}

// Marca o link da página atual como "ativo"
function marcarLinkAtivo() {
    const paginaAtual = window.location.pathname.split('/').pop();
    if (paginaAtual) {
        const linkAtivo = document.querySelector(`.sidebar-links a[href="${paginaAtual}"]`);
        if (linkAtivo) {
            document.querySelectorAll('.sidebar-links a.active').forEach(link => link.classList.remove('active'));
            linkAtivo.classList.add('active');
        }
    }
}

// Atualiza o link da vitrine com o slug do usuário logado
async function atualizarLinkVitrine(uid) {
    const linkVitrine = document.getElementById('link-minha-vitrine');
    if (!linkVitrine) return;

    try {
        // Usa o 'db' importado para criar a referência
        const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
        const docSnap = await getDoc(perfilRef);

        if (docSnap.exists() && docSnap.data().slug) {
            const slug = docSnap.data().slug;
            linkVitrine.href = `vitrine.html?slug=${slug}`;
        } else {
            linkVitrine.href = 'perfil.html';
            linkVitrine.title = 'Configure seu slug na página de perfil para ativar a vitrine';
            console.warn("Slug do profissional não encontrado no perfil.");
        }
    } catch (error) {
        console.error("Erro ao buscar slug para o link da vitrine:", error);
        linkVitrine.href = '#';
    }
}

// Ponto de entrada do script
document.addEventListener('DOMContentLoaded', async () => {
    await carregarMenu();
    
    // Usa o 'auth' importado para verificar o login
    onAuthStateChanged(auth, (user) => {
        if (user) {
            atualizarLinkVitrine(user.uid);
        }
    });
});
