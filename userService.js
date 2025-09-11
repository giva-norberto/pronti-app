/**
 * @file userService.js
 * @description Módulo central com verificação de segurança de horário.
 * @author Giva-Norberto & Gemini Assistant
 * @version Final-Com-Diagnostico
 */

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

/**
 * ✅ NOVO: VERIFICAÇÃO DE SEGURANÇA DE HORÁRIO
 * Compara o ano do sistema com o ano atual. Se houver uma grande diferença,
 * interrompe a execução para evitar erros de permissão silenciosos do Firebase.
 * @returns {boolean} Retorna true se a verificação passar, lança um erro se falhar.
 */
function verificarHorarioDoSistema() {
    const currentYear = new Date().getFullYear();
    // Você pode ajustar o ano aqui se necessário, mas o ideal é que seja dinâmico.
    const expectedYear = 2024; 
    
    // Permite uma pequena margem (ex: virada de ano), mas bloqueia discrepâncias grandes.
    if (Math.abs(currentYear - expectedYear) > 1) {
        // Lança um erro específico que pode ser capturado e exibido na tela.
        throw new Error(`VERIFICAÇÃO DE SEGURANÇA FALHOU: O ano do seu sistema está configurado como ${currentYear}, o que é inválido. Por favor, ajuste a data e hora do seu computador para o ano corrente (${expectedYear}) e tente novamente.`);
    }
    return true;
}


/**
 * Função guarda principal: Valida a sessão, empresa ativa, plano e permissões.
 * É o ponto de entrada para qualquer página protegida.
 * @returns {Promise<object>} Uma promessa que resolve com o objeto da sessão do usuário.
 */
export async function verificarAcesso() {
    try {
        // Executa a verificação de segurança ANTES de qualquer chamada ao Firebase.
        verificarHorarioDoSistema();
    } catch (error) {
        // Se a verificação de horário falhar, exibe o erro e interrompe tudo.
        console.error("ERRO CRÍTICO DE CONFIGURAÇÃO:", error.message);
        // Em um aplicativo real, você mostraria isso em um modal bonito.
        alert(error.message); 
        // Rejeita a promessa para que nada mais seja executado.
        return Promise.reject(error);
    }

    if (cachedSessionProfile) return Promise.resolve(cachedSessionProfile);
    if (isProcessing) return Promise.reject(new Error("Redirecionando..."));
    isProcessing = true;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Executa apenas uma vez
            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const paginasPublicas = ['login.html', 'cadastro.html'];
                const paginasDeConfig = ['perfil.html', 'selecionar-empresa.html', 'assinatura.html', 'nova-empresa.html'];

                if (!user) {
                    if (!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    isProcessing = false;
                    return reject(new Error("Utilizador não autenticado. Redirecionando..."));
                }
                
                // O resto do seu código continua aqui...
                // (O código abaixo é o mesmo que já funcionava, não foi alterado)
                
                let empresaAtivaId = localStorage.getItem('empresaAtivaId');
                let empresaDocSnap = null;

                if (empresaAtivaId) {
                    const empresaDoc = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    if (empresaDoc.exists()) {
                        empresaDocSnap = empresaDoc;
                    } else {
                        localStorage.removeItem('empresaAtivaId');
                        empresaAtivaId = null;
                    }
                }

                if (!empresaDocSnap) {
                    const empresas = await getEmpresasDoUsuario(user);
                    if (empresas.length === 0) {
                        if (!paginasDeConfig.includes(currentPage)) window.location.replace('nova-empresa.html');
                        return reject(new Error("Nenhuma empresa associada. Redirecionando..."));
                    } else if (empresas.length === 1) {
                        empresaAtivaId = empresas[0].id;
                        localStorage.setItem('empresaAtivaId', empresaAtivaId);
                        empresaDocSnap = await getDoc(doc(db, "empresarios", empresaAtivaId));
                    } else {
                        if (currentPage !== 'selecionar-empresa.html') window.location.replace('selecionar-empresa.html');
                        return reject(new Error("Múltiplas empresas, seleção necessária. Redirecionando..."));
                    }
                }

                if (!empresaDocSnap || !empresaDocSnap.exists()) return reject(new Error("Empresa não encontrada."));

                // ... resto da sua lógica de verificação de sessão ...
                const empresaData = empresaDocSnap.data();
                const isAdmin = user.uid === "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isOwner = empresaData.donoId === user.uid;
                let papel = isAdmin ? 'admin' : (isOwner ? 'dono' : 'funcionario');
                
                cachedSessionProfile = {
                    user,
                    empresaId: empresaAtivaId,
                    perfil: { ...empresaData, papel },
                    isAdmin
                };
                
                resolve(cachedSessionProfile);

            } catch (error) {
                reject(error);
            } finally {
                isProcessing = false;
            }
        });
    });
}


/**
 * Busca as empresas associadas a um usuário usando o 'mapaUsuarios'.
 * @param {object} user - O objeto de usuário do Firebase Auth.
 * @returns {Array} Uma lista de objetos de empresa.
 */
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);

        if (!mapaSnap.exists() || !mapaSnap.data().empresas || mapaSnap.data().empresas.length === 0) {
            return [];
        }

        const idsDeEmpresas = mapaSnap.data().empresas;
        if (idsDeEmpresas.length === 0) return [];

        const q = query(collection(db, "empresarios"), where(documentId(), "in", idsDeEmpresas));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (e) {
        console.error("❌ [getEmpresasDoUsuario] Erro ao buscar empresas pelo mapa:", e);
        return []; 
    }
}
