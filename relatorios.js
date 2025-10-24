// relatorios.js
// Gera relatório de comissões / valores líquidos e injeta na aba "faturamento" da página de relatórios.

import { verificarAcesso } from './userService.js';
import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, doc, getDoc, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/* ---------- Helpers ---------- */
function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

function calculateNetAmounts(preco, commissionPct) {
  const pct = (typeof commissionPct === 'number' && !Number.isNaN(commissionPct)) ? commissionPct : 0;
  const employeeAmount = Number((preco * (pct / 100)).toFixed(2));
  const ownerAmount = Number((preco - employeeAmount).toFixed(2));
  return { employeeAmount, ownerAmount };
}

function toISODateInput(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : (d.seconds ? new Date(d.seconds * 1000) : new Date(d));
  return dt.toISOString().slice(0, 10);
}

/* ---------- Caches ---------- */
const profCache = new Map();
const servCache = new Map();

async function getProfessionalData(empresaId, profissionalId) {
  if (!profissionalId) return null;
  const key = `${empresaId}::${profissionalId}`;
  if (profCache.has(key)) return profCache.get(key);
  try {
    const ref = doc(db, 'empresarios', empresaId, 'profissionais', profissionalId);
    const snap = await getDoc(ref);
    const data = snap && snap.exists() ? snap.data() : null;
    profCache.set(key, data);
    return data;
  } catch (err) {
    console.error('[relatorios] erro getProfessionalData', err);
    profCache.set(key, null);
    return null;
  }
}

async function getServiceData(empresaId, serviceId) {
  if (!serviceId) return null;
  const key = `${empresaId}::${serviceId}`;
  if (servCache.has(key)) return servCache.get(key);
  try {
    const refLocal = doc(db, 'empresarios', empresaId, 'servicos', serviceId);
    const snapLocal = await getDoc(refLocal);
    if (snapLocal && snapLocal.exists()) {
      const d = { id: snapLocal.id, ...snapLocal.data() };
      servCache.set(key, d);
      return d;
    }
  } catch (e) {
    // ignore
  }
  try {
    const refGlobal = doc(db, 'servicos', serviceId);
    const snapG = await getDoc(refGlobal);
    if (snapG && snapG.exists()) {
      const d = { id: snapG.id, ...snapG.data() };
      servCache.set(key, d);
      return d;
    }
  } catch (err) {
    console.warn('[relatorios] getServiceData fallback erro', err);
  }
  servCache.set(key, null);
  return null;
}

