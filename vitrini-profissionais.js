// vitrini-profissionais.js (VERSÃO ATUALIZADA E CORRIGIDA - Firebase v10+)

import { db } from './vitrini-firebase.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================================================
// FUNÇÕES ORIGINAIS (PARA UM ÚNICO PROFISSIONAL VIA SLUG)
// Estas funções serão mantidas por enquanto, mas não serão usadas na nova lógica.
// ==========================================================================

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

        const [perfilSnap, servicosSnap, horariosSnap] = await Promise.all([
            getDoc(perfilRef),
            getDocs(query(servicosRef)),
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

// ==========================================================================
// NOVAS FUNÇÕES (PARA MÚLTIPLOS PROFISSIONAIS VIA EMPRESA)
// Estas são as novas funções que usaremos para a Vitrine da Empresa.
// ==========================================================================

/**
 * Pega o ID da empresa da URL (ex: ?empresa=EMPRESA_ID_123)
 * @returns {string|null} O ID da empresa ou nulo.
 */
export function getEmpresaIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa');
}

/**
 * Busca os dados de uma empresa específica no Firestore.
 * @param {string} empresaId - O ID do documento da empresa na coleção 'empresarios'.
 * @returns {Promise<object|null>} Os dados da empresa ou nulo se não encontrada.
 */
export async function getDadosEmpresa(empresaId) {
    if (!empresaId) return null;
    const empresaRef = doc(db, "empresarios", empresaId);
    const docSnap = await getDoc(empresaRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

/**
 * Busca todos os profissionais de uma empresa na subcoleção 'profissionais'.
 * @param {string} empresaId - O ID do documento da empresa.
 * @returns {Promise<Array>} Uma lista com os dados dos profissionais.
 */
export async function getProfissionaisDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
    const snapshot = await getDocs(profissionaisRef);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

/**
 * Busca os dados completos de um serviço da empresa pelo ID.
 * @param {string} empresaId - O ID do documento da empresa.
 * @param {string} servicoId - O ID do serviço.
 * @returns {Promise<object|null>} Os dados do serviço ou nulo se não encontrado.
 */
export async function getServicoById(empresaId, servicoId) {
    if (!empresaId || !servicoId) return null;
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    const snap = await getDoc(servicoRef);
    return snap.exists() ? { id: servicoId, ...snap.data() } : null;
}

/**
 * Busca todos os serviços de uma empresa (caso queira listar todos).
 * @param {string} empresaId - O ID do documento da empresa.
 * @returns {Promise<Array>} Lista de todos os serviços da empresa.
 */
export async function getTodosServicosDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const servicosRef = collection(db, "empresarios", empresaId, "servicos");
    const snapshot = await getDocs(servicosRef);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}
