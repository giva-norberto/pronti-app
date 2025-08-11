// vitrine-profissionais.js - Revisado e COMPLETO para uso com import/export (ESM/módulo)
// Use este arquivo se você está usando import/export com Firebase instalado via npm/yarn.

// IMPORTS - ajuste o caminho do seu arquivo de configuração de Firebase!
import { db } from './vitrini-firebase.js';
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

/**
 * Busca os dados da empresa pelo ID.
 * @param {string} empresaId
 * @returns {Promise<object|null>}
 */
export async function getDadosEmpresa(empresaId) {
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    return empresaSnap.exists() ? { id: empresaId, ...empresaSnap.data() } : null;
}

/**
 * Busca todos os serviços da empresa.
 * @param {string} empresaId
 * @returns {Promise<Array>}
 */
export async function getServicosDaEmpresa(empresaId) {
    const snap = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca todos os profissionais da empresa e inclui os dados completos dos serviços.
 * @param {string} empresaId
 * @returns {Promise<Array>}
 */
export async function getProfissionaisDaEmpresa(empresaId) {
    const profSnap = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
    const servicos = await getServicosDaEmpresa(empresaId);

    return profSnap.docs.map(doc => {
        const prof = { id: doc.id, ...doc.data() };
        // Se prof.servicos for array de IDs, converte para array de objetos completos
        if (Array.isArray(prof.servicos)) {
            if (prof.servicos.length && typeof prof.servicos[0] === 'string') {
                prof.servicos = servicos.filter(svc => prof.servicos.includes(svc.id));
            }
        } else {
            prof.servicos = [];
        }
        // Horários: garante array vazio se não existir
        prof.horarios = Array.isArray(prof.horarios) ? prof.horarios : [];
        return prof;
    });
}

/**
 * Busca serviço por ID.
 * @param {string} empresaId
 * @param {string} servicoId
 * @returns {Promise<object|null>}
 */
export async function getServicoPorId(empresaId, servicoId) {
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    const servicoSnap = await getDoc(servicoRef);
    return servicoSnap.exists() ? { id: servicoId, ...servicoSnap.data() } : null;
}

/**
 * Busca todos os profissionais (simples, sem serviços completos).
 * @param {string} empresaId
 * @returns {Promise<Array>}
 */
export async function getProfissionaisSimples(empresaId) {
    const profSnap = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
    return profSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca todos os serviços (simples).
 * @param {string} empresaId
 * @returns {Promise<Array>}
 */
export async function getServicosSimples(empresaId) {
    const servicosSnap = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    return servicosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Exporta todos os dados de profissionais e seus serviços (para debug/admin).
 * @param {string} empresaId
 * @returns {Promise<Array>}
 */
export async function exportProfissionaisComServicos(empresaId) {
    const profissionais = await getProfissionaisDaEmpresa(empresaId);
    return profissionais.map(prof => ({
        id: prof.id,
        nome: prof.nome,
        servicos: prof.servicos.map(s => ({
            id: s.id,
            nome: s.nome,
            descricao: s.descricao,
            duracao: s.duracao,
            preco: s.preco
        })),
        horarios: prof.horarios,
        fotoUrl: prof.fotoUrl || null
    }));
}