/* ---------- Buscar agendamentos (flexível) ----------
   Observação: agora o relatório considera apenas agendamentos "concluídos".
   Para compatibilidade com diferentes nomes de campo de status, aceitamos
   alguns valores comuns: 'concluido', 'concluídos', 'finalizado', 'completed'.
*/
async function fetchAppointments(empresaId, fromDate, toDate) {
  let fromTs = null, toTs = null;
  try {
    if (fromDate) fromTs = Timestamp.fromDate(new Date(fromDate + 'T00:00:00'));
    if (toDate) {
      const d = new Date(toDate + 'T23:59:59');
      toTs = Timestamp.fromDate(d);
    }
  } catch (e) {
    console.warn('[relatorios] erro parse datas', e);
  }

  const candidates = ['agendamentos', 'agenda', 'bookings', 'appointments'];
  for (const col of candidates) {
    try {
      const colRef = collection(db, col);

      // montar query dinâmica (podemos filtrar por empresaId e data se campos existirem)
      const filters = [];
      // filtro empresaId
      filters.push(where('empresaId', '==', empresaId));
      if (fromTs) filters.push(where('data', '>=', fromTs));
      if (toTs) filters.push(where('data', '<=', toTs));

      // montar query com orderBy se possível
      let q;
      try {
        q = query(colRef, ...filters, orderBy('data', 'desc'));
      } catch (errQ) {
        // alguns coleções não têm 'data' indexado — tentar sem orderBy
        q = query(colRef, ...filters);
      }

      const snap = await getDocs(q);
      if (!snap.empty) {
        // mapear e filtrar apenas os concluídos
        const rawList = snap.docs.map(d => ({ id: d.id, raw: d.data() }));
        const normalized = rawList.map(item => {
          const data = item.raw;
          return {
            id: item.id,
            dataRaw: data.data || data.dataAgendamento || data.date || data.createdAt || null,
            data: data.data ? (data.data.seconds ? new Date(data.data.seconds * 1000).toISOString() : data.data) : (data.dataAgendamento || data.date || ''),
            clienteNome: data.clienteNome || data.nomeCliente || data.cliente || data.clientName || '',
            profissionalId: data.profissionalId || data.profissional || data.employeeId || data.professionalId || null,
            profissionalNome: data.profissionalNome || data.employeeName || data.profissionalName || '',
            serviceId: data.serviceId || data.servicoId || data.servico || data.service || null,
            serviceName: data.serviceName || data.servicoNome || data.titulo || '',
            preco: Number(data.preco || data.valor || data.price || data.fee || 0),
            status: (data.status || data.estado || '').toString().toLowerCase(),
            raw: data
          };
        });

        // filtrar status concluído (aceitar várias variantes)
        const okStatus = ['concluido','concluídos','concluidos','finalizado','finalizado','completed','done'];
        const concluidos = normalized.filter(a => {
          const s = (a.status || '').toLowerCase();
          // se não existir campo status, considerar como concluído somente se campo 'concluido' true ou se data < now
          if (s && okStatus.includes(s)) return true;
          if (a.raw && typeof a.raw.concluido !== 'undefined') {
            return Boolean(a.raw.concluido);
          }
          return false;
        });

        // retornar somente os concluídos
        return concluidos;
      }
    } catch (err) {
      console.warn('[relatorios] fetchAppointments tentou', col, 'erro:', err);
    }
  }
  return [];
}

