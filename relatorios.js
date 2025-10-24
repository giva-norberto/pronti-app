// relatorios.js (VERSÃO REVISADA - event listeners inicializados após DOMContentLoaded)
// Mantive sua lógica de negócio, Firestore e cálculos; corrigi inicialização das abas para garantir
// que a aba "comissão" (e todas as outras) esteja disponível em mobile/desktop.

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/* ----------------------------- Helpers ----------------------------- */

// Formatador BRL
function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

/* ----------------------------- DOM refs (deferidos) ----------------------------- */
// Observação: não capturamos .aba no topo — faremos isso somente após DOMContentLoaded
let filtroInicio = null;
let filtroFim = null;
let filtroProfissional = null;
let btnAplicarFiltro = null;

/* ----------------------------- Firestore helpers ----------------------------- */

// Busca agendamentos filtrados do Firestore
async function buscarAgendamentos({ inicio, fim, profissionalId, statusFiltro }) {
  const filtros = [
    where("data", ">=", inicio),
    where("data", "<=", fim),
    where("status", "in", statusFiltro)
  ];
  if (profissionalId && profissionalId !== "todos") {
    filtros.push(where("profissionalId", "==", profissionalId));
  }
  const q = query(
    collection(db, "empresarios", empresaId, "agendamentos"),
    ...filtros
  );
  try {
    const snapshot = await getDocs(q);
    const ags = [];
    snapshot.forEach(docSnap => {
      const ag = docSnap.data();
      ag.id = docSnap.id;
      ags.push(ag);
    });
    return ags;
  } catch (e) {
    console.error("Erro ao buscar agendamentos:", e);
    throw e;
  }
}

/* ----------------------------- UI helpers (CSV, tabela responsiva) ----------------------------- */

function exportarTabelaCSV(abaId) {
  const table = document.querySelector(`#${abaId} table`);
  if (!table) return;
  const csv = [];
  for (let row of table.rows) {
    const cols = Array.from(row.cells).map(td => `"${td.innerText.replace(/"/g, '""')}"`);
    csv.push(cols.join(";"));
  }
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `relatorio-${abaId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function adicionarBotaoExportar(container, abaId) {
  const oldBtn = container.querySelector('.btn-exportar-csv');
  if (oldBtn) oldBtn.remove();
  const btn = document.createElement('button');
  btn.className = 'btn-exportar-csv';
  btn.innerHTML = '<i class="fa-solid fa-file-csv"></i> Exportar CSV';
  btn.style.marginBottom = '18px';
  btn.onclick = () => exportarTabelaCSV(abaId);
  container.prepend(btn);
}

// Render de tabela responsiva com data-label automático
function renderTabela(container, colunas, linhas) {
  if (!linhas || !linhas.length) {
    container.innerHTML = "<p>Nenhum dado encontrado no período.</p>";
    return;
  }

  const theadCells = colunas.map(c => `<th style="text-align:left;padding:8px 10px;background:#eaeefc;">${c}</th>`).join("");

  const trs = linhas.map(row => {
    const tds = row.map((cell, idx) => {
      const txt = (cell === null || typeof cell === 'undefined') ? '' : cell;
      const label = colunas[idx] || '';
      // escape mínimo para evitar problemas com conteúdo HTML (preservar simples valores)
      return `<td data-label="${label}" style="padding:8px 10px;background:#f7f9ff;">${txt}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  container.innerHTML = `
    <div class="table-wrapper" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <table style="min-width:720px;border-collapse:collapse;border-spacing:0;margin-bottom:12px;">
        <thead><tr>${theadCells}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  `;
}

/* ----------------------------- Empresa / Estado ----------------------------- */

let empresaId = localStorage.getItem("empresaAtivaId");
if (!empresaId) {
  alert("Nenhuma empresa ativa encontrada. Selecione uma empresa.");
  window.location.href = "selecionar-empresa.html";
}

/* ----------------------------- Relatórios existentes ----------------------------- */

// As funções abaixo mantêm exatamente a sua lógica original, só chamei buscarAgendamentos, renderTabela etc.
// Você já tinha essas implementações; mantenho aqui sem alterações funcionais.

async function carregarRelatorioServicos() {
  const container = document.getElementById("servicos");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const ags = await buscarAgendamentos({
      inicio: filtroInicio.value,
      fim: filtroFim.value,
      profissionalId: filtroProfissional.value,
      statusFiltro: ["realizado"]
    });
    const servicos = {};
    ags.forEach(ag => {
      if (!ag.servicoNome) return;
      if (!servicos[ag.servicoNome]) servicos[ag.servicoNome] = { qtd: 0, total: 0 };
      servicos[ag.servicoNome].qtd += 1;
      servicos[ag.servicoNome].total += parseFloat(ag.servicoPreco) || 0;
    });
    const linhas = Object.entries(servicos)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .map(([nome, info]) => [nome, info.qtd, fmtBRL(info.total)]);
    renderTabela(container, ["Serviço", "Qtd", "Faturamento"], linhas);
    adicionarBotaoExportar(container, "servicos");
  } catch (e) {
    container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
  }
}

