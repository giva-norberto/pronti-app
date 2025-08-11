// vitrine-profissionais.js - Corrigido para Firebase CDN, sem import/export!
// Carregue SEMPRE depois do Firebase CDN e da inicialização do Firebase no HTML:
// <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"></script>
// <script>
//   const firebaseConfig = { ... };
//   firebase.initializeApp(firebaseConfig);
// </script>
// <script src="vitrini-profissionais.js"></script>

// ===============================
// FUNÇÕES PARA PERFIL PROFISSIONAL (via SLUG)
// ===============================

function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

async function getProfissionalUidBySlug(slug) {
    if (!slug) return null;
    try {
        const slugDocRef = firebase.firestore().collection("slugs").doc(slug);
        const slugDocSnap = await slugDocRef.get();
        return slugDocSnap.exists ? slugDocSnap.data().uid : null;
    } catch (error) {
        console.error("Erro ao buscar UID pelo slug:", error);
        return null;
    }
}

async function getDadosProfissional(uid) {
    if (!uid) return null;
    try {
        const perfilRef = firebase.firestore().collection("users").doc(uid).collection("publicProfile").doc("profile");
        const servicosRef = firebase.firestore().collection("users").doc(uid).collection("servicos");
        const horariosRef = firebase.firestore().collection("users").doc(uid).collection("configuracoes").doc("horarios");

        const [perfilSnap, servicosSnap, horariosSnap] = await Promise.all([
            perfilRef.get(),
            servicosRef.get(),
            horariosRef.get()
        ]);

        if (!perfilSnap.exists) {
            console.warn("Perfil público não encontrado para o UID:", uid);
            return null;
        }

        const perfil = perfilSnap.data();
        const horarios = horariosSnap.exists ? horariosSnap.data() : {};
        const servicos = [];
        servicosSnap.forEach(d => servicos.push({ id: d.id, ...d.data() }));

        return { uid, perfil, servicos, horarios };

    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        throw new Error("Falha ao carregar dados do profissional.");
    }
}

// ===============================
// FUNÇÕES PARA EMPRESA (vitrine)
// ===============================

function getEmpresaIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa');
}

async function getDadosEmpresa(empresaId) {
    if (!empresaId) return null;
    const empresaRef = firebase.firestore().collection("empresarios").doc(empresaId);
    const docSnap = await empresaRef.get();
    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
}

async function getProfissionaisDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const profissionaisRef = firebase.firestore().collection("empresarios").doc(empresaId).collection("profissionais");
    const snapshot = await profissionaisRef.get();
    const profissionais = [];
    snapshot.forEach(docSnap => profissionais.push({ id: docSnap.id, ...docSnap.data() }));
    return profissionais;
}

async function getServicoById(empresaId, servicoId) {
    if (!empresaId || !servicoId) return null;
    const servicoRef = firebase.firestore().collection("empresarios").doc(empresaId).collection("servicos").doc(servicoId);
    const snap = await servicoRef.get();
    return snap.exists ? { id: servicoId, ...snap.data() } : null;
}

async function getTodosServicosDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const servicosRef = firebase.firestore().collection("empresarios").doc(empresaId).collection("servicos");
    const snapshot = await servicosRef.get();
    const servicos = [];
    snapshot.forEach(docSnap => servicos.push({ id: docSnap.id, ...docSnap.data() }));
    return servicos;
}

// ===============================
// Expõe todas funções no window
// ===============================

window.getSlugFromURL = getSlugFromURL;
window.getProfissionalUidBySlug = getProfissionalUidBySlug;
window.getDadosProfissional = getDadosProfissional;
window.getEmpresaIdFromURL = getEmpresaIdFromURL;
window.getDadosEmpresa = getDadosEmpresa;
window.getProfissionaisDaEmpresa = getProfissionaisDaEmpresa;
window.getServicoById = getServicoById;
window.getTodosServicosDaEmpresa = getTodosServicosDaEmpresa;
