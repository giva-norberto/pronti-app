// Conteúdo do arquivo app.js (versão com link dinâmico da vitrine)

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Esta função carrega o menu e o insere na página
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

        // Lógica para marcar o link da página atual como "ativo"
        marcarLinkAtivo();

    } catch (error) {
        console.error("Não foi possível carregar o menu:", error);
        placeholder.innerHTML = "<p style='color:red; padding: 20px;'>Erro ao carregar o menu.</p>";
    }
}

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

// --- NOVA FUNÇÃO PARA ATUALIZAR O LINK DA VITRINE ---
async function atualizarLinkVitrine(uid) {
    const linkVitrine = document.getElementById('link-minha-vitrine');
    if (!linkVitrine) return;

    try {
        // Busca o documento de perfil público para encontrar o slug
        const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
        const docSnap = await getDoc(perfilRef);

        if (docSnap.exists() && docSnap.data().slug) {
            const slug = docSnap.data().slug;
            // Monta o link correto com o slug do empresário
            linkVitrine.href = `vitrine.html?slug=${slug}`;
        } else {
            // Caso não encontre o slug, o link não levará a lugar nenhum para evitar erros
            linkVitrine.href = '#';
            linkVitrine.title = 'Slug não configurado no perfil';
            console.warn("Slug do profissional não encontrado no perfil.");
        }
    } catch (error) {
        console.error("Erro ao buscar slug para o link da vitrine:", error);
        linkVitrine.href = '#';
    }
}

// --- LÓGICA DE INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega o menu primeiro para que a página não fique sem ele
    await carregarMenu();
    
    // Depois, verifica a autenticação para atualizar o link da vitrine
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Se o usuário está logado, atualiza o link da vitrine com o slug dele
            atualizarLinkVitrine(user.uid);
        }
    });
});
