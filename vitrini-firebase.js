import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Configuração real do Firebase do seu projeto
const firebaseConfig = {
    apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
    authDomain: "pronti-app-37c6e.firebaseapp.com",
    projectId: "pronti-app-37c6e",
    storageBucket: "pronti-app-37c6e.appspot.com",
    messagingSenderId: "736700619274",
    appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Exporta explicitamente funções para login/logout
export { onAuthStateChanged, signInWithPopup, signOut };

/**
 * Carrega os serviços visíveis na vitrine de uma empresa.
 * @param {string} empresaId - ID da empresa no Firestore.
 * @returns {Promise<Array>} - Array de serviços visíveis.
 */
export async function carregarServicosVitrine(empresaId) {
    try {
        if (!empresaId) {
            throw new Error("empresaId não informado!");
        }

        // A coleção aninhada: empresarios/{empresaId}/profissionais
        const profissionaisCol = collection(db, "empresarios", empresaId, "profissionais");
        const profissionaisSnap = await getDocs(profissionaisCol);

        const servicosVitrine = [];

        profissionaisSnap.forEach((profDoc) => {
            const dados = profDoc.data();
            if (Array.isArray(dados.servicos)) {
                dados.servicos.forEach(servico => {
                    if (servico.visivelNaVitrine !== false) {
                        servicosVitrine.push({
                            ...servico,
                            profissional: dados.nome || dados.displayName || "Profissional"
                        });
                    }
                });
            }
        });

        return servicosVitrine;
    } catch (error) {
        console.error("Erro ao carregar serviços da vitrine:", error);
        return [];
    }
}

/**
 * Renderiza os serviços na vitrine.
 * @param {Array} servicos - Array de serviços.
 * @param {Element} container - Elemento DOM onde mostrar os serviços.
 */
export function renderizarServicosNaVitrine(servicos, container) {
    if (!container) return;

    container.innerHTML = ""; // Limpa o container

    if (!servicos.length) {
        container.innerHTML = "<p>Nenhum serviço disponível na vitrine.</p>";
        return;
    }

    servicos.forEach(servico => {
        const item = document.createElement("div");
        item.className = "servico-vitrine";
        item.style.cssText = "border:1px solid #eee; padding:12px; margin-bottom:10px; border-radius:8px;";

        item.innerHTML = `
            <h3>${servico.nome}</h3>
            <p>Profissional: ${servico.profissional}</p>
            <p>Preço: R$ ${parseFloat(servico.preco || 0).toFixed(2)}</p>
            <p>${servico.descricao || ""}</p>
        `;
        container.appendChild(item);
    });
}
