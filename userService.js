// ======================================================================
//      USER-SERVICE.JS (DEBUG COMPLETO - CORRIGIDO, SEM MISTURA, TRIAL, NOME, EMPRESAS ATIVAS)
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
// ---> ESTA É A VERSÃO FINAL E CORRETA DA LÓGICA DE TRIAL <---
// ==================================================================================
async function checkUserStatus(userId, empresaData) {
    try {
        if (!userId) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        const userRef = doc(db, "usuarios", userId);
        const userSnap = await getDoc(userRef);
        console.log("[DEBUG] Usuário para checkUserStatus (" + userId + "):", userSnap.exists() ? userSnap.data() : "não existe");
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };

        const trialDurationDays = empresaData?.freeEmDias ?? 0; // Se 'freeEmDias' não existir, considera 0.
        let trialDaysRemaining = 0;
        let isTrialActive = false;

        // REGRA 1: CONTROLE MANUAL (A "PALAVRA FINAL").
        // Se 'freeEmDias' for 0, o trial é FORÇADO como expirado, ignorando o cálculo de datas.
        if (trialDurationDays <= 0) {
            console.log(`[DEBUG] Trial FORÇADO como expirado pois freeEmDias é ${trialDurationDays}.`);
            return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
        }

        // REGRA 2: CÁLCULO DE TEMPO (O "CONTADOR NORMAL") + REAJUSTE SE freeEmDias AUMENTAR.
        if (userData.trialStart?.seconds) {
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            if (endDate >= hoje) {
                // dentro do prazo atual
                isTrialActive = true;
                trialDaysRemaining = Math.ceil((endDate - hoje) / (1000 * 60 * 60 * 24));
            } else {
                // prazo antigo expirou, mas se freeEmDias foi aumentado, concede novo prazo a partir de hoje
                isTrialActive = true;
                trialDaysRemaining = trialDurationDays;
                console.log("[DEBUG] Trial expirado, mas freeEmDias aumentou: reiniciando contagem a partir de hoje.");
            }

            console.log(`[DEBUG] Cálculo de trial: Início=${startDate.toLocaleDateString()}, Duração=${trialDurationDays} dias, Fim=${endDate.toLocaleDateString()}, Ativo?=${isTrialActive}`);
        } else {
            // Caso raro onde o usuário não tem trialStart, mas a empresa tem dias de trial. Considera ativo.
            isTrialActive = true;
            trialDaysRemaining = trialDurationDays;
        }
        
        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };

    } catch (error) {
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: false, trialDaysRemaining: 0 };
    }
}
// ==================================================================================
// ---> FIM DA ALTERAÇÃO <---
// ==================================================================================


// --- Função robusta: busca empresas ATIVAS do usuário (dono e profissional, sem duplicidade e SEM misturar dados) ---
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasUnicas = new Map();

    // DONO: só empresas ativas
    try {
        const qDono = query(
            collection(db, "empresarios"),
            where("donoId", "==", user.uid),
            where("status", "==", "ativo")
        );
        const snapshotDono = await getDocs(qDono);
        console.log("[DEBUG] Empresas dono ativas:", snapshotDono.docs.map(doc => doc.id));
        snapshotDono.forEach(doc => {
            empresasUnicas.set(doc.id, { id: doc.id, ...doc.data() });
        });
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas como dono:", e);
    }

    // PROFISSIONAL: só empresas ativas, sem duplicidade, chunk de 10
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
            const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasUnicas.has(id));
            console.log("[DEBUG] Empresas profissional ativas (IDs):", idsDeEmpresas);
            for (let i = 0; i < idsDeEmpresas.length; i += 10) {
                const chunk = idsDeEmpresas.slice(i, i + 10);
                if (chunk.length > 0) { // Garante que o chunk não está vazio
                    const q = query(
                        collection(db, "empresarios"),
                        where(documentId(), "in", chunk),
                        where("status", "==", "ativo")
                    );
                    const snap = await getDocs(q);
                    console.log("[DEBUG] Chunk empresas profissionais ativas:", snap.docs.map(doc => doc.id));
                    snap.forEach(doc => empresasUnicas.set(doc.id, { id: doc.id, ...doc.data() }));
                }
            }
        }
    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas pelo mapa:", e);
    }
    const empresasFinal = Array.from(empresasUnicas.values());
    console.log("[DEBUG] Empresas finais (ativas e sem duplicidade):", empresasFinal.map(e => e.id));
    return empresasFinal;
}


// ---> ALTERAÇÃO 2/3: Nova função EXPORTADA para ser usada na tela 'selecionar-empresa'.
// Ela reutiliza suas funções existentes para retornar as empresas já com o status de assinatura.
export async function getEmpresasComStatus() {
    const user = auth.currentUser;
    if (!user) return [];

    const empresas = await getEmpresasDoUsuario(user);

    const empresasComStatus = await Promise.all(
        empresas.map(async (empresa) => {
            const status = await checkUserStatus(empresa.donoId, empresa);
            return {
                ...empresa,
                statusAssinatura: status
            };
        })
    );
    
    return empresasComStatus;
}


