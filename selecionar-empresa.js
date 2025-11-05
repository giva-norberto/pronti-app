/**
 * @file selecionar-empresa.js
 * @description Script autônomo para a página de seleção de empresa.
 * LÓGICA SIMPLES: Valida (Pago) ou (trialEndDate). Redireciona para planos se expirado.
 */

// Importações diretas
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Elementos do DOM ---
const grid = document.getElementById('empresas-grid' );
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
        carregarEmpresas(user.uid); 
    } else {
        window.location.href = 'login.html';
    }
});

// --- Utilitários de Data ---
/**
 * Converte vários formatos possíveis em Date ou retorna null:
 * - Firestore Timestamp (objeto com toDate())
 * - Objeto plain { seconds: number }
 * - Date
 * - ISO string / timestamp string
 */
function tsToDate(value) {
    if (!value && value !== 0) return null;
    try {
        if (typeof value.toDate === 'function') {
            // Firestore Timestamp
            return value.toDate();
        }
        if (value && typeof value.seconds === 'number') {
            // plain object { seconds, nanoseconds? }
            return new Date(value.seconds * 1000);
        }
        if (value instanceof Date) return value;
        // tenta converter string / number
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    } catch (err) {
        // fallback para null
    }
    return null;
}

function hojeSemHoras() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

// ==========================================================
// ✅ FUNÇÃO DE VALIDAÇÃO SIMPLIFICADA (COM CORREÇÃO DE DATA)
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

        // --- 1. Checagem de PAGAMENTO (Valida empresas antigas) ---
        const assinaturaValidaAte = tsToDate(empresaData.assinaturaValidaAte || empresaData.assinatura_valida_ate || empresaData.paidUntil || empresaData.paid_until);
        const planoPago = (String(empresaData.plano || '').toLowerCase() === 'pago' ||
                           String(empresaData.plano || '').toLowerCase() === 'premium' ||
                           String(empresaData.planStatus || '').toLowerCase() === 'active' ||
                           String(empresaData.plan_status || '').toLowerCase() === 'active');
        const assinaturaAtivaFlag = empresaData.assinaturaAtiva === true || empresaData.assinatura_ativa === true;
        const isApprovedManual = empresaData.aprovado === true || empresaData.approved === true;

        if (planoPago || assinaturaAtivaFlag || isApprovedManual) {
            if (assinaturaValidaAte) {
                // compara por timestamp completo (mantendo comportamento antigo)
                if (assinaturaValidaAte.getTime() > now.getTime()) {
                    return { isPaid: true, isTrialActive: false }; // Pago e válido
                } else {
                    return { isPaid: false, isTrialActive: false }; // Assinatura paga expirou
                }
            }
            // Pago sem data explícita -> compatibilidade com registros antigos
            return { isPaid: true, isTrialActive: false };
        }

        // --- 2. Checagem de TRIAL (VALIDAR SOMENTE POR trialEndDate) ---
        // Regra solicitada: considerar trial ativo apenas com base em trialEndDate,
        // ignorando outros flags como trialDisponivel.
        const trialRaw = empresaData.trialEndDate || empresaData.trial_end || empresaData.trialEnds || empresaData.trial_ends;
        if (trialRaw) {
            const trialDate = tsToDate(trialRaw);
            if (trialDate) {
                // Normaliza para comparação "apenas data" (remove horas)
                const trialDateSemHoras = new Date(trialDate);
                trialDateSemHoras.setHours(0, 0, 0, 0);

                // Se a data final do trial for >= data de hoje => trial ativo
                if (trialDateSemHoras.getTime() >= hoje.getTime()) {
                    return { isPaid: false, isTrialActive: true };
                }
                // Se trialEndDate < hoje => expirado (vai cair no retorno abaixo)
            } else {
                // Se não conseguiu interpretar a data, considera expirado por segurança
                return { isPaid: false, isTrialActive: false };
            }
        }

        // --- 3. Expirado ---
        return { isPaid: false, isTrialActive: false };

    } catch (error) {
        console.error("Erro em checkEmpresaStatus:", error, "empresaData:", empresaData);
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
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial )}`;

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
    card.href = '#';

    card.innerHTML = `
        <div class="plus-icon"><i class="fas fa-plus"></i></div>
        <span class="empresa-nome">Criar Nova Empresa</span>
    `;

    // Ao clicar: limpar empresaAtivaId e ir para perfil.html para criar nova
    card.addEventListener('click', (e) => {
        e.preventDefault();
        try {
            localStorage.removeItem('empresaAtivaId'); // garante que perfil não carregue empresa existente
            // opcional: remover outros campos relacionados
            // localStorage.removeItem('empresaAtivaNome');
            // sessionStorage.removeItem('empresaEdicao');
        } catch (err) {
            console.warn('Não foi possível limpar empresaAtivaId:', err);
        }
        // navega explicitamente para criar novo perfil (sem empresa ativa)
        window.location.href = 'perfil.html';
    });

    return card;
}
