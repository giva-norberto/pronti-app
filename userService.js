// ======================================================================
//      USER-SERVICE.JS (VERSÃO FINAL CORRIGIDA - TRIAL, NOME, EMPRESAS ATIVAS)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
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
            // Garante nome, email e trialStart SEMPRE
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

// --- Função: Checa status de plano/trial corretamente ---
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };

        let trialDurationDays = empresaData?.freeEmDias ?? 15;
        let trialDaysRemaining = 0;
        let isTrialActive = false;

        if (userData.trialStart?.seconds) {
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (endDate >= hoje) {
                isTrialActive = true;
                trialDaysRemaining = Math.ceil((endDate - hoje) / (1000 * 60 * 60 * 24));
            }
        } else {
            isTrialActive = true;
            trialDaysRemaining = trialDurationDays;
        }
        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };
    } catch (error) {
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
    }
}

// --- Função robusta: busca empresas ATIVAS do usuário (dono e profissional, sem duplicidade) ---
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();

    // DONO: só empresas ativas
    try {
        const qDono = query(
            collection(db, "empresarios"),
            where("donoId", "==", user.uid),
            where("status", "==", "ativo")
        );
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => {
            empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() });
        });
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas como dono:", e);
    }

    // PROFISSIONAL: só empresas ativas, sem duplicidade, chunk de 10
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
            const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasEncontradas.has(id));
            for (let i = 0; i < idsDeEmpresas.length; i += 10) {
                const chunk = idsDeEmpresas.slice(i, i + 10);
                const q = query(
                    collection(db, "empresarios"),
                    where(documentId(), "in", chunk),
                    where("status", "==", "ativo")
                );
                const snap = await getDocs(q);
                snap.forEach(doc => empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() }));
            }
        }
    } catch(e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas pelo mapa:", e);
    }
    return Array.from(empresasEncontradas.values());
}

// ======================================================================
// FUNÇÃO GUARDA PRINCIPAL: Valida sessão, empresa ativa, plano, permissões
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
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'nova-empresa.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    isProcessing = false;
                    return reject(new Error("Utilizador não autenticado."));
                }

                await ensureUserAndTrialDoc();
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isAdmin = user.uid === ADMIN_UID;
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;
                let empresas = await getEmpresasDoUsuario(user);

                // Tenta usar empresa ativa salva, só se for ativa
                if (empresaAtivaId && empresas.find(e => e.id === empresaAtivaId)) {
                    empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (!empresaDocSnap.exists() || empresaDocSnap.data().status !== "ativo") {
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                        empresaDocSnap = null;
                    }
                }

                // Seleção de empresa correta
                if (!empresaDocSnap) {
                    if (empresas.length === 0 && !isAdmin) {
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: user.displayName || user.email || 'Usuário', email: user.email || '', papel: 'novo' },
                            isOwner: false,
                            isAdmin: false,
                            papel: 'novo',
                            empresas: []
                        };
                        if (currentPage !== 'nova-empresa.html') window.location.replace('nova-empresa.html');
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
                            isAdmin: false,
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
                            isOwner: true,
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

                // Monta perfil ANTES do bloqueio
                let perfilDetalhado, papel, isOwner;
                isOwner = empresaData.donoId === user.uid;

                if (isOwner || isAdmin) {
                    perfilDetalhado = { ...empresaData, nome: user.displayName || user.email || 'Usuário', ehDono: true, status: 'ativo', email: user.email || '' };
                    papel = 'dono';
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
                    isOwner: isOwner || isAdmin,
                    isAdmin: isAdmin,
                    papel,
                    empresas,
                    statusAssinatura
                };

                // Bloqueio correto de assinatura/trial
                if (!isAdmin && !statusAssinatura.hasActivePlan && !statusAssinatura.isTrialActive && currentPage !== 'assinatura.html') {
                    window.location.replace('assinatura.html');
                    cachedSessionProfile = sessionProfile;
                    isProcessing = false;
                    return reject(new Error("Assinatura expirada."));
                }

                cachedSessionProfile = sessionProfile;
                isProcessing = false;
                resolve(sessionProfile);

            } catch (error) {
                isProcessing = false;
                reject(error);
            }
        });
    });
}

export function clearCache() {
    cachedSessionProfile = null;
    isProcessing = false;
}

export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
