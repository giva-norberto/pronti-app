// vitrine-profissionais.js - Para Firebase CDN, sem import/export!

/**
 * Busca dados da empresa
 */
async function getDadosEmpresa(empresaId) {
    const empresaRef = firebase.firestore().collection("empresarios").doc(empresaId);
    const empresaSnap = await empresaRef.get();
    return empresaSnap.exists ? { id: empresaId, ...empresaSnap.data() } : null;
}

/**
 * Busca todos os serviços da empresa
 */
async function getServicosDaEmpresa(empresaId) {
    const servicosSnap = await firebase.firestore()
        .collection("empresarios")
        .doc(empresaId)
        .collection("servicos")
        .get();
    const servicos = [];
    servicosSnap.forEach(doc => servicos.push({ id: doc.id, ...doc.data() }));
    return servicos;
}

/**
 * Busca todos os profissionais da empresa e inclui serviços completos
 */
async function getProfissionaisDaEmpresa(empresaId) {
    const profSnap = await firebase.firestore()
        .collection("empresarios")
        .doc(empresaId)
        .collection("profissionais")
        .get();
    const servicos = await getServicosDaEmpresa(empresaId);

    const profissionais = [];
    profSnap.forEach(doc => {
        const prof = { id: doc.id, ...doc.data() };
        if (Array.isArray(prof.servicos)) {
            if (prof.servicos.length && typeof prof.servicos[0] === 'string') {
                prof.servicos = servicos.filter(svc => prof.servicos.includes(svc.id));
            }
        } else {
            prof.servicos = [];
        }
        prof.horarios = Array.isArray(prof.horarios) ? prof.horarios : [];
        profissionais.push(prof);
    });
    return profissionais;
}

/**
 * Busca serviço por ID
 */
async function getServicoPorId(empresaId, servicoId) {
    const servicoRef = firebase.firestore()
        .collection("empresarios")
        .doc(empresaId)
        .collection("servicos")
        .doc(servicoId);
    const servicoSnap = await servicoRef.get();
    return servicoSnap.exists ? { id: servicoId, ...servicoSnap.data() } : null;
}

/**
 * Busca profissionais simples
 */
async function getProfissionaisSimples(empresaId) {
    const profSnap = await firebase.firestore()
        .collection("empresarios")
        .doc(empresaId)
        .collection("profissionais")
        .get();
    const profissionais = [];
    profSnap.forEach(doc => profissionais.push({ id: doc.id, ...doc.data() }));
    return profissionais;
}

/**
 * Busca serviços simples
 */
async function getServicosSimples(empresaId) {
    const servicosSnap = await firebase.firestore()
        .collection("empresarios")
        .doc(empresaId)
        .collection("servicos")
        .get();
    const servicos = [];
    servicosSnap.forEach(doc => servicos.push({ id: doc.id, ...doc.data() }));
    return servicos;
}

/**
 * Exporta todos os dados de profissionais e seus serviços
 */
async function exportProfissionaisComServicos(empresaId) {
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

// Expõe no window para uso global
window.getDadosEmpresa = getDadosEmpresa;
window.getServicosDaEmpresa = getServicosDaEmpresa;
window.getProfissionaisDaEmpresa = getProfissionaisDaEmpresa;
window.getServicoPorId = getServicoPorId;
window.getProfissionaisSimples = getProfissionaisSimples;
window.getServicosSimples = getServicosSimples;
window.exportProfissionaisComServicos = exportProfissionaisComServicos;
