// ======================================================================
// ARQUIVO: redirecionar.js (LÓGICA DO PASSO 2)
// ======================================================================

import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

async function redirecionarUsuario( ) {
    try {
        // 1. Pega os parâmetros da URL
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('c'); // 'c' de 'código' ou 'curto'

        if (!slug) {
            // Se não houver slug, redireciona para a página principal
            window.location.href = '/index.html';
            return;
        }

        // 2. Monta a consulta no Firestore para encontrar a empresa pelo slug
        const q = query(
            collection(db, "empresarios"), 
            where("slug", "==", slug),
            limit(1) // Otimização: só precisamos de 1 resultado
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // Se não encontrar nenhuma empresa com esse slug, informa o usuário
            document.body.innerHTML = '<p>Link não encontrado ou inválido.</p>';
            return;
        }

        // 3. Pega o ID longo da empresa encontrada
        const empresaDoc = snapshot.docs[0];
        const empresaId = empresaDoc.id;

        // 4. Monta a URL final da vitrine e redireciona
        const urlFinal = `/vitrine.html?empresa=${empresaId}`;
        window.location.replace(urlFinal); // .replace() é melhor para não criar histórico

    } catch (error) {
        console.error("Erro ao redirecionar:", error);
        document.body.innerHTML = '<p>Ocorreu um erro ao processar o link. Tente novamente.</p>';
    }
}

// Inicia o processo assim que a página carrega
redirecionarUsuario();
