// ======================================================================
//                      USERSERVICE.JS
//      VERSÃO CORRIGIDA E SIMPLIFICADA PARA GARANTIR O ACESSO
// ======================================================================

import {
    collection, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

/**
 * Busca todas as empresas associadas a um dono.
 * @param {string} uid - O ID do dono.
 * @returns {Promise<Array>} Uma lista de documentos de empresas.
 */
async function getEmpresasDoDono(uid) {
    if (!uid) return [];
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs;
}

/**
 * Verifica o status do plano e do trial para uma empresa específica.
 * @param {string} empresaId - O ID da empresa a ser verificada.
 * @returns {Promise<{hasActivePlan: boolean, isTrialActive: boolean}>}
 */
async function checkTrialStatus(empresaId) {
    if (!empresaId) return { hasActivePlan: false, isTrialActive: false };
    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);
        if (!empresaSnap.exists()) return { hasActivePlan: false, isTrialActive: false };

        const data = empresaSnap.data();
        const hasActivePlan = data.isPremium === true || data.statusPlano === 'ativo';
        let isTrialActive = false;

        // A verificação agora usa o campo 'trialFim' que é definido no perfil.
        if (data.trialFim && data.trialFim.seconds) {
            const dataFimTrial = new Date(data.trialFim.seconds * 1000);
            if (dataFimTrial > new Date()) {
                isTrialActive = true;
            }
        }
        return { hasActivePlan, isTrialActive };
    } catch (error) {
        console.error("Erro ao verificar status do trial:", error);
        return { hasActivePlan: false, isTrialActive: false };
    }
}

/**
 * ======================================================================
 * FUNÇÃO PRINCIPAL REESCRITA PARA CLAREZA E CORREÇÃO
 * ======================================================================
 * A função principal que verifica o acesso do usuário e o redireciona.
 */
export async function verificarAcesso() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Executa apenas uma vez

            if (!user) {
                window.location.href = 'login.html';
                return reject(new Error("Não autenticado."));
            }

            const currentPage = window.location.pathname.split('/').pop();

            try {
                // 1. O usuário é DONO de alguma empresa?
                const empresas = await getEmpresasDoDono(user.uid);
                if (empresas.length > 0) {
                    // SIM, É DONO.
                    if (empresas.length === 1) {
                        // Cenário: Dono com UMA empresa.
                        const empresaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaId);
                        const { hasActivePlan, isTrialActive } = await checkTrialStatus(empresaId);

                        if (!hasActivePlan && !isTrialActive && currentPage !== 'assinatura.html') {
                            window.location.href = 'assinatura.html';
                            return reject(new Error("Trial expirado."));
                        }
                        return resolve({ user, perfil: empresas[0].data(), empresaId, isOwner: true, role: "dono" });

                    } else {
                        // Cenário: Dono com MÚLTIPLAS empresas.
                        if (currentPage !== 'selecionar-empresa.html') {
                            window.location.href = 'selecionar-empresa.html';
                            return reject(new Error("Redirecionando para seleção."));
                        }
                        // Se já está na página de seleção, permite que ela carregue.
                        return resolve({ user, isOwner: true, role: "dono" });
                    }
                }

                // 2. Se não é dono, é FUNCIONÁRIO?
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);
                if (mapaSnap.exists()) {
                    const { empresaId } = mapaSnap.data();
                    localStorage.setItem('empresaAtivaId', empresaId);
                    const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                    const profissionalSnap = await getDoc(profissionalRef);

                    if (profissionalSnap.exists()) {
                        if (profissionalSnap.data().status === 'ativo') {
                            return resolve({ user, perfil: profissionalSnap.data(), empresaId, isOwner: false, role: "funcionario" });
                        } else {
                            return reject(new Error("aguardando_aprovacao"));
                        }
                    }
                }

                // 3. Se não é dono nem funcionário, é o PRIMEIRO ACESSO.
                return reject(new Error("primeiro_acesso"));

            } catch (error) {
                console.error("Erro na verificação de acesso:", error);
                return reject(error);
            }
        });
    });
}
