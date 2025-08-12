// vitrine-profissionais.js
// Carregue SEMPRE DEPOIS dos scripts e inicialização do Firebase no HTML!
// Exemplo de ordem correta:
// <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"></script>
// <script>
//   const firebaseConfig = { ... };
//   firebase.initializeApp(firebaseConfig);
// </script>
// <script src="vitrine-profissionais.js"></script>

// ------------------------
// UTILITÁRIOS DE URL
// ------------------------

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

// ------------------------
// FUNÇÕES PARA PERFIL DO PROFISSIONAL (via slug)
// ------------------------

async function getProfissionalUidBySlug(slug) {
    if (!slug) {
        console.warn("Slug vazio ou inválido.");
        return null;
    }
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const slugDocRef = firebase.firestore().collection("slugs").doc(slug);
        const slugDocSnap = await slugDocRef.get();
        if (!slugDocSnap.exists) {
            console.warn(`Slug "${slug}" não encontrado no Firestore.`);
            return null;
        }
        const data = slugDocSnap.data();
        if (!data.uid) {
            console.warn(`Documento slug "${slug}" não contém campo uid.`);
            return null;
        }
        return data.uid;
    } catch (error) {
        console.error("Erro ao buscar UID pelo slug:", error);
        return null;
    }
}
window.getProfissionalUidBySlug = getProfissionalUidBySlug;

async function getDadosProfissional(uid) {
    if (!uid) {
        console.warn("UID do profissional inválido ou vazio.");
        return null;
    }
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const db = firebase.firestore();

        const perfilRef = db.collection("users").doc(uid).collection("publicProfile").doc("profile");
        const servicosRef = db.collection("users").doc(uid).collection("servicos");
        const horariosRef = db.collection("users").doc(uid).collection("configuracoes").doc("horarios");

        // Carrega tudo em paralelo
        const [perfilSnap, servicosSnap, horariosSnap] = await Promise.all([
            perfilRef.get(),
            servicosRef.get(),
            horariosRef.get()
        ]);

        if (!perfilSnap.exists) {
            console.warn(`Perfil público não encontrado para UID: ${uid}`);
            return null;
        }

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

// ------------------------
// FUNÇÕES PARA EMPRESA (vitrine)
// ------------------------

async function getDadosEmpresa(empresaId) {
    if (!empresaId) {
        console.warn("ID da empresa inválido ou vazio.");
        return null;
    }
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const empresaRef = firebase.firestore().collection("empresarios").doc(empresaId);
        const docSnap = await empresaRef.get();
        if (!docSnap.exists) {
            console.warn(`Empresa com ID "${empresaId}" não encontrada.`);
            return null;
        }
        return { id: docSnap.id, ...docSnap.data() };
    } catch (error) {
        console.error("Erro ao carregar dados da empresa:", error);
        return null;
    }
}
window.getDadosEmpresa = getDadosEmpresa;

async function getProfissionaisDaEmpresa(empresaId) {
    if (!empresaId) {
        console.warn("ID da empresa inválido ou vazio para buscar profissionais.");
        return [];
    }
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
    if (!empresaId || !servicoId) {
        console.warn("Parâmetros inválidos para buscar serviço (empresaId, servicoId).");
        return null;
    }
    if (typeof firebase === "undefined" || !firebase.firestore) {
        console.error("Firebase não está definido. Verifique a ordem dos scripts no HTML.");
        return null;
    }
    try {
        const servicoRef = firebase.firestore().collection("empresarios").doc(empresaId).collection("servicos").doc(servicoId);
        const snap = await servicoRef.get();
        if (!snap.exists) {
            console.warn(`Serviço com ID "${servicoId}" não encontrado na empresa "${empresaId}".`);
            return null;
        }
        return { id: servicoId, ...snap.data() };
    } catch (error) {
        console.error("Erro ao buscar serviço por ID:", error);
        return null;
    }
}
window.getServicoById = getServicoById;

async function getTodosServicosDaEmpresa(empresaId) {
    if (!empresaId) {
        console.warn("ID da empresa inválido para buscar serviços.");
        return [];
    }
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

// ------------------------
// FUNÇÕES ADICIONAIS: Serviços e horários por profissional
// ------------------------

async function getServicosDoProfissional(empresaId, profissionalId) {
    if (!empresaId || !profissionalId) {
        console.warn("Parâmetros inválidos para buscar serviços do profissional.");
        return [];
    }
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
    if (!empresaId || !profissionalId) {
        console.warn("Parâmetros inválidos para buscar horários do profissional.");
        return {};
    }
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

// ------------------------
// FUNÇÃO TESTE SIMPLES PARA RODAR NO CONSOLE DO NAVEGADOR
// ------------------------

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
