// vitrini-profissionais.js - Revisado para trazer serviços completos para cada profissional

import { db } from './vitrini-firebase.js';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Busca os dados da empresa pelo ID.
 */
export async function getDadosEmpresa(empresaId) {
    const doc = await getDocs(collection(db, "empresarios"));
    const empresaDoc = doc.docs.find(d => d.id === empresaId);
    return empresaDoc ? { id: empresaDoc.id, ...empresaDoc.data() } : null;
}

/**
 * Busca todos os serviços da empresa.
 */
export async function getServicosDaEmpresa(empresaId) {
    const snapshot = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca todos os profissionais da empresa e inclui os dados completos dos serviços.
 */
export async function getProfissionaisDaEmpresa(empresaId) {
    const profSnapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
    const servicos = await getServicosDaEmpresa(empresaId);

    return profSnapshot.docs.map(doc => {
        const prof = { id: doc.id, ...doc.data() };
        // Se prof.servicos for array de IDs, converte para objetos completos
        if (Array.isArray(prof.servicos) && typeof prof.servicos[0] === 'string') {
            prof.servicos = servicos.filter(svc => prof.servicos.includes(svc.id));
        }
        // Se já for array de objetos, mantém
        return prof;
    });
}

/**
 * Busca um serviço pelo ID (caso precise individualmente).
 */
export async function getServicoPorId(empresaId, servicoId) {
    const servicos = await getServicosDaEmpresa(empresaId);
    return servicos.find(svc => svc.id === servicoId);
}

/**
 * Busca todos os profissionais (sem serviços) - caso deseje versão simples.
 */
export async function getProfissionaisSimples(empresaId) {
    const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca todos os serviços (simples) - se quiser só lista sem relação com profissionais.
 */
export async function getServicosSimples(empresaId) {
    const snapshot = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