async function carregarRelatorioProfissionais() {
  const container = document.getElementById("profissionais");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const ags = await buscarAgendamentos({
      inicio: filtroInicio.value,
      fim: filtroFim.value,
      profissionalId: filtroProfissional.value,
      statusFiltro: ["realizado"]
    });
    const profs = {};
    ags.forEach(ag => {
      if (!ag.profissionalNome) return;
      if (!profs[ag.profissionalNome]) profs[ag.profissionalNome] = { qtd: 0, total: 0 };
      profs[ag.profissionalNome].qtd += 1;
      profs[ag.profissionalNome].total += parseFloat(ag.servicoPreco) || 0;
    });
    const linhas = Object.entries(profs)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .map(([nome, info]) => [nome, info.qtd, fmtBRL(info.total)]);
    renderTabela(container, ["Profissional", "Qtd Atendimentos", "Faturamento"], linhas);
    adicionarBotaoExportar(container, "profissionais");
  } catch (e) {
    container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
  }
}

async function carregarRelatorioFaturamento() {
  const container = document.getElementById("faturamento");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const ags = await buscarAgendamentos({
      inicio: filtroInicio.value,
      fim: filtroFim.value,
      profissionalId: filtroProfissional.value,
      statusFiltro: ["realizado"]
    });
    const totalFaturamento = ags.reduce((tot, ag) => tot + (parseFloat(ag.servicoPreco) || 0), 0);
    const servicos = {};
    ags.forEach(ag => {
      if (!ag.servicoNome) return;
      if (!servicos[ag.servicoNome]) servicos[ag.servicoNome] = 0;
      servicos[ag.servicoNome] += parseFloat(ag.servicoPreco) || 0;
    });
    const linhas = Object.entries(servicos)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, total]) => [nome, fmtBRL(total)]);
    container.innerHTML = `<div>
      <p><b>Faturamento total:</b> ${fmtBRL(totalFaturamento)}</p>
      <h4 style="margin:18px 0 7px 0;">Por serviço:</h4>
    </div>`;
    if (linhas.length) {
      const tabela = document.createElement("div");
      renderTabela(tabela, ["Serviço", "Faturamento"], linhas);
      container.appendChild(tabela);
    } else {
      container.innerHTML += "<p>Nenhum faturamento no período.</p>";
    }
    adicionarBotaoExportar(container, "faturamento");
  } catch (e) {
    container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
  }
}

async function carregarRelatorioClientes() {
  const container = document.getElementById("clientes");
  container.innerHTML = "<p>Carregando...</p>";
  const clientesRef = collection(db, "empresarios", empresaId, "clientes");
  const agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");
  try {
    const [snapshotClientes, snapshotAgendamentos] = await Promise.all([
      getDocs(clientesRef),
      getDocs(agendamentosRef)
    ]);
    const agPorCliente = {};
    snapshotAgendamentos.forEach(docSnap => {
      const ag = docSnap.data();
      if (ag.status !== "realizado") return;
      if (!ag.clienteId) return;
      if (ag.data < filtroInicio.value || ag.data > filtroFim.value) return;
      if (!agPorCliente[ag.clienteId]) agPorCliente[ag.clienteId] = [];
      agPorCliente[ag.clienteId].push(ag);
    });
    const linhas = [];
    snapshotClientes.forEach(docSnap => {
      const c = docSnap.data();
      const ags = agPorCliente[docSnap.id] || [];
      const ultimoAt = ags.length ? ags.map(a => a.data).sort().reverse()[0] : "-";
      linhas.push([c.nome, ags.length, ultimoAt]);
    });
    renderTabela(container, ["Cliente", "Total atendimentos", "Último atendimento"], linhas);
    adicionarBotaoExportar(container, "clientes");
  } catch (e) {
    container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
  }
}

async function carregarRelatorioAgenda() {
  const container = document.getElementById("agenda");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const statusFiltro = ["ativo", "realizado", "cancelado", "cancelado_pelo_gestor", "nao_compareceu"];
    const ags = await buscarAgendamentos({
      inicio: filtroInicio.value,
      fim: filtroFim.value,
      profissionalId: filtroProfissional.value,
      statusFiltro
    });
    const contagem = { ativo: 0, realizado: 0, nao_compareceu: 0, cancelado: 0, cancelado_pelo_gestor: 0 };
    ags.forEach(ag => {
      if (contagem.hasOwnProperty(ag.status)) contagem[ag.status]++;
    });
    const linhas = [
      ["Agendados (ativos)", contagem.ativo],
      ["Concluídos (realizado)", contagem.realizado],
      ["Faltas (não compareceu)", contagem.nao_compareceu],
      ["Cancelados pelo cliente", contagem.cancelado],
      ["Cancelados pelo gestor", contagem.cancelado_pelo_gestor]
    ];
    renderTabela(container, ["Status", "Quantidade"], linhas);
    adicionarBotaoExportar(container, "agenda");
  } catch (e) {
    container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
  }
}

