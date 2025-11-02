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
    window.location.replace('login.html');
  });
}

// Ponto de entrada principal do script
onAuthStateChanged(auth, (user) => {
  if (user) {
    // limpar empresaAtivaId para forçar nova verificação/seleção
    localStorage.removeItem('empresaAtivaId');
    const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
    localStorage.setItem('usuarioNome', primeiroNome);

    if (tituloBoasVindas) {
      tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
    }
    carregarEmpresas(user.uid);
  } else {
    window.location.replace('login.html');
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

/**
 * checkEmpresaStatus
 * - Usa somente company.trialEndDate para trial (conforme solicitado).
 * - Mantém checagens de pagamento/assinatura (inclui campos comuns adicionais).
 * - Retorna { isPaid: boolean, isTrialActive: boolean, reason?: string }
 */
function checkEmpresaStatus(empresaData) {
  try {
    if (!empresaData) return { isPaid: false, isTrialActive: false, reason: 'no-data' };

    if (empresaData.status && String(empresaData.status).toLowerCase() !== 'ativo') {
      return { isPaid: false, isTrialActive: false, reason: 'status-inativo' };
    }

    const now = new Date();
    const hoje = hojeSemHoras();

    // campos de pagamento possíveis
    const assinaturaValidaAte = tsToDate(
      empresaData.assinaturaValidaAte ||
      empresaData.assinatura_valida_ate ||
      empresaData.proximoPagamento ||
      empresaData.proximo_pagamento ||
      empresaData.paidUntil
    );

    // indicadores de plano/flag (caso legados usem strings diferentes)
    const plano = String(empresaData.plano || '').toLowerCase();
    const planoPago = plano === 'pago' || plano === 'premium' || String(empresaData.planStatus || '').toLowerCase() === 'active' || String(empresaData.plan || '').toLowerCase() === 'paid';
    const assinaturaAtivaFlag = empresaData.assinaturaAtiva === true || empresaData.assinatura_ativa === true;
    const paymentStatusPaid = empresaData.paymentStatus === 'paid' || empresaData.pago === true || empresaData.payment_state === 'paid';
    const isApprovedManual = empresaData.aprovado === true || empresaData.aprovadoPor || empresaData.approved === true || empresaData.approval === 'approved';

    // 1) Pagamento / aprovação (se qualquer indicador existente)
    const pagoIndicadores = planoPago || assinaturaAtivaFlag || paymentStatusPaid || isApprovedManual;
    if (pagoIndicadores) {
      if (assinaturaValidaAte) {
        // comparar com hojeSemHoras para ser consistente com trial
        if (assinaturaValidaAte >= hoje) {
          return { isPaid: true, isTrialActive: false, reason: 'assinatura-valida' };
        } else {
          return { isPaid: false, isTrialActive: false, reason: 'assinatura-expirada' };
        }
      }
      // indicador de plano sem data -> considerar pago
      return { isPaid: true, isTrialActive: false, reason: 'assinatura-flag' };
    }

    // 2) Trial: somente company.trialEndDate (conforme regra)
    if (empresaData.trialEndDate) {
      const end = tsToDate(empresaData.trialEndDate);
      if (end) {
        // normalizar para fim do dia para UX previsível
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (endOfDay >= hoje) {
          return { isPaid: false, isTrialActive: true, reason: 'trialEndDate' };
        } else {
          return { isPaid: false, isTrialActive: false, reason: 'trial-expirado' };
        }
      }
    }

    // 3) Sem evidência -> expirado
    return { isPaid: false, isTrialActive: false, reason: 'no-evidence' };
  } catch (error) {
    console.error("Erro em checkEmpresaStatus:", error);
    return { isPaid: false, isTrialActive: false, reason: 'error' };
  }
}

// --- Funções Principais (com a lógica de redirecionamento) ---
async function carregarEmpresas(userId) {
  try {
    if (loader) loader.style.display = 'block';

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

      try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);
        const empresaData = empresaSnap.exists() ? empresaSnap.data() : null;

        const status = checkEmpresaStatus(empresaData);

        if (status.isPaid || status.isTrialActive) {
          // só gravar e redirecionar quando validado
          localStorage.setItem('empresaAtivaId', empresaId);
          window.location.replace('index.html');
        } else {
          // não gravar; redireciona para planos/assinatura
          window.location.replace('planos.html'); // ou 'assinatura.html' conforme seu fluxo
        }
      } catch (err) {
        console.error('Erro ao validar empresa única:', err);
        renderizarOpcoes([]);
      }
      return;
    }

    // --- Validação para Múltiplas Empresas ---
    const empresas = [];
    const CHUNK_SIZE = 10;
    for (let i = 0; i < idsDasEmpresas.length; i += CHUNK_SIZE) {
      const chunk = idsDasEmpresas.slice(i, i + CHUNK_SIZE);
      const empresasRef = collection(db, "empresarios");
      // opcional: adicionar where("status","==","ativo") se quiser filtrar no banco
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
    // só gravar após validação para evitar gravação prematura por outros scripts
    if (isPaid || isTrialActive) {
      localStorage.setItem('empresaAtivaId', empresa.id);
      window.location.replace('index.html');
    } else {
      window.location.replace('planos.html');
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
