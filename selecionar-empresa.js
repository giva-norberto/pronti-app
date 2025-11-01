/**
 * @file selecionar-empresa.js
 * @description Script autônomo para a página de seleção de empresa.
 *              Gerencia a exibição de empresas e o redirecionamento.
 *              Não chama o 'verificarAcesso' para evitar loops.
 *
 * Alterações principais:
 * - Adicionada função checkUserStatus(userId, empresaData) tolerante a campos ausentes.
 *   Ela considera múltiplos campos de aprovação/pagamento e vários fallbacks para trial,
 *   evitando marcar empresas recém-criadas como "expirado".
 * - Integração: carregarEmpresas() anexa statusAssinatura a cada empresa (não modifica o banco).
 * - A UI exibe "Assinatura ativa", "Término do trial" ou "Expirado" de forma robusta.
 */

// Importações diretas, tornando o script independente.
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Elementos do DOM ---
const grid = document.getElementById('empresas-grid');
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// DEBUG: se precisar de logs no browser, ative true
const DEBUG_LOGS = false;

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
        // Limpa qualquer empresa ativa salva anteriormente para forçar uma nova escolha.
        localStorage.removeItem('empresaAtivaId');

        // Salva o nome do usuário para uso em outras telas (menu lateral, index, etc)
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
        localStorage.setItem('usuarioNome', primeiroNome);

        if (tituloBoasVindas) {
            tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        }
        // Nota: passar user.uid como userId (string)
        carregarEmpresas(user.uid, primeiroNome);
    } else {
        window.location.href = 'login.html';
    }
});

// --- Utilitários de Data e Tipos ---
function tsToDate(ts) {
    if (!ts) return null;
    // Firestore Timestamp tem toDate()
    if (typeof ts.toDate === 'function') return ts.toDate();
    // Pode ser ISO string / Date
    const d = new Date(ts);
    return isNaN(d) ? null : d;
}

function hojeSemHoras() {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
}

