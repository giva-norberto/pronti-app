// Conteúdo do arquivo: menu-loader.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// A configuração do Firebase fica aqui dentro para simplificar
const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e5df3"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Função que carrega o menu e o insere na página
async function carregarMenu() {
    const placeholder = document.getElementById('menu-placeholder');
    if (!placeholder) return;
    try {
        const response = await fetch('menu.html');
        if (!response.ok) throw new Error('menu.html não encontrado');
        const menuHTML = await response.text();
        placeholder.innerHTML = menuHTML;
        marcarLinkAtivo();
    } catch (error) {
        console.error("Não foi possível carregar o menu:", error);
    }
}

// Marca o link da página atual como "ativo"
function marcarLinkAtivo() {
    const paginaAtual = window.location.pathname.split('/').pop();
    if (paginaAtual) {
        const linkAtivo = document.querySelector(`.sidebar-links a[href="${paginaAtual}"]`);
        if (linkAtivo) {
            linkAtivo.classList.add('active');
        }
    }
}

// Atualiza o link da vitrine com o slug do usuário logado
async function atualizarLinkVitrine(uid) {
    const linkVitrine = document.getElementById('link-minha-vitrine');
    if (!linkVitrine) return;
    try {
        const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
        const docSnap = await getDoc(perfilRef);
        if (docSnap.exists() && docSnap.data().slug) {
            const slug = docSnap.data().slug;
            linkVitrine.href = `vitrine.html?slug=${slug}`;
        } else {
            linkVitrine.href = 'perfil.html';
            linkVitrine.title = 'Configure seu slug na página de perfil para ativar a vitrine';
        }
    } catch (error) {
        console.error("Erro ao buscar slug para link da vitrine:", error);
    }
}

// Ponto de entrada do script
document.addEventListener('DOMContentLoaded', async () => {
    await carregarMenu();
    onAuthStateChanged(auth, (user) => {
        if (user) {
            atualizarLinkVitrine(user.uid);
        }
    });
});