/* ----------------------------- Comissão (Firestore + fallback) ----------------------------- */

async function fetchCommissionAggregatesFromFirestore(empresaId, from, to, profissionalFilter = "todos") {
  const candidateGetters = [
    () => collection(db, 'empresarios', empresaId, 'relatoriosComissao'),
    () => collection(db, 'empresarios', empresaId, 'relatorios'),
    () => collection(db, 'relatoriosComissao')
  ];

  for (const getCol of candidateGetters) {
    try {
      const colRef = getCol();
      const snap = await getDocs(colRef);
      if (snap.empty) continue;

      const results = [];

      if (colRef.path.endsWith('/relatorios')) {
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          if (typeof d.totalFaturado !== 'undefined') {
            if (d.empresaId && d.empresaId !== empresaId) continue;
            if (profissionalFilter !== 'todos' && d.profissionalId && d.profissionalId !== profissionalFilter) continue;
            results.push({
              profissionalId: d.profissionalId || docSnap.id,
              profissionalNome: d.profissionalNome || d.nome || docSnap.id,
              totalFaturado: Number(d.totalFaturado || 0),
              totalFuncionario: Number(d.totalFuncionario || 0),
              totalLiquido: Number(d.totalLiquido || 0),
              avgCommissionPct: typeof d.avgCommissionPct !== 'undefined' ? Number(d.avgCommissionPct) : (d.totalFaturado ? (Number(d.totalFuncionario) / Number(d.totalFaturado) * 100) : 0)
            });
          }

          try {
            const subColRef = collection(docSnap.ref, 'comissao');
            const subSnap = await getDocs(subColRef);
            subSnap.forEach(subDoc => {
              const sd = subDoc.data();
              if (sd.empresaId && sd.empresaId !== empresaId) return;
              if (profissionalFilter !== 'todos' && sd.profissionalId && sd.profissionalId !== profissionalFilter) return;
              if (typeof sd.totalFaturado !== 'undefined') {
                results.push({
                  profissionalId: sd.profissionalId || subDoc.id,
                  profissionalNome: sd.profissionalNome || sd.nome || subDoc.id,
                  totalFaturado: Number(sd.totalFaturado || 0),
                  totalFuncionario: Number(sd.totalFuncionario || 0),
                  totalLiquido: Number(sd.totalLiquido || 0),
                  avgCommissionPct: typeof sd.avgCommissionPct !== 'undefined' ? Number(sd.avgCommissionPct) : (sd.totalFaturado ? (Number(sd.totalFuncionario) / Number(sd.totalFaturado) * 100) : 0)
                });
              }
            });
          } catch (eSub) {
            // ignora
          }
        }
      } else {
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (d.empresaId && d.empresaId !== empresaId) return;
          if (profissionalFilter !== 'todos' && d.profissionalId && d.profissionalId !== profissionalFilter) return;
          if (typeof d.totalFaturado !== 'undefined') {
            results.push({
              profissionalId: d.profissionalId || docSnap.id,
              profissionalNome: d.profissionalNome || d.nome || docSnap.id,
              totalFaturado: Number(d.totalFaturado || 0),
              totalFuncionario: Number(d.totalFuncionario || 0),
              totalLiquido: Number(d.totalLiquido || 0),
              avgCommissionPct: typeof d.avgCommissionPct !== 'undefined' ? Number(d.avgCommissionPct) : (d.totalFaturado ? (Number(d.totalFuncionario) / Number(d.totalFaturado) * 100) : 0)
            });
          }
        });
      }

      if (results.length) return results;
    } catch (err) {
      console.warn('[comissao] tentativa falhou, tentando próximo caminho:', err);
    }
  }

  return null;
}

