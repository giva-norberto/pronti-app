// ======================================================================
//      USER-SERVICE.JS (SEM LOOP) — Mantém todas as regras originais
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

// --- Função: Garante doc do usuário e trial, sempre com nome/email ---
export async function ensureUserAndTrialDoc() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, "usuarios", user.uid);
        let userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário',
                email: user.email || '',
                trialStart: serverTimestamp(),
                isPremium: false,
            });
        } else {
            const userData = userSnap.data();
            let updateObj = {};
            if (!userData.nome) updateObj.nome = user.displayName || user.email || 'Usuário';
            if (!userData.email) updateObj.email = user.email || '';
            if (!userData.trialStart) updateObj.trialStart = serverTimestamp();
            if (Object.keys(updateObj).length) await updateDoc(userRef, updateObj);
        }
    } catch (error) {
        console.error("❌ [ensureUserAndTrialDoc] Erro:", error);
    }
}

// --- Função auxiliar ---
function toDateSafe(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') {
        try { return v.toDate(); } catch (e) { return null; }
    }
    if (v && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

// --- Função: Checa status de plano/trial (prioriza trialEndDate, com fallback) ---
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        const userData = userSnap.data();
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };

        let trialDaysRemaining = 0;
        let isTrialActive = false;

        // 1) Prioriza company.trialEndDate (Timestamp ou variantes)
        let endDate = toDateSafe(empresaData?.trialEndDate || empresaData?.trial_end || empresaData?.trialEnds);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // 2) Se não existe trialEndDate, tenta calcular a partir de createdAt + freeEmDias
        if (!endDate) {
            const freeEmDias = Number(empresaData?.freeEmDias ?? empresaData?.free_em_dias ?? 0);
            const createdAt = toDateSafe(empresaData?.createdAt || empresaData?.created_at);
            if (freeEmDias > 0 && createdAt) {
                const computed = new Date(createdAt);
                computed.setDate(computed.getDate() + (freeEmDias - 1));
                computed.setHours(23, 59, 59, 999);
                endDate = computed;
            }
        }

        // 3) Se ainda não tem, tenta fallback para user.trialStart + freeEmDias (menos prioritário)
        if (!endDate) {
            const freeEmDias = Number(empresaData?.freeEmDias ?? empresaData?.free_em_dias ?? 0);
            const userTrialStart = toDateSafe(userData?.trialStart || userData?.trial_start);
            if (freeEmDias > 0 && userTrialStart) {
                const computedU = new Date(userTrialStart);
                computedU.setDate(computedU.getDate() + (freeEmDias - 1));
                computedU.setHours(23, 59, 59, 999);
                endDate = computedU;
            }
        }

        if (endDate) {
            if (endDate.getTime() >= hoje.getTime()) {
                isTrialActive = true;
                // conta dias completos restantes (base = hoje à 00:00)
                trialDaysRemaining = Math.ceil((endDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            }
        }

        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };
    } catch (error) {
        console.error("❌ [checkUserStatus] Erro:", error);
        // Em erro, NÃO liberar por default — negamos trial para evitar falso positivo
        return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
    }
}

// --- Função: Busca empresas ativas (dono e profissional, sem duplicidade) ---
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasUnicas = new Map();

    try {
        const qDono = query(
            collection(db, "empresarios"),
            where("donoId", "==", user.uid),
            where("status", "==", "ativo")
        );
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => empresasUnicas.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("❌ Erro ao buscar empresas como dono:", e);
    }

    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
            const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasUnicas.has(id));
            for (let i = 0; i < idsDeEmpresas.length; i += 10) {
                const chunk = idsDeEmpresas.slice(i, i + 10);
                const q = query(
                    collection(db, "empresarios"),
                    where(documentId(), "in", chunk),
                    where("status", "==", "ativo")
                );
                const snap = await getDocs(q);
                snap.forEach(doc => empresasUnicas.set(doc.id, { id: doc.id, ...doc.data() }));
            }
        }
    } catch (e) {
        console.error("❌ Erro ao buscar empresas pelo mapa:", e);
    }

    return Array.from(empresasUnicas.values());
}

