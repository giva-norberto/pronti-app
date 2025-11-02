// ======================================================================
//  userService.js (REVISÃO FINAL)
// ✅ REMOVIDA A CHAMADA PARA A FUNÇÃO DE OUVINTE ANTIGA E DESNECESSÁRIA
// ✨ ADICIONADO EVENTO PARA ATUALIZAÇÃO DE TELA E PROTEÇÃO DE ROTA
// ✨ PATCH CIRÚRGICO: prevenção de loop index <-> assinatura com flags de sessão
// ✨ ATUALIZAÇÃO CIRÚRGICA: checkUserStatus agora considera campos da empresa
// =====================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

// --- Função: Garante doc do usuário e trial, sempre com nome/email ---
export async function ensureUserAndTrialDoc() {
    // Nenhuma alteração nesta função
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

// --- Função: Checa status de plano/trial corretamente ---
// ALTERAÇÃO CIRÚRGICA: agora também considera campos do documento da empresa
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };

        // 1) Verificação direta no documento do usuário (mantida)
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        console.log("[DEBUG] Usuário para checkUserStatus:", userSnap.exists() ? userSnap.data() : "não existe");
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };

        // 2) Verificações adicionais usando dados da empresa (ADICIONADAS)
        // Suporta Firestore Timestamp (has toDate()), objeto { seconds }, Date ou ISO string.
        const toMillis = (value) => {
            if (!value) return NaN;
            try {
                if (typeof value.toDate === 'function') return value.toDate().getTime();
                if (value && typeof value.seconds === 'number') return value.seconds * 1000;
                const d = new Date(value);
                return isNaN(d.getTime()) ? NaN : d.getTime();
            } catch (e) {
                return NaN;
            }
        };

        const now = Date.now();

        try {
            // 2a) assinaturaValidaAte / assinatura_valida_ate + assinaturaAtiva
            const assinaturaValidaAte = empresaData?.assinaturaValidaAte || empresaData?.assinatura_valida_ate || null;
            if (empresaData?.assinaturaAtiva === true && assinaturaValidaAte) {
                const tv = toMillis(assinaturaValidaAte);
                if (!isNaN(tv) && tv > now) {
                    console.log("[DEBUG] Empresa com assinaturaAtiva e assinaturaValidaAte no futuro -> considera ativo.");
                    return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };
                }
            }

            // 2b) proximoPagamento / proximo_pagamento (se futuro -> considerar ativo)
            const proximoPag = empresaData?.proximoPagamento || empresaData?.proximo_pagamento || null;
            if (proximoPag) {
                const tp = toMillis(proximoPag);
                if (!isNaN(tp) && tp > now) {
                    console.log("[DEBUG] Empresa com proximoPagamento no futuro -> considera ativo.");
                    return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };
                }
            }

            // 2c) opcional: se campo plano === 'pago' mas sem datas, NÃO considerar automaticamente ativo
            // (evita falsos positivos). Se quiser forçar, descomente a linha abaixo.
            // if (String(empresaData?.plano || '').toLowerCase() === 'pago') return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };
        } catch (e) {
            console.warn("[DEBUG] Erro durante checagens por empresa em checkUserStatus:", e);
            // não interrompe a verificação do trial abaixo
        }

        // --- VALIDAÇÃO ADICIONAL: usar empresa.trialEndDate se presente (novo campo) ---
        // Esta validação é adicionada, mas NÃO altera o fluxo de quando verificarAcesso é chamado.
        if (empresaData?.trialEndDate) {
            const trialEndMs = toMillis(empresaData.trialEndDate);
            if (!isNaN(trialEndMs)) {
                const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                const endDate = new Date(trialEndMs);
                // garantir que consideramos o dia inteiro
                endDate.setHours(23,59,59,999);
                const ativo = endDate.getTime() >= startOfToday.getTime();
                const diasRestantes = ativo ? Math.ceil((endDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                console.log("[DEBUG] checkUserStatus: Usando empresa.trialEndDate ->", endDate, "ativo:", ativo, "diasRestantes:", diasRestantes);
                return { hasActivePlan: false, isTrialActive: ativo, trialDaysRemaining: diasRestantes };
            } else {
                console.warn("[DEBUG] checkUserStatus: empresa.trialEndDate presente mas inválido:", empresaData.trialEndDate);
            }
        }

        // Opcional: fallback curto se houver flag trialDisponivel (mantido como compatibilidade)
        if (empresaData?.trialDisponivel === true) {
            const createdAtMs = toMillis(empresaData?.createdAt);
            if (!isNaN(createdAtMs)) {
                const fallbackDays = 3;
                const endMs = createdAtMs + (fallbackDays * 24 * 60 * 60 * 1000);
                const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                const endDate = new Date(endMs);
                endDate.setHours(23,59,59,999);
                const ativo = endDate.getTime() >= startOfToday.getTime();
                const diasRestantes = ativo ? Math.ceil((endDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                console.log("[DEBUG] checkUserStatus: trialDisponivel true -> fallback createdAt + 3 dias:", endDate, "ativo:", ativo);
                return { hasActivePlan: false, isTrialActive: ativo, trialDaysRemaining: diasRestantes };
            } else {
                console.log("[DEBUG] checkUserStatus: trialDisponivel true e sem createdAt -> considera trial ativo temporariamente");
                return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
            }
        }

        // 3) Checagem de trial do usuário (mantida)
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
            console.log(`[DEBUG] Trial: start ${startDate}, end ${endDate}, hoje ${hoje}, diasRestantes ${trialDaysRemaining}, ativo? ${isTrialActive}`);
        } else {
            isTrialActive = true;
            trialDaysRemaining = trialDurationDays;
            console.log(`[DEBUG] Trial: trialStart ausente, usando padrão: diasRestantes ${trialDaysRemaining}`);
        }

        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };
    } catch (error) {
        console.error("❌ [checkUserStatus] Erro:", error);
        return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
    }
}

