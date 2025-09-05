// ======================================================================
// USERSERVICE.JS (MULTIEMPRESAS: ENTRA DIRETO SE SÓ TEM UMA EMPRESA - REVISADO + DEBUG + MENUTRAVA FIX)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;

// --- Garante que o usuário tem um doc na coleção "usuarios" e trial ativo ---
export async function ensureUserAndTrialDoc() {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.debug("[DEBUG][ensureUserAndTrialDoc] Criando usuário na coleção 'usuarios':", user.uid);
        await setDoc(userRef, {
            nome: user.displayName || user.email,
            email: user.email,
            trialStart: serverTimestamp(),
            isPremium: false,
        });
    } else if (!userSnap.data().trialStart) {
        console.debug("[DEBUG][ensureUserAndTrialDoc] Adicionando trialStart para usuário:", user.uid);
        await updateDoc(userRef, {
            trialStart: serverTimestamp(),
        });
    }
}

// --- Checa status do usuário/plano ---
async function checkUserStatus(user, empresaData) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.debug("[DEBUG][checkUserStatus] Usuário não existe na coleção 'usuarios':", user.uid);
        return { hasActivePlan: false, isTrialActive: true };
    }
    const userData = userSnap.data();
    if (userData.isPremium === true) {
        console.debug("[DEBUG][checkUserStatus] Usuário é premium:", user.uid);
        return { hasActivePlan: true, isTrialActive: false };
    }
    if (!userData.trialStart?.seconds) {
        console.debug("[DEBUG][checkUserStatus] Usuário sem trialStart:", user.uid);
        return { hasActivePlan: false, isTrialActive: true };
    }
    let trialDurationDays = 15;
    if (empresaData && empresaData.freeEmDias !== undefined) {
        trialDurationDays = empresaData.freeEmDias;
    }
    const startDate = new Date(userData.trialStart.seconds * 1000);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + trialDurationDays);
    const trialActive = endDate > new Date();
    console.debug(`[DEBUG][checkUserStatus] Trial ativo? ${trialActive} | premium: ${userData.isPremium} | trialEnd: ${endDate}`);
    return { hasActivePlan: false, isTrialActive: trialActive };
}

