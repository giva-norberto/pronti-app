// vitrine-profissionais.js - Completo e revisado
import { db } from './vitrini-firebase.js';
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

/**
 * Busca os dados da empresa pelo ID.
 * Retorna objeto: { id, nomeFantasia, descricao, logoUrl, ... }
 */
export async function getDadosEmpresa(empresaId) {
    // Busca documento específico da empresa
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    return empresaSnap.exists() ? { id: empresaId, ...empresaSnap.data() } : null;
}

/**
 * Busca todos os serviços da empresa.
 * Retorna array de objetos: [{ id, nome, descricao, duracao, preco, ... }]
 */
export async function getServicosDaEmpresa(empresaId) {
    const snap = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca todos os profissionais da empresa e inclui os dados completos dos serviços.
 * Se os serviços do profissional forem apenas IDs, converte para array de objetos completos.
 * Retorna array de profissionais: [{ id, nome, fotoUrl, servicos: [obj], horarios, ... }]
 */
export async function getProfissionaisDaEmpresa(empresaId) {
    const profSnap = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
    const servicos = await getServicosDaEmpresa(empresaId);

    return profSnap.docs.map(doc => {
        const prof = { id: doc.id, ...doc.data() };
        // Corrige: se prof.servicos for array de IDs, converte para array de objetos
        if (Array.isArray(prof.servicos)) {
            if (typeof prof.servicos[0] === 'string') {
                prof.servicos = servicos.filter(svc => prof.servicos.includes(svc.id));
            }
            // Se já é array de objetos, mantém como está
        } else {
            prof.servicos = [];
        }
        // Horários padrão vazio se não vier do banco
        if (!prof.horarios) prof.horarios = [];
        return prof;
    });
}

/**
 * Busca serviço por ID.
 * Retorna objeto ou undefined.
 */
export async function getServicoPorId(empresaId, servicoId) {
    const servicos = await getServicosDaEmpresa(empresaId);
    return servicos.find(svc => svc.id === servicoId);
}

/**
 * Busca todos os profissionais (simples, sem serviços completos).
 * Retorna array de profissionais.
 */
export async function getProfissionaisSimples(empresaId) {
    const snap = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca todos os serviços (simples, sem relação com profissionais).
 * Retorna array de serviços.
 */
export async function getServicosSimples(empresaId) {
    const snap = await getDocs(collection(db, "empresarios", empresaId, "servicos"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Exporta todos os dados de profissionais e seus serviços
 * (útil para debug/admin)
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
