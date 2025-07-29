// Conteúdo do arquivo: link-fixer.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e5df3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Função que busca o slug e atualiza o link da vitrine
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

// Verifica o login e atualiza o link
onAuthStateChanged(auth, (user) => {
    if (user) {
        atualizarLinkVitrine(user.uid);
    } else {
        const linkVitrine = document.getElementById('link-minha-vitrine');
        if (linkVitrine) {
            linkVitrine.href = 'login.html';
        }
    }
});
