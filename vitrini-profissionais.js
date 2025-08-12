// vitrini-profissionais.js
// RESPONSABILIDADE: Funções para buscar dados públicos de empresas e profissionais.
// VERSÃO FINAL E CORRIGIDA - Firebase v10.12.2

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

// --- FUNÇÕES DE BUSCA DE DADOS ---

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

// --- FUNÇÕES COMPLETADAS ---

export async function getServicoById(empresaId, servicoId) {
    if (!empresaId || !servicoId) return null;
    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const docSnap = await getDoc(servicoRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error("Erro ao buscar serviço por ID:", error);
        return null;
    }
}

export async function getTodosServicosDaEmpresa(empresaId) {
    if (!empresaId) return [];
    try {
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const snapshot = await getDocs(servicosRef);
        const servicos = [];
        snapshot.forEach(docSnap => servicos.push({ id: docSnap.id, ...docSnap.data() }));
        return servicos;
    } catch (error) {
        console.error("Erro ao carregar todos os serviços da empresa:", error);
        return [];
    }
}
