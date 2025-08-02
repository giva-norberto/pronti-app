/**
 * link-fixer.js (VERSÃO CORRIGIDA E ALINHADA)
 *
 * Lógica Principal:
 * 1. IMPORTA a configuração do Firebase, em vez de reinicializar.
 * 2. Encontra a 'empresaId' do usuário logado.
 * 3. Atualiza o link "Minha Vitrine" com o URL correto, baseado no 'empresaId'.
 */

// CORREÇÃO: Importamos db e auth, em vez de inicializar o app aqui.
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

/**
 * [NOVO] Função auxiliar para encontrar o ID da empresa do dono.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}


/**
 * CORREÇÃO: Busca o 'empresaId' e atualiza o link da vitrine.
 * @param {string} uid - O UID do usuário logado.
 */
async function atualizarLinkVitrine(uid) {
    const linkVitrine = document.getElementById('link-minha-vitrine');
    if (!linkVitrine) return;

    try {
        const empresaId = await getEmpresaIdDoDono(uid);

        if (empresaId) {
            // Se encontrou a empresa, monta o link correto.
            linkVitrine.href = `vitrine.html?empresa=${empresaId}`;
            linkVitrine.title = 'Ver a sua vitrine pública';
        } else {
            // Se não encontrou, aponta para a página de perfil para o usuário se cadastrar.
            linkVitrine.href = 'perfil.html';
            linkVitrine.title = 'Complete seu perfil para ativar sua vitrine';
        }
    } catch (error) {
        console.error("Erro ao buscar empresa para o link da vitrine:", error);
    }
}

// Verifica o login e atualiza o link (lógica mantida, mas agora chama a função correta)
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