/* ---------- Render da tabela ---------- */
function renderTable(rows, container) {
  container.innerHTML = '';

  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="padding:18px;color:#6b7280">Nenhum agendamento concluído encontrado no período selecionado.</div>';
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Data','Cliente','Profissional','Serviço','Preço','Comissão %','Valor funcionário','Valor dono'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.padding = '10px 8px';
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  let totalPrice = 0, totalEmployee = 0, totalOwner = 0;

  rows.forEach(r => {
    totalPrice += r.preco || 0;
    totalEmployee += r.employeeAmount || 0;
    totalOwner += r.ownerAmount || 0;

    const tr = document.createElement('tr');

    const td = (txt) => {
      const td = document.createElement('td');
      td.textContent = txt;
      td.style.padding = '8px';
      return td;
    };

    tr.appendChild(td(r.data ? (new Date(r.data)).toLocaleString() : ''));
    tr.appendChild(td(r.cliente || ''));
    tr.appendChild(td(r.profissional || ''));
    tr.appendChild(td(r.servico || ''));
    tr.appendChild(td(fmtBRL(r.preco)));
    tr.appendChild(td((r.commissionPct || 0) + '%'));
    tr.appendChild(td(fmtBRL(r.employeeAmount)));
    tr.appendChild(td(fmtBRL(r.ownerAmount)));

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  const tfoot = document.createElement('tfoot');
  const fr = document.createElement('tr');
  fr.style.fontWeight = '700';
  fr.style.background = '#f3f4fc';
  const emptyTd = () => {
    const td = document.createElement('td'); td.style.padding = '8px'; return td;
  };
  fr.appendChild(emptyTd());
  fr.appendChild(emptyTd());
  fr.appendChild(emptyTd());
  fr.appendChild(emptyTd());
  const tdTotalPrice = document.createElement('td'); tdTotalPrice.textContent = fmtBRL(totalPrice); tdTotalPrice.style.padding='8px';
  fr.appendChild(tdTotalPrice);
  fr.appendChild((() => { const td=document.createElement('td'); td.textContent='TOTAIS:'; td.style.padding='8px'; return td; })());
  const tdTotalEmployee = document.createElement('td'); tdTotalEmployee.textContent = fmtBRL(totalEmployee); tdTotalEmployee.style.padding='8px';
  fr.appendChild(tdTotalEmployee);
  const tdTotalOwner = document.createElement('td'); tdTotalOwner.textContent = fmtBRL(totalOwner); tdTotalOwner.style.padding='8px';
  fr.appendChild(tdTotalOwner);
  tfoot.appendChild(fr);
  table.appendChild(tfoot);

  container.appendChild(table);
}

/* ---------- UI & inicialização ---------- */
async function preencherFiltroProfissionais(empresaId) {
  const sel = document.getElementById('filtro-profissional');
  if (!sel) return;
  sel.innerHTML = '<option value="todos">Todos</option>';
  try {
    const colRef = collection(db, 'empresarios', empresaId, 'profissionais');
    const snap = await getDocs(colRef);
    snap.forEach(d => {
      const data = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = data.nome || data.name || data.displayName || d.id;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.warn('[relatorios] erro preencherFiltroProfissionais', err);
  }
}

async function handleAplicarFiltro() {
  const sess = await verificarAcesso();
  if (!sess || !sess.empresaId) {
    console.error('[relatorios] sessão inválida');
    return;
  }
  const empresaId = sess.empresaId;
  const from = document.getElementById('filtro-data-inicio').value;
  const to = document.getElementById('filtro-data-fim').value;
  const profSel = document.getElementById('filtro-profissional').value;

  const container = document.getElementById('faturamento');
  container.innerHTML = '<div style="padding:16px;color:#6b7280">Carregando relatório...</div>';

  let appts = await fetchAppointments(empresaId, from, to);

  // filtrar por profissional se necessário
  if (profSel && profSel !== 'todos') {
    appts = appts.filter(a => {
      const pid = a.profissionalId || a.raw?.profissionalId || a.raw?.profissional;
      return pid === profSel;
    });
  }

  // calcular comissões e valores
  const rows = [];
  for (const a of appts) {
    const preco = Number(a.preco || 0);
    let commissionPct = null;

    // buscar profissional e serviço (com cache)
    const prof = await getProfessionalData(empresaId, a.profissionalId);
    const serv = await getServiceData(empresaId, a.serviceId);

    // prioridade: comissão específica do profissional por serviço
    if (prof && prof.comissaoPorServico && a.serviceId && typeof prof.comissaoPorServico[a.serviceId] !== 'undefined') {
      commissionPct = Number(prof.comissaoPorServico[a.serviceId]);
    }
    if ((commissionPct === null || Number.isNaN(commissionPct)) && prof && typeof prof.comissaoPadrao === 'number') {
      commissionPct = Number(prof.comissaoPadrao);
    }
    if (commissionPct === null || Number.isNaN(commissionPct)) commissionPct = 0;

    const { employeeAmount, ownerAmount } = calculateNetAmounts(preco, commissionPct);

    rows.push({
      data: a.data || a.dataRaw || '',
      cliente: a.clienteNome || '',
      profissional: a.profissionalNome || (prof && (prof.nome || prof.name)) || '',
      servico: a.serviceName || (serv && (serv.nome || serv.titulo)) || '',
      preco,
      commissionPct,
      employeeAmount,
      ownerAmount
    });
  }

  renderTable(rows, container);
}

/* ---------- inicialização da página de relatórios ---------- */
async function init() {
  try {
    const sess = await verificarAcesso();
    if (!sess || !sess.empresaId) {
      console.error('[relatorios] usuário sem sessão/empresa');
      return;
    }
    const empresaId = sess.empresaId;

    // preencher profissionais no filtro
    await preencherFiltroProfissionais(empresaId);

    // definir datas padrão (mês atual)
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    document.getElementById('filtro-data-inicio').value = toISODateInput(primeiro);
    document.getElementById('filtro-data-fim').value = toISODateInput(hoje);

    // aplicar filtro inicialmente
    document.getElementById('btn-aplicar-filtro').addEventListener('click', handleAplicarFiltro);

    // executar primeira vez
    await handleAplicarFiltro();

    // abas simples (ativa troca)
    document.querySelectorAll('.aba').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        document.querySelectorAll('.aba').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const aba = btn.dataset.aba;
        document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('active'));
        const el = document.getElementById(aba);
        if (el) el.classList.add('active');
      });
    });

  } catch (err) {
    console.error('[relatorios] erro init', err);
  }
}

init();