// --- Validação completa de status da empresa ---
// Retorna: { isPaid: boolean, isTrialActive: boolean, trialEndDate: Date|null }
// A função é tolerante e considera vários campos (incl. campos que aprovação manual pode gravar).
async function checkUserStatus(userId, empresaData) {
    try {
        if (DEBUG_LOGS) console.log('checkUserStatus chamado', { userId, empresaData });

        // segurança mínima: se não há empresaData, consideramos expirado
        if (!empresaData) return { isPaid: false, isTrialActive: false, trialEndDate: null };

        // pega dados do usuário (para checar isPremium / trialStart se necessário)
        let userData = null;
        if (userId) {
            try {
                const userRef = doc(db, "usuarios", userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) userData = userSnap.data();
            } catch (e) {
                console.warn('checkUserStatus: falha ao buscar usuario:', e);
            }
        }

        // Se a empresa não está ativa, considerar inacessível (independente de trial/pago)
        if (empresaData.status && String(empresaData.status).toLowerCase() !== 'ativo') {
            if (DEBUG_LOGS) console.log('Empresa não ativa:', empresaData.status);
            return { isPaid: false, isTrialActive: false, trialEndDate: null };
        }

        const now = new Date();

        // --- Detectores de pagamento / aprovação manual ---
        // Coletar possíveis campos usados por aprovação/manual/payment systems
        const assinaturaValidaAte = tsToDate(
            empresaData.assinaturaValidaAte ||
            empresaData.proximoPagamento ||
            empresaData.paidUntil ||
            empresaData.assinatura_valida_ate
        );

        const planoPago = (
            empresaData.plano === 'pago' ||
            empresaData.plano === 'premium' ||
            empresaData.planStatus === 'active' ||
            empresaData.plan === 'paid'
        );

        const assinaturaAtivaFlag = empresaData.assinaturaAtiva === true || empresaData.assinatura_ativa === true;
        const paymentStatusPaid = empresaData.paymentStatus === 'paid' || empresaData.pago === true || empresaData.payment_state === 'paid';
        const isApprovedManual = empresaData.aprovado === true || empresaData.aprovadoPor || empresaData.approved === true || empresaData.approval === 'approved';
        const usuarioPremium = userData?.isPremium === true || userData?.premium === true;

        // Definir regra de "é pago" considerando todos os indicadores possíveis
        const pagoIndicadores = planoPago || assinaturaAtivaFlag || usuarioPremium || paymentStatusPaid;
        const aprovadoComoPago = isApprovedManual && (planoPago || assinaturaAtivaFlag || assinaturaValidaAte || paymentStatusPaid);

        if (pagoIndicadores || aprovadoComoPago) {
            if (DEBUG_LOGS) console.log('Detectado pagamento/aprovação:', { planoPago, assinaturaAtivaFlag, usuarioPremium, paymentStatusPaid, isApprovedManual });
            // Se houver uma data de validade e ainda for futura, considera pago
            if (assinaturaValidaAte && assinaturaValidaAte > now) {
                return { isPaid: true, isTrialActive: false, trialEndDate: assinaturaValidaAte };
            }
            // Se plano indica 'pago' ou flag assinaturaAtiva existe, considerar pago mesmo sem data (conservador)
            return { isPaid: true, isTrialActive: false, trialEndDate: assinaturaValidaAte || null };
        }

        // --- Não é pago: validar trial (vários caminhos) ---
        // 1) trialEndDate explícito no documento da empresa
        if (empresaData.trialEndDate) {
            const end = tsToDate(empresaData.trialEndDate);
            if (end) {
                const ativo = end >= hojeSemHoras();
                if (DEBUG_LOGS) console.log('Usando trialEndDate:', end, 'ativo:', ativo);
                return { isPaid: false, isTrialActive: ativo, trialEndDate: end };
            }
        }

        // 2) Se freeEmDias > 0, tentar calcular a partir do usuario.trialStart
        const freeEmDias = Number(empresaData?.freeEmDias ?? 0);
        if (freeEmDias > 0 && userData?.trialStart) {
            const start = tsToDate(userData.trialStart);
            if (start) {
                const end = new Date(start);
                end.setDate(end.getDate() + freeEmDias);
                const ativo = end >= hojeSemHoras();
                if (DEBUG_LOGS) console.log('Usando freeEmDias + user.trialStart:', start, end, ativo);
                return { isPaid: false, isTrialActive: ativo, trialEndDate: end };
            }
        }

        // 3) Se freeEmDias > 0 mas sem trialStart do usuário, usar createdAt da empresa como base
        if (freeEmDias > 0 && empresaData.createdAt) {
            const created = tsToDate(empresaData.createdAt);
            if (created) {
                const end = new Date(created);
                end.setDate(end.getDate() + freeEmDias);
                const ativo = end >= hojeSemHoras();
                if (DEBUG_LOGS) console.log('Usando freeEmDias + createdAt:', created, end, ativo);
                return { isPaid: false, isTrialActive: ativo, trialEndDate: end };
            }
        }

        // 4) Fallback: se trialDisponivel true, usar createdAt + fallback curto (3 dias) como temporário
        if (empresaData.trialDisponivel === true && empresaData.createdAt) {
            const created = tsToDate(empresaData.createdAt);
            if (created) {
                const fallbackDays = 3;
                const end = new Date(created);
                end.setDate(end.getDate() + fallbackDays);
                const ativo = end >= hojeSemHoras();
                if (DEBUG_LOGS) console.log('Usando trialDisponivel + createdAt fallback:', created, end, ativo);
                return { isPaid: false, isTrialActive: ativo, trialEndDate: end };
            }
            // se não tivermos createdAt, mas trialDisponivel true, consideramos trial ativo sem data
            if (DEBUG_LOGS) console.log('trialDisponivel true mas sem createdAt -> considera trial ativo temporariamente');
            return { isPaid: false, isTrialActive: true, trialEndDate: null };
        }

        // Sem evidência de trial ou pagamento -> expirado
        if (DEBUG_LOGS) console.log('Sem evidência de trial ou pagamento -> expirado');
        return { isPaid: false, isTrialActive: false, trialEndDate: null };
    } catch (error) {
        console.error("Erro em checkUserStatus:", error);
        return { isPaid: false, isTrialActive: false, trialEndDate: null };
    }
}