// ======================================================================
// FUNÇÃO PRINCIPAL: Valida sessão, empresa ativa, plano, permissões
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) return cachedSessionProfile;
    if (isProcessing) throw new Error("Race condition detectada.");
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html', 'recuperar-senha.html'];
                // const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'meuperfil.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    isProcessing = false;
                    return reject(new Error("Usuário não autenticado."));
                }

                await ensureUserAndTrialDoc();
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;
                let empresas = await getEmpresasDoUsuario(user);

                if (empresaAtivaId && !empresas.some(e => e.id === empresaAtivaId)) {
                    empresaAtivaId = null;
                }

                if (empresaAtivaId) {
                    empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (!empresaDocSnap.exists() || empresaDocSnap.data().status !== "ativo") {
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                        empresaDocSnap = null;
                    }
                }

                if (!empresaDocSnap) {
                    if (empresas.length === 0) {
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: user.displayName || user.email || 'Usuário', email: user.email || '', papel: 'novo' },
                            isOwner: false,
                            isAdmin,
                            papel: 'novo',
                            empresas: []
                        };
                        if (currentPage !== 'meuperfil.html') window.location.replace('meuperfil.html');
                        isProcessing = false;
                        return reject(new Error("Nenhuma empresa associada."));
                    } else if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    } else if (empresas.length > 1) {
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: user.displayName || user.email || 'Usuário', email: user.email || '', papel: 'multi' },
                            isOwner: false,
                            isAdmin,
                            papel: 'multi',
                            empresas
                        };
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        isProcessing = false;
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    } else if (isAdmin) {
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: "Administrador", email: user.email || '', papel: "admin" },
                            isOwner: false,
                            isAdmin: true,
                            papel: 'admin',
                            empresas: []
                        };
                        isProcessing = false;
                        return resolve(cachedSessionProfile);
                    }
                }

                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    isProcessing = false;
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                const statusAssinatura = await checkUserStatus(user, empresaData);

                let perfilDetalhado, papel;
                const isOwner = empresaData.donoId === user.uid;

                if (isOwner) {
                    perfilDetalhado = { ...empresaData, nome: user.displayName || user.email || 'Usuário', ehDono: true, status: 'ativo', email: user.email || '' };
                    papel = 'dono';
                } else if (isAdmin) {
                    perfilDetalhado = { ...empresaData, nome: "Administrador", ehDono: false, status: 'ativo', email: user.email || '' };
                    papel = 'admin';
                } else {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        isProcessing = false;
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = { ...profSnap.data(), ehDono: false };
                    papel = 'funcionario';
                }

                const sessionProfile = {
                    user,
                    empresaId: empresaAtivaId,
                    perfil: perfilDetalhado,
                    isOwner,
                    isAdmin,
                    papel,
                    empresas,
                    statusAssinatura
                };

                // 🔒 Proteção contra loop: se trial expirado, redireciona UMA vez e NÃO guarda cachedSessionProfile
                if (!isAdmin && !statusAssinatura.hasActivePlan && !statusAssinatura.isTrialActive) {
                    const lastRedirect = Number(sessionStorage.getItem('assinatura_redirected_ts') || 0);
                    const now = Date.now();
                    // se não redirecionamos nos últimos 10s, faz redirect; caso contrário evita repetir
                    if (now - lastRedirect > 10000) {
                        sessionStorage.setItem('assinatura_redirected_ts', String(now));
                        if (currentPage !== 'assinatura.html' && !window.location.pathname.includes('assinatura.html')) {
                            console.log("[DEBUG] Trial expirado, indo para assinatura.html (uma vez)");
                            window.location.replace('assinatura.html');
                        }
                    } else {
                        console.log("[DEBUG] Já redirecionado recentemente para assinatura — evitando loop.");
                    }
                    isProcessing = false;
                    return reject(new Error("Assinatura expirada."));
                }

                // só grava cache em caso de sessão válida
                cachedSessionProfile = sessionProfile;
                isProcessing = false;
                resolve(sessionProfile);

            } catch (error) {
                console.error("[DEBUG] Erro geral verificarAcesso:", error);
                isProcessing = false;
                reject(error);
            }
        });
    });
}

export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
    try { sessionStorage.removeItem('assinatura_redirected_ts'); } catch (e) { /* ignore */ }
}

export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
