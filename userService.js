// ======================================================================
//        USER-SERVICE.JS (VERSÃO FINAL COM LÓGICA DE ACESSO REVISADA)
// ======================================================================

import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from './firebase-config.js';

let cachedSessionProfile = null;
let isProcessing = false;

// ======================================================================
// FUNÇÃO: Garante doc do usuário e trial
// ======================================================================
export async function ensureUserAndTrialDoc() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                nome: user.displayName || user.email || 'Usuário',
                email: user.email || '',
                trialStart: serverTimestamp(),
                isPremium: false,
            });
        } else {
            const updateObj = {};
            const data = userSnap.data();
            if (!data.nome) updateObj.nome = user.displayName || user.email || 'Usuário';
            if (!data.email) updateObj.email = user.email || '';
            if (!data.trialStart) updateObj.trialStart = serverTimestamp();
            if (Object.keys(updateObj).length) await updateDoc(userRef, updateObj);
        }
    } catch (error) {
        console.error("❌ Erro em ensureUserAndTrialDoc:", error);
    }
}

// ======================================================================
// FUNÇÃO: Checa status de assinatura/trial do usuário
// ======================================================================
async function checkUserStatus(user, empresaData) {
    try {
        if (!user) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };

        const userData = userSnap.data();
        if (!userData) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false, trialDaysRemaining: 0 };
        if (!userData.trialStart?.seconds) return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };

        let trialDurationDays = 15;
        if (empresaData?.freeEmDias && typeof empresaData.freeEmDias === 'number') trialDurationDays = empresaData.freeEmDias;

        const startDate = new Date(userData.trialStart.seconds * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + trialDurationDays);

        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        const isTrialActive = endDate >= hoje;
        const trialDaysRemaining = isTrialActive ? Math.ceil((endDate - hoje) / (1000*60*60*24)) : 0;

        return { hasActivePlan: false, isTrialActive, trialDaysRemaining };
    } catch (error) {
        console.error("❌ Erro em checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: true, trialDaysRemaining: 0 };
    }
}

// ======================================================================
// FUNÇÃO: Busca empresas ativas do usuário (dono ou profissional)
// ======================================================================
export async function getEmpresasDoUsuario(user) {
    if (!user) return [];
    const empresasEncontradas = new Map();

    // Empresas do dono
    try {
        const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid), where("status","==","ativo"));
        const snapshotDono = await getDocs(qDono);
        snapshotDono.forEach(doc => empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch(e) { console.error("❌ Erro ao buscar empresas (dono):", e); }

    // Empresas do profissional
    try {
        const mapaRef = doc(db, "mapaUsuarios", user.uid);
        const mapaSnap = await getDoc(mapaRef);
        if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
            const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasEncontradas.has(id));
            for (let i=0;i<idsDeEmpresas.length;i+=10){
                const chunk = idsDeEmpresas.slice(i,i+10);
                if(chunk.length>0){
                    const q = query(collection(db, "empresarios"), where(documentId(), "in", chunk), where("status","==","ativo"));
                    const snap = await getDocs(q);
                    snap.forEach(doc => empresasEncontradas.set(doc.id, { id: doc.id, ...doc.data() }));
                }
            }
        }
    } catch(e){ console.error("❌ Erro ao buscar empresas (profissional):", e); }

    return Array.from(empresasEncontradas.values());
}

// ======================================================================
// FUNÇÃO PRINCIPAL: verificarAcesso
// ======================================================================
export async function verificarAcesso() {
    if (cachedSessionProfile) return cachedSessionProfile;
    if (isProcessing) return Promise.reject(new Error("Processamento de acesso já em andamento."));
    isProcessing = true;

    return new Promise((resolve,reject)=>{
        const unsubscribe = onAuthStateChanged(auth, async (user)=>{
            unsubscribe();

            try{
                const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
                const paginasPublicas = ['login.html','cadastro.html','recuperar-senha.html','index.html'];

                if(!user){
                    if(!paginasPublicas.includes(currentPage)) window.location.replace('login.html');
                    return reject(new Error("Usuário não autenticado."));
                }

                await ensureUserAndTrialDoc(user);
                const empresas = await getEmpresasDoUsuario(user);

                // Usuário sem empresa
                if(empresas.length===0){
                    if(currentPage!=='meuperfil.html' && currentPage!=='selecionar-empresa.html'){
                        window.location.replace('meuperfil.html');
                    }
                    return reject(new Error("Usuário sem empresa."));
                }

                // Mais de uma empresa
                if(empresas.length>1){
                    if(currentPage!=='selecionar-empresa.html'){
                        window.location.replace('selecionar-empresa.html');
                    }
                    return reject(new Error("Usuário com múltiplas empresas."));
                }

                // Apenas uma empresa
                const empresaAtivaId = empresas[0].id;
                localStorage.setItem('empresaAtivaId', empresaAtivaId);
                const empresaDocSnap = await getDoc(doc(db,"empresarios",empresaAtivaId));
                if(!empresaDocSnap.exists()){
                    localStorage.removeItem('empresaAtivaId');
                    window.location.replace('selecionar-empresa.html');
                    return reject(new Error("Empresa não encontrada."));
                }

                const empresaData = empresaDocSnap.data();
                const statusAssinatura = await checkUserStatus(user, empresaData);

                // Assinatura expirada -> redireciona para assinatura
                if(!statusAssinatura.hasActivePlan && !statusAssinatura.isTrialActive){
                    if(currentPage!=='assinatura.html'){
                        window.location.replace('assinatura.html');
                    }
                    return reject(new Error("Assinatura expirada."));
                }

                const isAdmin = user.uid==="BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                const isOwner = empresaData.donoId === user.uid;

                let perfilDetalhado = empresaData;
                let papel = 'dono';

                if(!isOwner && !isAdmin){
                    const profSnap = await getDoc(doc(db,"empresarios",empresaAtivaId,"profissionais",user.uid));
                    if(!profSnap.exists() || profSnap.data().status!=='ativo'){
                        localStorage.removeItem('empresaAtivaId');
                        window.location.replace('login.html');
                        return reject(new Error("Acesso de profissional revogado."));
                    }
                    perfilDetalhado = profSnap.data();
                    papel = 'funcionario';
                }

                cachedSessionProfile = {
                    user,
                    empresaId: empresaAtivaId,
                    perfil: perfilDetalhado,
                    isOwner: isOwner || isAdmin,
                    isAdmin,
                    papel,
                    statusAssinatura
                };

                resolve(cachedSessionProfile);

            }catch(error){
                console.error("❌ Erro final em verificarAcesso:",error);
                reject(error);
            }finally{
                isProcessing=false;
            }
        });
    });
}

// ======================================================================
// Funções auxiliares
// ======================================================================
export function clearCache(){
    cachedSessionProfile=null;
    isProcessing=false;
}

export async function getTodasEmpresas(){
    const snap = await getDocs(collection(db,"empresarios"));
    return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
}
