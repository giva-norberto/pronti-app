import { db } from './vitrini-firebase.js';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// Função para obter o slug do profissional da URL
export function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

// Busca o UID do profissional baseado no slug
export async function getProfissionalUidBySlug(slug) {
    if (!slug) return null;

    try {
        const slugDocRef = doc(db, "slugs", slug);
        const slugDocSnap = await getDoc(slugDocRef);
        if (slugDocSnap.exists()) {
            return slugDocSnap.data().uid; // supondo que o documento tenha o campo "uid"
        } else {
            console.warn("Slug não encontrado:", slug);
            return null;
        }
    } catch (error) {
        console.error("Erro ao buscar UID do profissional pelo slug:", error);
        return null;
    }
}

// Carrega os dados do profissional e seus serviços
export async function getDadosProfissional(uid) {
    if (!uid) return null;

    try {
        const profDocRef = doc(db, "users", uid);
        const profDocSnap = await getDoc(profDocRef);
        if (!profDocSnap.exists()) {
            console.warn("Profissional não encontrado para UID:", uid);
            return null;
        }

        const dadosProfissional = profDocSnap.data();

        // Carregar os serviços do profissional
        const servicosColRef = collection(db, "users", uid, "servicos");
        const servicosSnap = await getDocs(servicosColRef);
        const servicos = servicosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
            uid,
            dadosProfissional,
            servicos
        };

    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        return null;
    }
}