// ======================================================================
// FUNÇÃO GUARDA PRINCIPAL: Valida sessão, empresa ativa, plano, permissões
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) {
        console.log("[DEBUG] cachedSessionProfile retornado:", cachedSessionProfile);
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
                // ======================= INÍCIO DA 1ª ALTERAÇÃO CIRÚRGICA =======================
                // Adicionado 'meuperfil.html' para consistência.
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'meuperfil.html'];
                // ======================== FIM DA 1ª ALTERAÇÃO CIRÚRGICA =========================

                if (!user) {
                    console.log("[DEBUG] Usuário não autenticado, página atual:", currentPage);
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

                console.log("[DEBUG] Empresa ativaId localStorage:", empresaAtivaId);
                console.log("[DEBUG] Empresas retornadas:", empresas.map(e => e.id));

                if (empresaAtivaId && !empresas.some(e => e.id === empresaAtivaId)) {
                    empresaAtivaId = null;
                }

                if (empresaAtivaId) {
                    empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (!empresaDocSnap.exists() || empresaDocSnap.data().status !== "ativo") {
                        console.log("[DEBUG] Empresa ativa não existe ou não está ativa, limpando localStorage.");
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                        empresaDocSnap = null;
                    } else {
                        console.log("[DEBUG] Empresa ativa encontrada:", empresaDocSnap.id, empresaDocSnap.data());
                    }
                }

                if (!empresaDocSnap) {
                    // ======================= INÍCIO DA 2ª ALTERAÇÃO CIRÚRGICA =======================
                    // Removemos a condição '!isAdmin' para que TODOS os usuários sem empresa,
                    // incluindo o admin, passem por este fluxo.
                    if (empresas.length === 0) {
                        console.log("[DEBUG] Nenhuma empresa associada ao usuário.");
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: user.displayName || user.email || 'Usuário', email: user.email || '', papel: 'novo' },
                            isOwner: false,
                            isAdmin: isAdmin, // Mantém o status de admin
                            papel: 'novo',
                            empresas: []
                        };
                        // Corrigimos o redirecionamento para 'meuperfil.html'.
                        if (currentPage !== 'meuperfil.html') {
                            window.location.replace('meuperfil.html');
                        }
                        isProcessing = false;
                        return reject(new Error("Nenhuma empresa associada."));
                    // ======================== FIM DA 2ª ALTERAÇÃO CIRÚRGICA =========================
                    } else if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                        console.log("[DEBUG] Empresa única ativada:", empresaAtivaId, empresaDocSnap.data());
                    } else if (empresas.length > 1) {
                        console.log("[DEBUG] Usuário tem múltiplas empresas, precisa selecionar.", empresas.map(e => e.id));
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: user.displayName || user.email || 'Usuário', email: user.email || '', papel: 'multi' },
                            isOwner: false,
                            isAdmin: isAdmin,
                            papel: 'multi',
                            empresas
                        };
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        isProcessing = false;
                        return reject(new Error("Múltiplas empresas, seleção necessária."));
                    } else if (isAdmin) {
                        console.log("[DEBUG] Usuário é admin, acesso total.");
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
                    console.log("[DEBUG] Empresa ativa não encontrada!");
                    isProcessing = false;
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                console.log("[DEBUG] Dados da empresa ativa:", empresaData);

                // ---> ALTERAÇÃO 3/3: A chamada agora usa o 'donoId' da empresa, e não o usuário logado.
                // Isso corrige a lógica central de verificação de assinatura.
                const statusAssinatura = await checkUserStatus(empresaData.donoId, empresaData);
                console.log("[DEBUG] Status assinatura/trial (baseado no dono):", statusAssinatura);

                let perfilDetalhado, papel;
                const isOwner = empresaData.donoId === user.uid;

                if (isOwner) {
                    perfilDetalhado = { ...empresaData, nome: user.displayName || user.email || 'Usuário', ehDono: true, status: 'ativo', email: user.email || '' };
                    papel = 'dono';
                    console.log("[DEBUG] Perfil do usuário (dono):", perfilDetalhado);
                } else if (isAdmin) {
                    perfilDetalhado = { ...empresaData, nome: "Administrador", ehDono: false, status: 'ativo', email: user.email || '' };
                    papel = 'admin';
                    console.log("[DEBUG] Perfil do usuário (admin):", perfilDetalhado);
                } else {
                    const profSnap = await getDoc(doc(db, "empresarios", empresaAtivaId, "profissionais", user.uid));
                    if (!profSnap.exists() || profSnap.data().status !== 'ativo') {
                        console.log("[DEBUG] Profissional não está ativo ou não existe, limpando empresaAtivaId e voltando pro login.");
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        isProcessing = false;
                        return reject(new Error("Acesso de profissional revogado ou pendente."));
                    }
                    perfilDetalhado = { ...profSnap.data(), ehDono: false };
                    papel = 'funcionario';
                    console.log("[DEBUG] Perfil do usuário (funcionario):", perfilDetalhado);
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
                console.log("[DEBUG] SessionProfile FINAL:", sessionProfile);

                if (!isAdmin && !statusAssinatura.hasActivePlan && !statusAssinatura.isTrialActive && currentPage !== 'assinatura.html') {
                    console.log("[DEBUG] Assinatura expirada, redirecionando para assinatura.");
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
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