// --- Autenticação, multiempresas: entra direto se só tem uma empresa ---
export async function verificarAcesso() {
    // Sempre invalida cache se empresa ativa mudou (para evitar travar menu)
    const empresaAtivaId = localStorage.getItem('empresaAtivaId');
    if (
        cachedSessionProfile &&
        cachedSessionProfile.empresaId &&
        empresaAtivaId &&
        cachedSessionProfile.empresaId !== empresaAtivaId
    ) {
        cachedSessionProfile = null;
    }

    if (cachedSessionProfile) {
        console.debug("[DEBUG][verificarAcesso] Retornando sessão cache:", cachedSessionProfile);
        return Promise.resolve(cachedSessionProfile);
    }

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            const currentPage = window.location.pathname.split('/').pop();
            const paginasPublicas = ['login.html', 'cadastro.html'];
            const paginasDeConfiguracao = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html'];

            console.debug(`[DEBUG][verificarAcesso] Página atual: ${currentPage}`);
            console.debug("[DEBUG][verificarAcesso] Usuário Firebase:", user);

            // 1. Usuário não logado
            if (!user) {
                console.debug("[DEBUG][verificarAcesso] Usuário não autenticado.");
                if (!paginasPublicas.includes(currentPage)) {
                    window.location.replace('login.html');
                }
                return reject(new Error("Utilizador não autenticado."));
            }

            try {
                await ensureUserAndTrialDoc();

                // 2. Admin
                const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                if (user.uid === ADMIN_UID) {
                    console.debug("[DEBUG][verificarAcesso] Usuário é admin:", user.uid);
                    cachedSessionProfile = {
                        user,
                        isAdmin: true,
                        perfil: { nome: "Admin" },
                        isOwner: true,
                        role: 'admin',
                        empresaId: null
                    };
                    return resolve(cachedSessionProfile);
                }

                // 3. Buscar empresas do usuário (multiempresas)
                const empresasCol = collection(db, "empresarios");
                const empresasSnap = await getDocs(empresasCol);
                const empresasDoUsuario = [];
                empresasSnap.forEach(docRef => {
                    const empresaData = docRef.data();
                    const isOwner = empresaData.donoId === user.uid;
                    let isProfissional = false;
                    let ehDonoProfissional = false;
                    if (empresaData.profissionais && Array.isArray(empresaData.profissionais)) {
                        isProfissional = empresaData.profissionais.some(prof =>
                            prof && prof.uid === user.uid
                        );
                        ehDonoProfissional = empresaData.profissionais.some(prof =>
                            prof && prof.uid === user.uid && (prof.ehDono === true || prof.ehDono === "true")
                        );
                    }
                    const isDonoFinal = isOwner || ehDonoProfissional;
                    if (isDonoFinal || isProfissional) {
                        empresasDoUsuario.push({
                            id: docRef.id,
                            nome: empresaData.nome || 'Empresa sem nome',
                            isDono: isDonoFinal,
                            isProfissional,
                            empresaData
                        });
                    }
                });
                console.debug("[DEBUG][verificarAcesso] Empresas do usuário:", empresasDoUsuario);

                // 4. Validação de múltiplas empresas
                if (empresasDoUsuario.length === 0) {
                    console.debug("[DEBUG][verificarAcesso] Usuário sem empresas vinculadas!");
                    if (!paginasDeConfiguracao.includes(currentPage)) {
                        window.location.replace('selecionar-empresa.html');
                    }
                    return reject(new Error("Sem empresa vinculada."));
                }

                // --- ENTRA DIRETO SE SÓ TEM UMA EMPRESA ---
                let empresaSelecionadaId = localStorage.getItem('empresaAtivaId');
                let empresaEscolhida = null;

                if (empresasDoUsuario.length === 1) {
                    empresaEscolhida = empresasDoUsuario[0];
                    if (empresaSelecionadaId !== empresaEscolhida.id) {
                        console.debug("[DEBUG][verificarAcesso] Definindo única empresa ativa:", empresaEscolhida.id);
                        localStorage.setItem('empresaAtivaId', empresaEscolhida.id);
                        empresaSelecionadaId = empresaEscolhida.id;
                    }
                } else {
                    // Mais de uma empresa, precisa selecionar
                    if (!empresaSelecionadaId || !empresasDoUsuario.find(emp => emp.id === empresaSelecionadaId)) {
                        console.debug("[DEBUG][verificarAcesso] Multiempresas: necessário selecionar empresa.");
                        if (!paginasDeConfiguracao.includes(currentPage) && currentPage !== 'selecionar-empresa.html') {
                            window.location.replace('selecionar-empresa.html');
                        }
                        return reject(new Error("Multiempresas: necessário selecionar empresa."));
                    }
                    empresaEscolhida = empresasDoUsuario.find(emp => emp.id === empresaSelecionadaId);
                    console.debug("[DEBUG][verificarAcesso] Empresa selecionada:", empresaSelecionadaId, empresaEscolhida);
                }

                // 5. Verificar status da assinatura
                console.debug("[DEBUG][verificarAcesso] Verificando status da assinatura...");
                const { hasActivePlan, isTrialActive } = await checkUserStatus(user, empresaEscolhida.empresaData);
                console.debug(`[DEBUG][verificarAcesso] Plano ativo: ${hasActivePlan} | Trial ativo: ${isTrialActive}`);
                if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                    console.debug("[DEBUG][verificarAcesso] Assinatura expirada! Redirecionando.");
                    window.location.replace('assinatura.html');
                    return reject(new Error("Assinatura expirada."));
                }

                // 6. Determinar perfil: dono, admin ou funcionário
                const isOwner = empresaEscolhida.empresaData.donoId === user.uid;
                let userProfile = null;

                if (isOwner) {
                    console.debug("[DEBUG][verificarAcesso] Usuário é dono da empresa:", empresaEscolhida.id);
                    userProfile = {
                        user,
                        empresaId: empresaEscolhida.id,
                        perfil: empresaEscolhida.empresaData,
                        isOwner: true,
                        isAdmin: false,
                        role: "dono"
                    };
                } else {
                    // Verifica funcionário ativo na SUBCOLEÇÃO profissionais
                    const profissionalRef = doc(db, "empresarios", empresaEscolhida.id, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);

                    if (profissionalSnap.exists() && profissionalSnap.data().status === 'ativo') {
                        console.debug("[DEBUG][verificarAcesso] Usuário é funcionário ativo:", empresaEscolhida.id);
                        userProfile = {
                            user,
                            perfil: profissionalSnap.data(),
                            empresaId: empresaEscolhida.id,
                            isOwner: false,
                            isAdmin: false,
                            role: "funcionario"
                        };
                    } else {
                        console.debug("[DEBUG][verificarAcesso] Usuário não é dono nem funcionário ativo. Bloqueando.");
                        if (!paginasPublicas.includes(currentPage)) {
                            window.location.replace('login.html');
                        }
                        return reject(new Error("funcionario_inativo"));
                    }
                }

                cachedSessionProfile = userProfile;
                console.debug("[DEBUG][verificarAcesso] Sessão definida:", cachedSessionProfile);
                resolve(userProfile);

            } catch (error) {
                console.debug("[DEBUG][verificarAcesso] ERRO:", error);
                reject(error);
            }
        });
    });
}
