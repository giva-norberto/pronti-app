import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÃO: Use variáveis de ambiente Vite/webpack em produção.
// Para testes locais, pode deixar hardcoded temporariamente!
const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "SUA_API_KEY_PUBLICA",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "SEU_AUTH_DOMAIN",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "SEU_PROJECT_ID",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "SEU_STORAGE_BUCKET",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "SEU_MESSAGING_ID",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || "SEU_APP_ID"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Carrega os serviços visíveis na vitrine de uma empresa.
 * @param {string} empresaId - ID da empresa no Firestore.
 * @returns {Promise<Array>} - Array de serviços visíveis.
 */
export async function carregarServicosVitrine(empresaId) {
    try {
        const profissionaisCol = collection(db, "empresarios", empresaId, "profissionais");
        const profissionaisSnap = await getDocs(profissionaisCol);

        let servicosVitrine = [];

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

// EXEMPLO DE USO (em vitrini.html ou outro script):
// const empresaId = new URLSearchParams(window.location.search).get("empresa");
// const container = document.getElementById("vitrine-servicos");
// carregarServicosVitrine(empresaId).then(servicos => renderizarServicosNaVitrine(servicos, container));
