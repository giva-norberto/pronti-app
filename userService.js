// ======================================================================
//      USER-SERVICE.JS (DEBUG COMPLETO - CORRIGIDO, SEM MISTURA, TRIAL, NOME, EMPRESAS ATIVAS)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc,
    serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

// --- Função: garante doc do usuário e trial, sempre com nome/email ---
export async function ensureUserAndTrialDoc() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, "usuarios", user.uid);
        let userSnap = await getDoc(userRef);

        console.log("[DEBUG] Documento do usuário antes:", userSnap.exists() ? userSnap.data() : "não existe");

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário',
                email: user.email || '',
                trialStart: serverTimestamp(),
                isPremium: false,
            });
            console.log("[DEBUG] Criado doc do usuário!");
        } else {
            // Garante nome, email e trialStart SEMPRE
            const userData = userSnap.data();
            let updateObj = {};
            if (!userData.nome) updateObj.nome = user.displayName || user.email || 'Usuário';
            if (!userData.email) updateObj.email = user.email || '';
            if (!userData.trialStart) updateObj.trialStart = serverTimestamp();
            if (Object.keys(updateObj).length) {
                await updateDoc(userRef, updateObj);
                console.log("[DEBUG] Atualizado doc do usuário:", updateObj);
            }
        }
        let userSnapAfter = await getDoc(userRef);
        console.log("[DEBUG] Documento do usuário depois:", userSnapAfter.data());
    } catch (error) {
        console.error("❌ [ensureUserAndTrialDoc] Erro:", error);
    }
}

// ==================================================================================
// ---> Lógica central de verificação de assinatura/trial
// ==================================================================================
async function checkUserStatus(userId, empresaData) {
    try {
        if (!userId) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };

        const userRef = doc(db, "usuarios", userId);
        const userSnap = await getDoc(userRef);
        console.log("[DEBUG] checkUserStatus usuário:", userSnap.exists() ? userSnap.data() : "não existe");

        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };

        const userData = userSnap.data();
        if (userData.isPremium === true) {
            return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };
        }

        const trialDurationDays = empresaData?.freeEmDias ?? 0;
        let trialDaysRemaining = 0;
        let isTrialActive = false;

        // Regra 1: controle manual tem a palavra final
        if (trialDurationDays <= 0) {
            console.log(`[DEBUG] Trial FORÇADO como expirado (freeEmDias=${trialDurationDays})`);
            return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        }

        // Regra 2: cálculo normal com possível reajuste
        if (userData.trialStart?.seconds) {
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            if (endDate >= hoje) {
                isTrialActive = true;
                trialDaysRemaining = Math.ceil((endDate - hoje) / (1000 * 60 * 60 * 24));
            } else {
                // prazo expirou, mas se freeEmDias aumentou, reinicia a contagem
                isTrialActive = true;
                trialDaysRemaining = trialDurationDays;
                console.log("[DEBUG] Trial expirado, mas freeEmDias aumentou: reiniciando contagem a partir de hoje.");
            }

            console.log(`[DEBUG] Trial: início=${startDate.toLocaleDateString()} duração=${trialDurationDays} fim=${endDate.toLocaleDateString()} ativo=${isTrialActive}`);
        } else {
            // sem trialStart mas empresa tem dias de trial
            isTrialActive = true;
            trialDaysRemaining = trialDurationDays;
        }

        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };
    } catch (error) {
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
    }
}

// --- Busca empresas ativas do usuário (dono ou profissional) ---
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasUnicas = new Map();

    // Dono
    try {
        const qDono = query(
            collection(db, "empresarios"),
            where("donoId", "==", user.uid),
            where("status", "==", "ativo")
        );
        const snapshotDono = await getDocs(qDono);
        console.log("[DEBUG] Empresas dono ativas:", snapshotDono.docs.map(d => d.id));
        snapshotDono.forEach(d => empresasUnicas.set(d.id, { id: d.id, ...d.data() }));
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro dono:", e);
    }

    // Profissional
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
            const ids = mapaSnap.data().empresas.filter(id => !empresasUnicas.has(id));
            console.log("[DEBUG] Empresas profissional IDs:", ids);
            for (let i = 0; i < ids.length; i += 10) {
                const chunk = ids.slice(i, i + 10);
                if (chunk.length > 0) {
                    const q = query(
                        collection(db, "empresarios"),
                        where(documentId(), "in", chunk),
                        where("status", "==", "ativo")
                    );
                    const snap = await getDocs(q);
                    snap.forEach(d => empresasUnicas.set(d.id, { id: d.id, ...d.data() }));
                }
            }
        }
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro profissional:", e);
    }

    const empresasFinal = Array.from(empresasUnicas.values());
    console.log("[DEBUG] Empresas finais:", empresasFinal.map(e => e.id));
    return empresasFinal;
}

// Retorna empresas já com status de assinatura
export async function getEmpresasComStatus() {
    const user = auth.currentUser;
    if (!user) return [];
    const empresas = await getEmpresasDoUsuario(user);
    return Promise.all(empresas.map(async e => ({
        ...e,
        statusAssinatura: await checkUserStatus(e.donoId, e)
    })));
}

// ======================================================================
// Guarda principal: valida sessão, empresa ativa, plano, permissões
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        console.log("[DEBUG] cachedSessionProfile:", cachedSessionProfile);
        return cachedSessionProfile;
    }
    if (isProcessing) throw new Error("Race condition detectada.");
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html', 'recuperar-senha.html'];
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'meuperfil.html'];

                if (!user) {
                    console.log("[DEBUG] Usuário não autenticado");
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
                    } else {
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
                    }
                }

                if (!empresaDocSnap || !empresaDocSnap.exists()) {
                    isProcessing = false;
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                const statusAssinatura = await checkUserStatus(empresaData.donoId, empresaData);

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

                if (!isAdmin && !statusAssinatura.hasActivePlan &&
                    !statusAssinatura.isTrialActive && currentPage !== 'assinatura.html') {
                    window.location.replace('assinatura.html');
                    cachedSessionProfile = sessionProfile;
                    isProcessing = false;
                    return reject(new Error("Assinatura expirada."));
                }

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
}

export async function getTodasEmpresas() {
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
