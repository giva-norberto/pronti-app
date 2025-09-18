/**
 * @file selecionar-empresa.js
 * @description Script autônomo para a página de seleção de empresa.
 * Gerencia a exibição de empresas e o redirecionamento.
 * Não chama o 'verificarAcesso' para evitar loops.
 */

// Importações diretas, tornando o script independente.
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Elementos do DOM ---
const grid = document.getElementById('empresas-grid' );
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// ---> ALTERAÇÃO: Adicionamos a função de checar status aqui para manter o script autônomo.
// Esta função verifica o status de trial de um usuário específico (o dono da empresa).
async function checkUserStatus(userId, empresaData) {
    try {
        if (!userId) return { hasActivePlan: false, isTrialActive: false };
        const userRef = doc(db, "usuarios", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return { hasActivePlan: false, isTrialActive: false };
        const userData = userSnap.data();
        if (userData.isPremium === true) return { hasActivePlan: true, isTrialActive: false };

        let trialDurationDays = empresaData?.freeEmDias ?? 15;
        let isTrialActive = false;

        if (userData.trialStart?.seconds) {
            const startDate = new Date(userData.trialStart.seconds * 1000);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + trialDurationDays);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (endDate >= hoje) {
                isTrialActive = true;
            }
        } else {
            isTrialActive = true;
        }
        return { hasActivePlan: false, isTrialActive };
    } catch (error) {
        console.error("Erro em checkUserStatus:", error);
        return { hasActivePlan: false, isTrialActive: false };
    }
}


// --- Eventos ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        localStorage.removeItem('empresaAtivaId');
        await signOut(auth).catch(error => console.error("Erro ao sair:", error));
        window.location.href = 'login.html';
    });
}

// Ponto de entrada principal do script
onAuthStateChanged(auth, (user) => {
    if (user) {
        localStorage.removeItem('empresaAtivaId');
        
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
        if (tituloBoasVindas) {
            tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        }
        carregarEmpresas(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

// --- Funções Principais ---
async function carregarEmpresas(userId) {
    try {
        const mapaUsuarioRef = doc(db, "mapaUsuarios", userId);
        const mapaUsuarioSnap = await getDoc(mapaUsuarioRef);

        if (!mapaUsuarioSnap.exists() || !mapaUsuarioSnap.data().empresas || mapaUsuarioSnap.data().empresas.length === 0) {
            renderizarOpcoes([]);
            return;
        }
        
        const idsDasEmpresas = mapaUsuarioSnap.data().empresas;

        // ✅ SUA LÓGICA ORIGINAL PRESERVADA: Se houver apenas uma empresa, redireciona direto.
        if (idsDasEmpresas.length === 1) {
            const empresaId = idsDasEmpresas[0];
            localStorage.setItem('empresaAtivaId', empresaId);
            window.location.href = 'index.html';
            return; 
        }

        const empresasRef = collection(db, "empresarios");
        const q = query(empresasRef, where(documentId(), "in", idsDasEmpresas));
        const snapshotsDasEmpresas = await getDocs(q);
        
        const empresas = snapshotsDasEmpresas.docs
            .filter(snapshot => snapshot.exists())
            .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));

        // ---> ALTERAÇÃO: Para cada empresa encontrada, buscamos o seu status de assinatura.
        const empresasComStatus = await Promise.all(
            empresas.map(async (empresa) => {
                // A verificação é feita com base no 'donoId' da empresa.
                const status = await checkUserStatus(empresa.donoId, empresa);
                return {
                    ...empresa,
                    statusAssinatura: status 
                };
            })
        );
        
        // Passamos a lista de empresas já com o status para a função de renderização.
        renderizarOpcoes(empresasComStatus);

    } catch (error) {
        console.error("Erro ao carregar empresas: ", error);
        if (grid) {
            grid.innerHTML = `<p style="color: red;">Erro ao carregar empresas. Detalhes: ${error.message}</p>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function renderizarOpcoes(empresas) {
    if (!grid) return;
    grid.innerHTML = ''; 
    if (empresas.length > 0) {
        empresas.forEach(empresa => {
            // A função criarEmpresaCard agora recebe a empresa com o status da assinatura
            grid.appendChild(criarEmpresaCard(empresa));
        });
    } else {
       grid.innerHTML = '<p>Você ainda não possui empresas cadastradas.</p>';
    }
    grid.appendChild(criarNovoCard());
}

function criarEmpresaCard(empresa) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#';

    // ---> ALTERAÇÃO: A lógica de clique agora depende do status do trial.
    const isTrialActive = empresa.statusAssinatura.isTrialActive;

    card.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.setItem('empresaAtivaId', empresa.id);

        if (isTrialActive) {
            // Se o trial está ATIVO, vai para a página principal.
            window.location.href = 'index.html';
        } else {
            // Se o trial está EXPIRADO, vai direto para a página de assinatura.
            window.location.href = 'assinatura.html';
        }
    });

    const nomeFantasia = empresa.nomeFantasia || "Empresa Sem Nome";
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial )}`;

    // ---> ALTERAÇÃO: Adiciona a tag "Expirado" ao HTML se o trial não estiver ativo.
    const statusHtml = !isTrialActive ? '<span class="status-expirado">Expirado</span>' : '';

    card.innerHTML = `
        <img src="${logoSrc}" alt="Logo de ${nomeFantasia}" class="empresa-logo">
        <div class="empresa-info-wrapper">
            <span class="empresa-nome">${nomeFantasia}</span>
            ${statusHtml}
        </div>
    `;
    return card;
}

function criarNovoCard() {
    const card = document.createElement('a');
    card.className = 'criar-empresa-card';
    card.href = 'perfil.html'; 

    card.innerHTML = `
        <div class="plus-icon"><i class="fas fa-plus"></i></div>
        <span class="empresa-nome">Criar Nova Empresa</span>
    `;
    return card;
}
