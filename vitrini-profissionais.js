// vitrini-profissionais.js

import { db, doc, getDoc, collection, getDocs, query } from './vitrini-firebase.js';

/**
 * Obtém o slug (identificador) do profissional a partir dos parâmetros da URL.
 * @returns {string|null} O slug encontrado ou null.
 */
export function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

/**
 * Busca o UID do profissional no Firestore com base no slug.
 * @param {string} slug - O slug do profissional.
 * @returns {Promise<string|null>} O UID do profissional ou null.
 */
export async function getProfissionalUidBySlug(slug) {
    if (!slug) return null;
    try {
        const slugDocRef = doc(db, "slugs", slug);
        const slugDocSnap = await getDoc(slugDocRef);
        if (slugDocSnap.exists()) {
            return slugDocSnap.data().uid;
        } else {
            console.warn("Slug não encontrado:", slug);
            return null;
        }
    } catch (error) {
        console.error("Erro ao buscar UID pelo slug:", error);
        return null;
    }
}

/**
 * Carrega todos os dados públicos de um profissional (perfil, serviços e horários).
 * @param {string} uid - O UID do profissional.
 * @returns {Promise<object|null>} Um objeto com os dados do profissional ou null.
 */
export async function getDadosProfissional(uid) {
    if (!uid) return null;

    try {
        const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
        const servicosRef = collection(db, "users", uid, "servicos");
        const horariosRef = doc(db, "users", uid, "configuracoes", "horarios");

        // CORREÇÃO: A consulta aos serviços foi alterada para buscar TODOS os serviços.
        // O filtro 'where("visivelNaVitrine", "==", true)' foi removido.
        // Isto garante que todos os serviços que você cadastrou apareçam.
        const [perfilSnap, servicosSnap, horariosSnap] = await Promise.all([
            getDoc(perfilRef),
            getDocs(query(servicosRef)), // A consulta foi simplificada aqui
            getDoc(horariosRef)
        ]);

        if (!perfilSnap.exists()) {
            console.warn("Perfil público não encontrado para o UID:", uid);
            return null;
        }

        const perfil = perfilSnap.data();
        const horarios = horariosSnap.exists() ? horariosSnap.data() : {};
        const servicos = servicosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return {
            uid,
            perfil,
            servicos,
            horarios
        };

    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        throw new Error("Falha ao carregar dados do profissional.");
    }
}
