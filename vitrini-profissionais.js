// vitrini-profissionais.js (versão corrigida)

import { db } from './firebase-config.js';
// Importei a versão mais recente do Firestore que você usou no config, para manter a consistência.
import { doc, getDoc, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/**
 * Pega o ID da empresa a partir da URL ou do localStorage (multiempresa ).
 * @returns {string|null} O ID da empresa ou nulo.
 */
export function getEmpresaIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa') || localStorage.getItem('empresaAtivaId');
}

/**
 * Busca os dados principais de uma empresa no Firestore.
 * @param {string} empresaId - O ID da empresa.
 * @returns {Promise<Object|null>} Os dados da empresa ou nulo.
 */
export async function getDadosEmpresa(empresaId) {
    try {
        // CORREÇÃO: Alterado de 'empresarios' para 'empresas' para corresponder à estrutura do banco.
        const empresaRef = doc(db, 'empresas', empresaId);
        const empresaSnap = await getDoc(empresaRef);
        return empresaSnap.exists() ? empresaSnap.data() : null;
    } catch (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        return null;
    }
}

/**
 * Busca a lista de todos os profissionais de uma empresa.
 * @param {string} empresaId - O ID da empresa.
 * @returns {Promise<Array>} Uma lista com os profissionais.
 */
export async function getProfissionaisDaEmpresa(empresaId) {
    try {
        // CORREÇÃO: Alterado de 'empresarios' para 'empresas'.
        const profissionaisRef = collection(db, 'empresas', empresaId, 'profissionais');
        const snapshot = await getDocs(profissionaisRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar profissionais:", error);
        return [];
    }
}

/**
 * Busca a lista de todos os serviços que uma empresa oferece.
 * @param {string} empresaId - O ID da empresa.
 * @returns {Promise<Array>} Uma lista com todos os serviços.
 */
export async function getTodosServicosDaEmpresa(empresaId) {
    try {
        // CORREÇÃO: Alterado de 'empresarios' para 'empresas'.
        const servicosRef = collection(db, 'empresas', empresaId, 'servicos');
        const snapshot = await getDocs(servicosRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar todos os serviços:", error);
        return [];
    }
}

/**
 * Busca a configuração de horários de um profissional específico.
 * @param {string} empresaId - O ID da empresa.
 * @param {string} profissionalId - O ID do profissional.
 * @returns {Promise<Object|null>} O objeto de horários ou nulo.
 */
export async function getHorariosDoProfissional(empresaId, profissionalId) {
    try {
        // CORREÇÃO: Alterado de 'empresarios' para 'empresas'.
        const horariosRef = doc(db, 'empresas', empresaId, 'profissionais', profissionalId, 'configuracoes', 'horarios');
        const horariosSnap = await getDoc(horariosRef);
        return horariosSnap.exists() ? horariosSnap.data() : null;
    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        return null;
    }
}
