import { db } from './vitrini-firebase.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================
// FUNÇÕES ORIGINAIS (PARA UM ÚNICO PROFISSIONAL VIA SLUG)
// ==========================================================================

export function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

export async function getProfissionalUidBySlug(slug) {
    if (!slug) return null;
    try {
        const slugDocRef = doc(db, "slugs", slug);
        const slugDocSnap = await getDoc(slugDocRef);
        if (slugDocSnap.exists()) {
            return slugDocSnap.data().uid;
        } else {
            console.warn("Slug não encontrado:", slug);
            return null;
        }
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
            getDocs(query(servicosRef)),
            getDoc(horariosRef)
        ]);

        if (!perfilSnap.exists()) {
            console.warn("Perfil público não encontrado para o UID:", uid);
            return null;
        }

        const perfil = perfilSnap.data();
        const horarios = horariosSnap.exists() ? horariosSnap.data() : {};
        const servicos = servicosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return {
            uid,
            perfil,
            servicos,
            horarios
        };

    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        throw new Error("Falha ao carregar dados do profissional.");
    }
}

// ==========================================================================
// NOVAS FUNÇÕES (PARA MÚLTIPLOS PROFISSIONAIS VIA EMPRESA)
// ==========================================================================

export function getEmpresaIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('empresa');
}

export async function getDadosEmpresa(empresaId) {
    if (!empresaId) return null;
    const empresaRef = doc(db, "empresarios", empresaId);
    const docSnap = await getDoc(empresaRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getProfissionaisDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
    const snapshot = await getDocs(profissionaisRef);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function getServicoById(empresaId, servicoId) {
    if (!empresaId || !servicoId) return null;
    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
    const snap = await getDoc(servicoRef);
    return snap.exists() ? { id: servicoId, ...snap.data() } : null;
}

export async function getTodosServicosDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const servicosRef = collection(db, "empresarios", empresaId, "servicos");
    const snapshot = await getDocs(servicosRef);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}
