// vitrine-profissionais.js
// RESPONSABILIDADE: Funções para buscar dados públicos de empresas e profissionais.
// ATUALIZADO para a sintaxe moderna do Firebase (v10) e para ser um módulo ES6.

import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './vitrini-firebase.js'; // Importa a conexão 'db' do nosso arquivo central

// --- FUNÇÕES DE UTILIDADE DE URL ---

export function getSlugFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('slug');
    } catch (e) {
        console.error("Erro ao ler slug da URL:", e);
        return null;
    }
}

export function getEmpresaIdFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('empresa');
    } catch (e) {
        console.error("Erro ao ler empresa da URL:", e);
        return null;
    }
}

// --- FUNÇÕES DE BUSCA DE DADOS (Refatoradas) ---

export async function getProfissionalUidBySlug(slug) {
    if (!slug) return null;
    try {
        const slugRef = doc(db, "slugs", slug);
        const docSnap = await getDoc(slugRef);
        if (!docSnap.exists()) return null;
        return docSnap.data().uid || null;
    } catch (error) {
        console.error("Erro ao buscar UID pelo slug:", error);
        return null;
    }
}

export async function getDadosProfissional(uid) {
    if (!uid) return null;
    try {
        const perfilRef = doc(db, "users", uid, "publicProfile", "profile");
        const servicosRef = collection(db, "users", uid, "servicos");
        const horariosRef = doc(db, "users", uid, "configuracoes", "horarios");

        const [perfilSnap, servicosSnap, horariosSnap] = await Promise.all([
            getDoc(perfilRef),
            getDocs(servicosRef),
            getDoc(horariosRef)
        ]);

        if (!perfilSnap.exists()) return null;

        const perfil = perfilSnap.data();
        const horarios = horariosSnap.exists() ? horariosSnap.data() : {};
        const servicos = [];
        servicosSnap.forEach(doc => servicos.push({ id: doc.id, ...doc.data() }));

        return { uid, perfil, servicos, horarios };
    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        return null;
    }
}

export async function getDadosEmpresa(empresaId) {
    if (!empresaId) return null;
    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const docSnap = await getDoc(empresaRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error("Erro ao carregar dados da empresa:", error);
        return null;
    }
}

export async function getProfissionaisDaEmpresa(empresaId) {
    if (!empresaId) return [];
    try {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const snapshot = await getDocs(profissionaisRef);
        const profissionais = [];
        snapshot.forEach(docSnap => profissionais.push({ id: docSnap.id, ...docSnap.data() }));
        return profissionais;
    } catch (error) {
        console.error("Erro ao carregar profissionais da empresa:", error);
        return [];
    }
}

export async function getServicosDoProfissional(empresaId, profissionalId) {
    if (!empresaId || !profissionalId) return [];
    try {
        const servicosRef = collection(db, "empresarios", empresaId, "profissionais", profissionalId, "servicos");
        const snapshot = await getDocs(servicosRef);
        const servicos = [];
        snapshot.forEach(docSnap => servicos.push({ id: docSnap.id, ...docSnap.data() }));
        return servicos;
    } catch (error) {
        console.error("Erro ao buscar serviços do profissional:", error);
        return [];
    }
}

export async function getHorariosDoProfissional(empresaId, profissionalId) {
    if (!empresaId || !profissionalId) return {};
    try {
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId, "configuracoes", "horarios");
        const horariosSnap = await getDoc(horariosRef);
        return horariosSnap.exists() ? horariosSnap.data() : {};
    } catch (error) {
        console.error("Erro ao buscar horários do profissional:", error);
        return {};
    }
}

// O restante das suas funções de busca (`getServicoById`, `getTodosServicosDaEmpresa`) seguiriam o mesmo padrão de refatoração.