// --- Função robusta: busca empresas ATIVAS do usuário ---
export async function getEmpresasDoUsuario(user) {
    // Nenhuma alteração nesta função
    if (!user) return [];
    const empresasUnicas = new Map();
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
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
            const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasUnicas.has(id));
            console.log("[DEBUG] Empresas profissional ativas (IDs):", idsDeEmpresas);
            for (let i = 0; i < idsDeEmpresas.length; i += 10) {
                const chunk = idsDeEmpresas.slice(i, i + 10);
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
    } catch(e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas pelo mapa:", e);
    }
    const empresasFinal = Array.from(empresasUnicas.values());
    console.log("[DEBUG] Empresas finais (ativas e sem duplicidade):", empresasFinal.map(e => e.id));
    return empresasFinal;
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
                // ✨ NOVO: Adicionada a página 'vitrine.html' à lista de páginas públicas
                // para que a lógica de redirecionamento funcione corretamente.
                const paginasDeVitrine = ['vitrine.html'];

                if (!user) {
                    console.log("[DEBUG] Usuário não autenticado, página atual:", currentPage);
                    // ✨ LÓGICA MANTIDA: Se a página não for pública (nem de vitrine), redireciona para login.
                    if (!paginasPublicas.includes(currentPage) && !paginasDeVitrine.includes(currentPage)) {
                        window.location.replace('login.html');
                    }
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

                if (empresaAtivaId && !empresas.some(e => e.id === empresaAtivaId)) { empresaAtivaId = null; }

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
                    if (empresas.length === 0) {
                        console.log("[DEBUG] Nenhuma empresa associada ao usuário.");
                        cachedSessionProfile = {
                            user,
                            empresaId: null,
                            perfil: { nome: user.displayName || user.email || 'Usuário', email: user.email || '', papel: 'novo' },
                            isOwner: false,
                            isAdmin: isAdmin,
                            papel: 'novo',
                            empresas: []
                        };
                        if (currentPage !== 'meuperfil.html') {
                            window.location.replace('meuperfil.html');
                        }
                        isProcessing = false;
                        return reject(new Error("Nenhuma empresa associada."));
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

                const statusAssinatura = await checkUserStatus(user, empresaData);
                console.log("[DEBUG] Status assinatura/trial:", statusAssinatura);

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

                // --- INÍCIO: PATCH CIRÚRGICO ANTI-LOOP ---
                // lê flags de sessão que previnem loops entre index <-> assinatura
                let assinaturaVerifiedTs = 0;
                let assinaturaRedirectTs = 0;
                try {
                    assinaturaVerifiedTs = Number(sessionStorage.getItem('assinatura_verified_ts') || 0);
                    assinaturaRedirectTs = Number(sessionStorage.getItem('assinatura_redirect_ts') || 0);
                } catch (e) {
                    assinaturaVerifiedTs = 0;
                    assinaturaRedirectTs = 0;
                }
                const nowTs = Date.now();
                const ASSINATURA_SKIP_WINDOW_MS = 15000; // 15s tolerância

                // se a empresa tem plano ativo, grava flag de verificação para evitar loop
                try {
                    if (sessionProfile?.statusAssinatura?.hasActivePlan) {
                        try {
                            sessionStorage.setItem('assinatura_verified_ts', String(nowTs));
                            console.log("[DEBUG] assinatura_verified_ts setado para evitar loop.");
                        } catch (e) { /* ignore */ }
                    }
                } catch (e) {
                    console.warn("[DEBUG] Falha ao setar assinatura_verified_ts:", e);
                }

                // calcula skip se qualquer flag recente indicar que devemos pular redirect
                const skipRedirectToAssinatura = (
                    (assinaturaVerifiedTs && (nowTs - assinaturaVerifiedTs) < ASSINATURA_SKIP_WINDOW_MS) ||
                    (assinaturaRedirectTs && (nowTs - assinaturaRedirectTs) < ASSINATURA_SKIP_WINDOW_MS)
                );
                // --- FIM: PATCH CIRÚRGICO ANTI-LOOP ---

                if (!isAdmin && !statusAssinatura.hasActivePlan && !statusAssinatura.isTrialActive && currentPage !== 'assinatura.html' && !skipRedirectToAssinatura) {
                    console.log("[DEBUG] Assinatura expirada, redirecionando para assinatura.");
                    try {
                        // marca que estamos prestes a redirecionar — ajuda a evitar loop imediato
                        try {
                            sessionStorage.setItem('assinatura_redirect_ts', String(Date.now()));
                        } catch (e) { /* ignore */ }
                    } catch (e) {
                        console.warn("[DEBUG] Falha ao setar assinatura_redirect_ts:", e);
                    }
                    window.location.replace('assinatura.html');
                    cachedSessionProfile = sessionProfile;
                    isProcessing = false;
                    return reject(new Error("Assinatura expirada."));
                }

                // ✨ NOVO: Adição 1 - Impedir que Dono/Admin fique na vitrine.
                // Se o usuário for dono ou admin e estiver na página de vitrine,
                // ele será redirecionado para o painel principal.
                // Altere 'painel.html' para a página principal do seu sistema.
                if ((sessionProfile.isOwner || sessionProfile.isAdmin) && paginasDeVitrine.includes(currentPage)) {
                    console.log(`[DEBUG] Dono/Admin na página de vitrine. Redirecionando para o painel...`);
                    window.location.replace('painel.html'); 
                    // A linha acima causa um redirecionamento, então o código abaixo pode não ser executado.
                    // Isso é intencional para evitar que a página de vitrine seja renderizada.
                }

                cachedSessionProfile = sessionProfile;
                
                // ✨ NOVO: Adição 2 - Mecanismo para atualizar a tela.
                // Dispara um evento global com os dados da sessão. Outras partes do seu
                // app podem "ouvir" este evento e se atualizar sem precisar chamar
                // verificarAcesso() novamente.
                // Exemplo de como usar em outro arquivo:
                // window.addEventListener('sessionProfileReady', (event) => {
                //   const profile = event.detail;
                //   console.log('Sessão pronta, atualizando UI!', profile);
                //   document.getElementById('userName').textContent = profile.perfil.nome;
                // });
                window.dispatchEvent(new CustomEvent('sessionProfileReady', { detail: sessionProfile }));

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
    // Nenhuma alteração nesta função
    cachedSessionProfile = null;
    isProcessing = false;
}

export async function getTodasEmpresas() {
    // Nenhuma alteração nesta função
    const empresasCol = collection(db, "empresarios");
    const snap = await getDocs(empresasCol);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
