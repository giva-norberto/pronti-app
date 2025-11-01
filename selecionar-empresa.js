/**
 * @file selecionar-empresa.js
 * @description Script autônomo para a página de seleção de empresa.
 * VALIDA o status da empresa (pago ou trial) antes de redirecionar.
 * Inclui fallbacks para o trial caso 'trialEndDate' falhe na criação.
 */

// Importações diretas
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Elementos do DOM ---
const grid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- Eventos ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        localStorage.removeItem('empresaAtivaId');
        localStorage.removeItem('usuarioNome');
        await signOut(auth).catch(error => console.error("Erro ao sair:", error));
        window.location.href = 'login.html';
    });
}

// Ponto de entrada principal do script
onAuthStateChanged(auth, (user) => {
    if (user) {
        localStorage.removeItem('empresaAtivaId');
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
        localStorage.setItem('usuarioNome', primeiroNome);

        if (tituloBoasVindas) {
            tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        }
        carregarEmpresas(user.uid); // Passa só o UID
    } else {
        window.location.href = 'login.html';
    }
});

// --- Utilitários de Data ---
function tsToDate(ts) {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    const d = new Date(ts);
    return isNaN(d) ? null : d;
}

function hojeSemHoras() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

// ==========================================================
// ✅ FUNÇÃO DE VALIDAÇÃO (CORRIGIDA COM FALLBACKS)
// ==========================================================
function checkEmpresaStatus(empresaData) {
    try {
        if (!empresaData) {
            return { isPaid: false, isTrialActive: false };
        }

        if (empresaData.status && String(empresaData.status).toLowerCase() !== 'ativo') {
            return { isPaid: false, isTrialActive: false };
        }

        const now = new Date();
        const hoje = hojeSemHoras();

        // --- 1. Checagem de PAGAMENTO (Validações da EMPRESA) ---
        // (Isso valida suas "empresas antigas com varios campos")
        const assinaturaValidaAte = tsToDate(empresaData.assinaturaValidaAte || empresaData.paidUntil);
        const planoPago = (empresaData.plano === 'pago' || empresaData.plano === 'premium' || empresaData.planStatus === 'active');
        const assinaturaAtivaFlag = empresaData.assinaturaAtiva === true;
        const isApprovedManual = empresaData.aprovado === true || empresaData.approved === true;

        if (planoPago || assinaturaAtivaFlag || isApprovedManual) {
            if (assinaturaValidaAte) {
                if (assinaturaValidaAte > now) {
                    return { isPaid: true, isTrialActive: false }; // Pago e válido
                } else {
                    return { isPaid: false, isTrialActive: false }; // Assinatura paga expirou
                }
            }
            return { isPaid: true, isTrialActive: false }; // Pago (sem data)
        }
        
        // Se a data de assinatura paga expirou (mas não era plano "free")
        if (assinaturaValidaAte && assinaturaValidaAte <= now) {
             return { isPaid: false, isTrialActive: false };
        }

        // --- 2. Checagem de TRIAL (com fallbacks) ---
        // (Valida a "empresa nova")

        // **Prioridade 1: O campo trialEndDate (o correto)**
        if (empresaData.trialEndDate) {
            const end = tsToDate(empresaData.trialEndDate);
            if (end) {
                const ativo = end >= hoje; // Válido até o *fim* do dia
                return { isPaid: false, isTrialActive: ativo };
            }
        }

        // **Prioridade 2: Fallback (Plano B) se o trialEndDate falhar**
        // (Isso salva a "empresa nova" do erro de cache)
        const freeEmDias = Number(empresaData?.freeEmDias ?? 0);
        if (freeEmDias > 0 && empresaData.createdAt) {
            const created = tsToDate(empresaData.createdAt);
            if (created) {
                const end = new Date(created);
                end.setDate(created.getDate() + freeEmDias);
                const ativo = end >= hoje;
                return { isPaid: false, isTrialActive: ativo };
            }
        }

        // --- 3. Expirado ---
        return { isPaid: false, isTrialActive: false };

    } catch (error) {
        console.error("Erro em checkEmpresaStatus:", error);
        return { isPaid: false, isTrialActive: false };
    }
}


// --- Funções Principais (com a lógica de redirecionamento) ---
async function carregarEmpresas(userId) {
    try {
        const mapaUsuarioRef = doc(db, "mapaUsuarios", userId);
        const mapaUsuarioSnap = await getDoc(mapaUsuarioRef);

        if (!mapaUsuarioSnap.exists() || !Array.isArray(mapaUsuarioSnap.data().empresas) || mapaUsuarioSnap.data().empresas.length === 0) {
            renderizarOpcoes([]); 
            return;
        }

        const idsDasEmpresas = mapaUsuarioSnap.data().empresas;

        // --- Validação para 1 Empresa ---
        if (idsDasEmpresas.length === 1) {
            const empresaId = idsDasEmpresas[0];
            localStorage.setItem('empresaAtivaId', empresaId); 
            
            const empresaRef = doc(db, "empresarios", empresaId);
            const empresaSnap = await getDoc(empresaRef);
            const empresaData = empresaSnap.exists() ? empresaSnap.data() : null;

            const status = checkEmpresaStatus(empresaData);

            if (status.isPaid || status.isTrialActive) {
                window.location.href = 'index.html'; // OK
            } else {
                window.location.href = 'planos.html'; // Expirado
            }
            return;
        }

        // --- Validação para Múltiplas Empresas ---
        
        // Busca empresas (dividido em chunks de 10)
        const empresas = [];
        const CHUNK_SIZE = 10; 
        for (let i = 0; i < idsDasEmpresas.length; i += CHUNK_SIZE) {
            const chunk = idsDasEmpresas.slice(i, i + CHUNK_SIZE);
            const empresasRef = collection(db, "empresarios");
            const q = query(empresasRef, where(documentId(), "in", chunk));
            const snapshots = await getDocs(q);
            snapshots.forEach(snap => {
                if (snap.exists()) empresas.push({ id: snap.id, ...snap.data() });
            });
        }
        
        // Adiciona o status a cada empresa
        const empresasComStatus = empresas.map(empresa => {
            const status = checkEmpresaStatus(empresa);
            return { ...empresa, statusAssinatura: status };
        });

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
            grid.appendChild(criarEmpresaCard(empresa));
        });
    } else {
        grid.innerHTML = '<p>Você ainda não possui empresas cadastradas.</p>';
    }
    grid.appendChild(criarNovoCard());
}

// --- Card com lógica de clique ---
function criarEmpresaCard(empresa) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#';

    // Pega o status que foi calculado
    const status = empresa.statusAssinatura || { isPaid: false, isTrialActive: false };
    const isPaid = status.isPaid;
    const isTrialActive = status.isTrialActive;

    card.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.setItem('empresaAtivaId', empresa.id); 
        
        if (isPaid || isTrialActive) {
            window.location.href = 'index.html'; // OK
        } else {
            window.location.href = 'planos.html'; // Expirado
        }
    });

    const nomeFantasia = empresa.nomeFantasia || "Empresa Sem Nome";
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial)}`;

    let infoHtml = '';
    if (isPaid) {
        infoHtml = `<span class="status-ativo">Assinatura Ativa</span>`;
    } else if (isTrialActive) {
        infoHtml = `<span class="status-trial">Em Teste</span>`;
    } else {
        infoHtml = `<span class="status-expirado">Expirado</span>`;
    }

    card.innerHTML = `
        <img src="${logoSrc}" alt="Logo de ${nomeFantasia}" class="empresa-logo">
        <span class="empresa-nome">${nomeFantasia}</span>
        ${infoHtml} 
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
