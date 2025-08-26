// ======================================================================
//                      USERSERVICE.JS
//           VERSÃO DE DIAGNÓSTICO FINAL (MODO FALADOR)
// ======================================================================

// Imports (sem alterações)
import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

// Funções Auxiliares (sem alterações )
async function getEmpresasDoDono(uid) { /* ...código inalterado... */ }
export async function ensureUserAndTrialDoc() { /* ...código inalterado... */ }

// ======================================================================
// FUNÇÃO PRINCIPAL COM LOGS DETALHADOS
// ======================================================================
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                console.log("[DIAGNÓSTICO] Nenhum usuário logado. Redirecionando para login.html.");
                window.location.href = 'login.html';
                return reject(new Error("Utilizador não autenticado."));
            }
            
            console.log(`[DIAGNÓSTICO] Usuário ${user.uid} detectado. Iniciando verificação de acesso.`);
            const currentPage = window.location.pathname.split('/').pop();
            const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

            // Etapa 1: Tratar o Admin
            if (user.uid === ADMIN_UID) {
                console.log("[DIAGNÓSTICO] Usuário é ADMIN. Concedendo acesso total.");
                // ... (lógica do admin)
                return resolve({ user, isAdmin: true, perfil: { nome: "Administrador", nomeFantasia: "Painel de Controle" }, isOwner: true, role: 'admin' });
            }

            // Etapa 2: Buscar dados essenciais para o usuário normal
            console.log("[DIAGNÓSTICO] Usuário não é Admin. Buscando dados no Firestore...");
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            const empresasSnapshot = await getEmpresasDoDono(user.uid);
            console.log(`[DIAGNÓSTICO] Documento 'usuarios': ${userSnap.exists() ? 'Encontrado' : 'NÃO Encontrado'}.`);
            console.log(`[DIAGNÓSTICO] Documento 'empresarios': ${empresasSnapshot && !empresasSnapshot.empty ? 'Encontrado' : 'NÃO Encontrado'}.`);

            // Etapa 3: Verificar se tem vínculo
            if ((empresasSnapshot && !empresasSnapshot.empty) || (userSnap.exists() && userSnap.data().empresaId)) { // Adicionado verificação de empresaId no userSnap
                console.log("[DIAGNÓSTICO] Vínculo de empresa encontrado. Prosseguindo para verificação de assinatura.");

                // Etapa 3a: Verificar Assinatura
                const userData = userSnap.data();
                if (userData.isPremium === true) {
                    console.log("[DIAGNÓSTICO] Assinatura: isPremium é TRUE. Acesso concedido.");
                } else {
                    console.log("[DIAGNÓSTICO] Assinatura: isPremium é FALSE. Verificando trial.");
                    
                    let trialDurationDays = 15;
                    if (empresasSnapshot && !empresasSnapshot.empty) {
                        const empresaData = empresasSnapshot.docs[0].data();
                        if (empresaData.freeEmDias !== undefined) {
                            trialDurationDays = empresaData.freeEmDias;
                            console.log(`[DIAGNÓSTICO] Trial: Dias de teste definidos pela empresa: ${trialDurationDays}`);
                        } else {
                            console.log("[DIAGNÓSTICO] Trial: Campo 'freeEmDias' não encontrado na empresa. Usando padrão de 15 dias.");
                        }
                    } else {
                         console.log("[DIAGNÓSTICO] Trial: Nenhuma empresa encontrada para o dono. Usando padrão de 15 dias.");
                    }

                    if (userData.trialStart?.seconds) {
                        const startDate = new Date(userData.trialStart.seconds * 1000);
                        const endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + trialDurationDays);
                        const hoje = new Date();

                        console.log(`[DIAGNÓSTICO] Trial: Início em ${startDate.toLocaleDateString()}`);
                        console.log(`[DIAGNÓSTICO] Trial: Expira em ${endDate.toLocaleDateString()}`);
                        console.log(`[DIAGNÓSTICO] Trial: Hoje é ${hoje.toLocaleDateString()}`);

                        if (endDate > hoje) {
                            console.log("[DIAGNÓSTICO] DECISÃO: Trial ATIVO. Acesso concedido.");
                        } else {
                            console.log("[DIAGNÓSTICO] DECISÃO: Trial EXPIRADO. Bloqueando acesso.");
                            if (currentPage !== 'assinatura.html') {
                                window.location.href = 'assinatura.html';
                            }
                            return reject(new Error("Assinatura expirada."));
                        }
                    } else {
                        console.log("[DIAGNÓSTICO] DECISÃO: Campo 'trialStart' não encontrado. Considerado trial ATIVO por segurança. Acesso concedido.");
                    }
                }
                
                // Se chegou aqui, o acesso foi concedido. Prossiga com a lógica de perfil.
                console.log("[DIAGNÓSTICO] Acesso concedido. Resolvendo perfil...");
                // ... (lógica de perfil de dono e funcionário)
                if (empresasSnapshot && !empresasSnapshot.empty) {
                    const empresaDoc = empresasSnapshot.docs[0];
                    const empresaData = empresaDoc.data();
                    empresaData.nome = userData.nome || user.displayName;
                    return resolve({ user, empresaId: empresaDoc.id, perfil: empresaData, isOwner: true, role: "dono" });
                }
                // ... etc
            }

            // Etapa 4: Primeiro Acesso
            console.log("[DIAGNÓSTICO] DECISÃO: Nenhum vínculo encontrado. Rejeitando como 'primeiro_acesso'.");
            return reject(new Error("primeiro_acesso"));
        });
    });
}
