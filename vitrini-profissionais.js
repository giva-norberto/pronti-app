// vitrine-profissionais.js
// Carregue SEMPRE DEPOIS dos scripts e inicialização do Firebase no HTML!

function getSlugFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('slug');
    } catch (e) {
        console.error("Erro ao ler slug da URL:", e);
        return null;
    }
}
window.getSlugFromURL = getSlugFromURL;

function getEmpresaIdFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('empresa');
    } catch (e) {
        console.error("Erro ao ler empresa da URL:", e);
        return null;
    }
}
window.getEmpresaIdFromURL = getEmpresaIdFromURL;

async function getProfissionalUidBySlug(slug) {
    if (!slug) return null;
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const doc = await firebase.firestore().collection("slugs").doc(slug).get();
        const data = doc.exists ? doc.data() : null;
        return data && data.uid ? data.uid : null;
    } catch (error) {
        console.error("Erro ao buscar UID pelo slug:", error);
        return null;
    }
}
window.getProfissionalUidBySlug = getProfissionalUidBySlug;

async function getDadosProfissional(uid) {
    if (!uid) return null;
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const db = firebase.firestore();
        const perfilRef = db.collection("users").doc(uid).collection("publicProfile").doc("profile");
        const servicosRef = db.collection("users").doc(uid).collection("servicos");
        const horariosRef = db.collection("users").doc(uid).collection("configuracoes").doc("horarios");

        const [perfilSnap, servicosSnap, horariosSnap] = await Promise.all([
            perfilRef.get(),
            servicosRef.get(),
            horariosRef.get()
        ]);
        if (!perfilSnap.exists) return null;

        const perfil = perfilSnap.data();
        const horarios = horariosSnap.exists ? horariosSnap.data() : {};
        const servicos = [];
        servicosSnap.forEach(doc => servicos.push({ id: doc.id, ...doc.data() }));

        return { uid, perfil, servicos, horarios };
    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        return null;
    }
}
window.getDadosProfissional = getDadosProfissional;

async function getDadosEmpresa(empresaId) {
    if (!empresaId) return null;
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const empresaRef = firebase.firestore().collection("empresarios").doc(empresaId);
        const docSnap = await empresaRef.get();
        return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error("Erro ao carregar dados da empresa:", error);
        return null;
    }
}
window.getDadosEmpresa = getDadosEmpresa;

async function getProfissionaisDaEmpresa(empresaId) {
    if (!empresaId) return [];
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return [];
    }
    try {
        const profissionaisRef = firebase.firestore().collection("empresarios").doc(empresaId).collection("profissionais");
        const snapshot = await profissionaisRef.get();
        const profissionais = [];
        snapshot.forEach(docSnap => profissionais.push({ id: docSnap.id, ...docSnap.data() }));
        return profissionais;
    } catch (error) {
        console.error("Erro ao carregar profissionais da empresa:", error);
        return [];
    }
}
window.getProfissionaisDaEmpresa = getProfissionaisDaEmpresa;

async function getServicoById(empresaId, servicoId) {
    if (!empresaId || !servicoId) return null;
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const snap = await firebase.firestore().collection("empresarios").doc(empresaId).collection("servicos").doc(servicoId).get();
        return snap.exists ? { id: servicoId, ...snap.data() } : null;
    } catch (error) {
        console.error("Erro ao buscar serviço por ID:", error);
        return null;
    }
}
window.getServicoById = getServicoById;

async function getTodosServicosDaEmpresa(empresaId) {
    if (!empresaId) return [];
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return [];
    }
    try {
        const servicosRef = firebase.firestore().collection("empresarios").doc(empresaId).collection("servicos");
        const snapshot = await servicosRef.get();
        const servicos = [];
        snapshot.forEach(docSnap => servicos.push({ id: docSnap.id, ...docSnap.data() }));
        return servicos;
    } catch (error) {
        console.error("Erro ao carregar todos os serviços da empresa:", error);
        return [];
    }
}
window.getTodosServicosDaEmpresa = getTodosServicosDaEmpresa;

async function getServicosDoProfissional(empresaId, profissionalId) {
    if (!empresaId || !profissionalId) return [];
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return [];
    }
    try {
        const servicosRef = firebase.firestore()
            .collection("empresarios").doc(empresaId)
            .collection("profissionais").doc(profissionalId)
            .collection("servicos");
        const snapshot = await servicosRef.get();
        const servicos = [];
        snapshot.forEach(docSnap => servicos.push({ id: docSnap.id, ...docSnap.data() }));
        return servicos;
    } catch (error) {
        console.error("Erro ao buscar serviços do profissional:", error);
        return [];
    }
}
window.getServicosDoProfissional = getServicosDoProfissional;

async function getHorariosDoProfissional(empresaId, profissionalId) {
    if (!empresaId || !profissionalId) return {};
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return {};
    }
    try {
        const horariosRef = firebase.firestore()
            .collection("empresarios").doc(empresaId)
            .collection("profissionais").doc(profissionalId)
            .collection("configuracoes").doc("horarios");
        const horariosSnap = await horariosRef.get();
        return horariosSnap.exists ? horariosSnap.data() : {};
    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        return {};
    }
}
window.getHorariosDoProfissional = getHorariosDoProfissional;

// Teste rápido
window.testVitrineProfissionais = async function() {
    console.log("### TESTE DE VITRINE-PROFISSIONAIS ###");

    const slug = getSlugFromURL() || prompt("Informe um slug válido para teste:");
    console.log("Slug usado:", slug);

    if (!slug) {
        console.warn("Nenhum slug informado para teste.");
        return;
    }

    const uid = await getProfissionalUidBySlug(slug);
    if (!uid) {
        console.error("UID não encontrado para slug:", slug);
        return;
    }
    console.log("UID do profissional:", uid);

    const dadosProf = await getDadosProfissional(uid);
    if (!dadosProf) {
        console.error("Não foi possível carregar dados do profissional.");
        return;
    }
    console.log("Dados do profissional:", dadosProf);

    const empresaId = getEmpresaIdFromURL();
    if (!empresaId) {
        console.warn("Nenhum empresaId na URL para teste dos dados da empresa.");
        return;
    }
    const dadosEmpresa = await getDadosEmpresa(empresaId);
    if (!dadosEmpresa) {
        console.error("Não foi possível carregar dados da empresa.");
        return;
    }
    console.log("Dados da empresa:", dadosEmpresa);

    const profs = await getProfissionaisDaEmpresa(empresaId);
    console.log(`Profissionais da empresa (${empresaId}):`, profs);

    for (const prof of profs) {
        const servicos = await getServicosDoProfissional(empresaId, prof.id);
        console.log(`Serviços do profissional ${prof.nome} (${prof.id}):`, servicos);
        const horarios = await getHorariosDoProfissional(empresaId, prof.id);
        console.log(`Horários do profissional ${prof.nome} (${prof.id}):`, horarios);
    }

    const servicosEmpresa = await getTodosServicosDaEmpresa(empresaId);
    console.log(`Serviços da empresa (${empresaId}):`, servicosEmpresa);
};