async function calculateCommissionAggregatesLocal(empresaId, from, to, profissionalFilter = "todos") {
  const ags = await buscarAgendamentos({
    inicio: from,
    fim: to,
    profissionalId: profissionalFilter === 'todos' ? undefined : profissionalFilter,
    statusFiltro: ["realizado"]
  });

  const profMap = new Map();
  try {
    const profSnap = await getDocs(collection(db, 'empresarios', empresaId, 'profissionais'));
    profSnap.forEach(p => profMap.set(p.id, p.data()));
  } catch (e) {
    console.warn('[comissao] não foi possível carregar profissionais em lote:', e);
  }

  const map = new Map();
  for (const a of ags) {
    const pid = a.profissionalId || '(sem)';
    const profData = profMap.get(pid) || null;
    const preco = Number(a.servicoPreco || a.preco || a.valor || 0);

    let commissionPct = 0;
    if (profData) {
      if (profData.comissaoPorServico && a.servicoId && typeof profData.comissaoPorServico[a.servicoId] !== 'undefined') {
        commissionPct = Number(profData.comissaoPorServico[a.servicoId]) || 0;
      } else if (typeof profData.comissaoPadrao === 'number') {
        commissionPct = Number(profData.comissaoPadrao) || 0;
      }
    }
    const employeeAmount = Number((preco * (commissionPct / 100)).toFixed(2));
    const ownerAmount = Number((preco - employeeAmount).toFixed(2));

    const cur = map.get(pid) || { totalFaturado:0, totalFuncionario:0, totalLiquido:0, profissionalNome: (a.profissionalNome || (profData && (profData.nome || profData.name)) || pid), commissionWeightSum:0 };
    cur.totalFaturado += preco;
    cur.totalFuncionario += employeeAmount;
    cur.totalLiquido += ownerAmount;
    cur.commissionWeightSum += employeeAmount;
    map.set(pid, cur);
  }

  const aggregates = Array.from(map.entries()).map(([pid, v]) => {
    const avgCommissionPct = v.totalFaturado > 0 ? (v.commissionWeightSum / v.totalFaturado) * 100 : 0;
    return {
      profissionalId: pid,
      profissionalNome: v.profissionalNome,
      totalFaturado: Number(v.totalFaturado.toFixed(2)),
      totalFuncionario: Number(v.totalFuncionario.toFixed(2)),
      totalLiquido: Number(v.totalLiquido.toFixed(2)),
      avgCommissionPct: Number(avgCommissionPct.toFixed(2))
    };
  }).sort((a,b) => b.totalFaturado - a.totalFaturado);
  return aggregates;
}

async function carregarRelatorioComissao() {
  const container = document.getElementById("comissao");
  container.innerHTML = "<p>Carregando relatório de comissões...</p>";
  try {
    const from = filtroInicio.value;
    const to = filtroFim.value;
    const profissionalFilter = filtroProfissional.value || "todos";

    let aggregates = await fetchCommissionAggregatesFromFirestore(empresaId, from, to, profissionalFilter);
    if (!aggregates) {
      aggregates = await calculateCommissionAggregatesLocal(empresaId, from, to, profissionalFilter);
    }

    const linhas = aggregates.map(a => [
      a.profissionalNome || a.profissionalId,
      fmtBRL(a.totalFaturado),
      (Number(a.avgCommissionPct || 0).toFixed(2) + ' %'),
      fmtBRL(a.totalFuncionario),
      fmtBRL(a.totalLiquido)
    ]);

    renderTabela(container, ["Profissional", "Valor faturado", "Comissão % (média ponderada)", "Valor funcionário", "Valor líquido (dono)"], linhas);
    adicionarBotaoExportar(container, "comissao");

  } catch (err) {
    console.error('[comissao] erro carregarRelatorioComissao', err);
    container.innerHTML = `<p>Erro ao gerar relatório de comissões: ${err.message || err}</p>`;
  }
}

/* ----------------------------- Inicialização ----------------------------- */

window.addEventListener("DOMContentLoaded", () => {
    // recapturar referências DOM (garante que botões e containers existem)
    filtroInicio = document.getElementById("filtro-data-inicio");
    filtroFim = document.getElementById("filtro-data-fim");
    filtroProfissional = document.getElementById("filtro-profissional");
    btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");

    // configurar listeners de abas (só agora que DOM está pronto)
    const abas = document.querySelectorAll(".aba");
    const conteudosAbas = document.querySelectorAll(".aba-conteudo");
    abas.forEach(botao => {
        botao.addEventListener("click", () => {
            abas.forEach(b => b.classList.remove("active"));
            botao.classList.add("active");
            const abaSelecionada = botao.dataset.aba;
            conteudosAbas.forEach(c => {
                c.classList.toggle("active", c.id === abaSelecionada);
            });
            carregarAbaDados(abaSelecionada);
        });
    });

    if (btnAplicarFiltro) {
      btnAplicarFiltro.addEventListener("click", () => {
          const abaAtivaBtn = document.querySelector(".aba.active");
          if (!abaAtivaBtn) return;
          carregarAbaDados(abaAtivaBtn.dataset.aba);
      });
    }

    setDatasPadrao();
    popularFiltroProfissionais();
    carregarAbaDados("servicos");
});
