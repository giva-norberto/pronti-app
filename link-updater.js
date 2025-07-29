// Conteúdo do arquivo: link-updater.js

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Função que busca o slug e atualiza o link da vitrine
async function atualizarLinkVitrine(uid) {
    // Procura pelo link com o ID específico
    const linkVitrine = document.getElementById('link-minha-vitrine');
    if (!linkVitrine) {
        console.log("Link da vitrine não encontrado na página.");
        return; // Sai da função se o link não existir
    }

    try {
        const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
        const docSnap = await getDoc(perfilRef);

        if (docSnap.exists() && docSnap.data().slug) {
            const slug = docSnap.data().slug;
            // Monta o link final e correto
            linkVitrine.href = `vitrine.html?slug=${slug}`;
        } else {
            // Se não encontrar o slug, o link leva para a página de perfil para configurá-lo
            linkVitrine.href = 'perfil.html';
            linkVitrine.title = 'Configure seu slug na página de perfil para ativar a vitrine';
        }
    } catch (error) {
        console.error("Erro ao buscar slug para o link da vitrine:", error);
    }
}

// Escuta o status do login do usuário
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário estiver logado, chama a função para corrigir o link
        atualizarLinkVitrine(user.uid);
    }
});
