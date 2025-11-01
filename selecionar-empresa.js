/**
 * @file selecionar-empresa.js
 * @description Script autônomo para a página de seleção de empresa.
 *              Gerencia a exibição de empresas e o redirecionamento.
 *              Não chama o 'verificarAcesso' para evitar loops.
 *
 * Alteração principal: TRIAL agora considera SOMENTE company.trialEndDate.
 * As validações de pagamento/aprovação manual foram mantidas.
 */

// Importações diretas, tornando o script independente.
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, documentId, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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

// --- Validação de status da empresa (simplificada para TRIAL) ---
// Retorna: { isPaid: boolean, isTrialActive: boolean, trialEndDate: Date|null }
// Regras:
// - Mantém todas as checagens de pagamento/aprovação manual.
// - Para TRIAL, considera APENAS empresa.trialEndDate (se existir).
// - Não calcula trial a partir de freeEmDias, createdAt ou usuario.trialStart.
async function checkUserStatus(userId, empresaData) {
    try {
        if (DEBUG_LOGS) console.log('checkUserStatus chamado', { userId, empresaData });

        if (!empresaData) return { isPaid: false, isTrialActive: false, trialEndDate: null };

        // busca dados do usuário apenas para validações de premium (não para trial)
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

        // --- Detectores de pagamento / aprovação manual (mantidos) ---
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

        const pagoIndicadores = planoPago || assinaturaAtivaFlag || usuarioPremium || paymentStatusPaid;
        const aprovadoComoPago = isApprovedManual && (planoPago || assinaturaAtivaFlag || assinaturaValidaAte || paymentStatusPaid);

        if (pagoIndicadores || aprovadoComoPago) {
            if (DEBUG_LOGS) console.log('Detectado pagamento/aprovação:', { planoPago, assinaturaAtivaFlag, usuarioPremium, paymentStatusPaid, isApprovedManual });
            // Se houver uma data de validade e ainda for futura, considera pago
            if (assinaturaValidaAte && assinaturaValidaAte > now) {
                return { isPaid: true, isTrialActive: false, trialEndDate: assinaturaValidaAte };
            }
            // Se plano indica 'pago' ou flag assinaturaAtiva existe, considerar pago mesmo sem data
            return { isPaid: true, isTrialActive: false, trialEndDate: assinaturaValidaAte || null };
        }

        // --- TRIAL: considerar somente trialEndDate explícito no documento da empresa ---
        if (empresaData.trialEndDate) {
            const end = tsToDate(empresaData.trialEndDate);
            if (end) {
                const ativo = end >= hojeSemHoras();
                if (DEBUG_LOGS) console.log('Usando trialEndDate:', end, 'ativo:', ativo);
                return { isPaid: false, isTrialActive: ativo, trialEndDate: end };
            }
        }

        // Sem prova de pagamento e sem trialEndDate válida -> expirado
        if (DEBUG_LOGS) console.log('Sem prova de pagamento e sem trialEndDate -> expirado');
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

        // Se houver apenas uma empresa, validar antes de redirecionar.
        if (idsDasEmpresas.length === 1) {
            const empresaId = idsDasEmpresas[0];
            try {
                const empresaRef = doc(db, "empresarios", empresaId);
                const empresaSnap = await getDoc(empresaRef);
                const empresa = empresaSnap.exists() ? empresaSnap.data() : null;

                const donoId = empresa?.donoId || userId;
                const status = await checkUserStatus(donoId, empresa);

                if (DEBUG_LOGS) console.log('Status único empresa:', empresaId, status);

                if (status.isPaid || status.isTrialActive) {
                    // Permite redirecionar normalmente
                    localStorage.setItem('empresaAtivaId', empresaId);
                    window.location.href = 'index.html';
                    return;
                } else {
                    // Não redireciona automaticamente — mostra o card e aviso
                    renderizarOpcoes([{ id: empresaId, ...empresa }]);
                    if (grid) {
                        const aviso = document.createElement('div');
                        aviso.style.color = '#b91c1c';
                        aviso.style.margin = '12px 0';
                        aviso.style.fontWeight = '600';
                        aviso.textContent = 'A conta desta empresa está expirada. Entre em contato ou renove para continuar.';
                        grid.prepend(aviso);
                    }
                    return;
                }
            } catch (err) {
                console.error('Erro ao validar empresa única:', err);
                // Em caso de erro ao validar, optar por mostrar a lista (não redirecionar) para evitar acesso indevido.
                renderizarOpcoes([]);
                return;
            }
        }

        // Para múltiplas empresas, busca documentos normalmente
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
        // Bloqueia entrada se não pago e trial expirado
        if (!isPaid && !isTrialActive) {
            alert('A conta desta empresa está expirada. Por favor renove ou contate suporte.');
            return;
        }
        // Salva empresa selecionada e redireciona
        localStorage.setItem('empresaAtivaId', empresa.id);
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