// --- Funções Principais ---
async function carregarEmpresas(userId, nomeUsuario) {
    try {
        const mapaUsuarioRef = doc(db, "mapaUsuarios", userId);
        const mapaUsuarioSnap = await getDoc(mapaUsuarioRef);

        if (!mapaUsuarioSnap.exists() || !Array.isArray(mapaUsuarioSnap.data().empresas) || mapaUsuarioSnap.data().empresas.length === 0) {
            renderizarOpcoes([]);
            return;
        }

        const idsDasEmpresas = mapaUsuarioSnap.data().empresas;

        // Se houver apenas uma empresa, redireciona direto (mantendo comportamento anterior)
        if (idsDasEmpresas.length === 1) {
            const empresaId = idsDasEmpresas[0];
            localStorage.setItem('empresaAtivaId', empresaId);
            // O nome do usuário já foi salvo acima!
            window.location.href = 'index.html';
            return;
        }

        // Busca empresas do usuário (observação: limitações do 'in' do Firestore se ids > 10 são responsabilidade externa)
        const empresasRef = collection(db, "empresarios");
        const q = query(empresasRef, where(documentId(), "in", idsDasEmpresas));
        const snapshotsDasEmpresas = await getDocs(q);

        const empresas = snapshotsDasEmpresas.docs
            .filter(snapshot => snapshot.exists())
            .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));

        // Para cada empresa, validar status (free vs premium) sem alterar restante da lógica
        const empresasComStatus = await Promise.all(
            empresas.map(async (empresa) => {
                // por segurança, tente pegar donoId se existir para passar ao checkUserStatus
                const donoId = empresa.donoId || userId;
                const status = await checkUserStatus(donoId, empresa);
                return { ...empresa, statusAssinatura: status };
            })
        );

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

function criarEmpresaCard(empresa) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#';

    // Leitura do status calculado (se disponível)
    const status = empresa.statusAssinatura || { isPaid: false, isTrialActive: false, trialEndDate: null };
    const isPaid = !!status.isPaid;
    const isTrialActive = !!status.isTrialActive;
    const trialEndDate = status.trialEndDate ? (status.trialEndDate instanceof Date ? status.trialEndDate : tsToDate(status.trialEndDate)) : null;

    card.addEventListener('click', (e) => {
        e.preventDefault();
        // Salva empresa selecionada
        localStorage.setItem('empresaAtivaId', empresa.id);
        // Mantemos comportamento anterior: redireciona para index (não alteramos lógica de redirect automático)
        window.location.href = 'index.html';
    });

    const nomeFantasia = empresa.nomeFantasia || "Empresa Sem Nome";
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial)}`;

    // Monta informação adicional sem alterar lógica de funcionamento
    let infoHtml = '';
    if (isPaid) {
        const endTxt = trialEndDate ? ` — Pago até ${trialEndDate.toLocaleDateString('pt-BR')}` : '';
        infoHtml = `<div style="margin-top:8px; color:#059669; font-weight:600; font-size:0.9rem;">Assinatura ativa${endTxt}</div>`;
    } else if (isTrialActive) {
        const endTxt = trialEndDate ? `Término do trial: ${trialEndDate.toLocaleDateString('pt-BR')}` : 'Período de teste ativo';
        infoHtml = `<div style="margin-top:8px; color:#0ea5e9; font-weight:600; font-size:0.9rem;">${endTxt}</div>`;
    } else {
        // Mostra badge de expirado somente se não pago e não em trial
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
