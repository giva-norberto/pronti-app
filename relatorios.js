// relatorios.js (VERSÃO CORRIGIDA E COMPLETA)
// Mantive a lógica existente e acrescentei somente a funcionalidade de buscar os cálculos de comissão
// diretamente do Firestore (com fallback para calcular localmente se os cálculos pré-computados não existirem).

// CORREÇÃO 1: Importando a instância 'db' do arquivo de configuração central.
import { db } from "./firebase-config.js";

// CORREÇÃO 2: Atualizando a versão do Firestore para consistência.
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// DOM Elements (mantidos conforme seu arquivo original)
const abas = document.querySelectorAll(".aba" );
const conteudosAbas = document.querySelectorAll(".aba-conteudo");
const filtroInicio = document.getElementById("filtro-data-inicio");
const filtroFim = document.getElementById("filtro-data-fim");
const filtroProfissional = document.getElementById("filtro-profissional");
const btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");

// ---- EXPORTAÇÃO CSV ----
function exportarTabelaCSV(abaId) {
    const table = document.querySelector(`#${abaId} table`);
    if (!table) return;
    let csv = [];
    for (let row of table.rows) {
        let cols = Array.from(row.cells).map(td => `"${td.innerText.replace(/"/g, '""')}"`);
        csv.push(cols.join(";")); // Usar ponto e vírgula para compatibilidade com Excel PT-BR
    }
    // Adiciona BOM UTF-8 para acentos no Excel
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `relatorio-${abaId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Adiciona botão de exportação CSV em cada aba (após renderização)
function adicionarBotaoExportar(container, abaId) {
    // Remove botão anterior se já existir
    let oldBtn = container.querySelector('.btn-exportar-csv');
    if (oldBtn) oldBtn.remove();
    // Cria botão
    let btn = document.createElement('button');
    btn.className = 'btn-exportar-csv';
    btn.innerHTML = '<i class="fa-solid fa-file-csv"></i> Exportar CSV';
    btn.style.marginBottom = '18px';
    btn.onclick = () => exportarTabelaCSV(abaId);
    container.prepend(btn);
}

// Empresa ativa
let empresaId = localStorage.getItem("empresaAtivaId");
if (!empresaId) {
    alert("Nenhuma empresa ativa encontrada. Selecione uma empresa.");
    window.location.href = "selecionar-empresa.html";
}

// Busca agendamentos filtrados do Firestore, considerando o status conforme o tipo de relatório
async function buscarAgendamentos({inicio, fim, profissionalId, statusFiltro}) {
    // Nota: o código original esperava filtros por data/status como strings ISO no campo 'data'
    // Aqui usamos where com os parâmetros que o seu Firestore espera (mantendo a lógica)
    let filtros = [
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
        let ags = [];
        snapshot.forEach(docSnap => {
            let ag = docSnap.data();
            ag.id = docSnap.id;
            ags.push(ag);
        });
        return ags;
    } catch (e) {
        console.error("Erro ao buscar agendamentos:", e);
        throw e;
    }
}

// Função utilitária para renderizar tabelas
function renderTabela(container, colunas, linhas) {
    if (!linhas || !linhas.length) {
        container.innerHTML = "<p>Nenhum dado encontrado no período.</p>";
        return;
    }
    let ths = colunas.map(c => `<th style="text-align:left;">${c}</th>`).join("");
    let trs = linhas.map(l => `<tr>${l.map(td => `<td>${td}</td>`).join("")}</tr>`).join("");
    container.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
    </table>`;
}

// Troca de abas
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

// Aplicar filtro
btnAplicarFiltro.addEventListener("click", () => {
    const abaAtivaBtn = document.querySelector(".aba.active");
    if (!abaAtivaBtn) return;
    carregarAbaDados(abaAtivaBtn.dataset.aba);
});

// Datas padrão: mês atual
function setDatasPadrao() {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = hoje;
    const pad = n => n.toString().padStart(2, '0');
    const f = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    filtroInicio.value = f(inicio);
    filtroFim.value = f(fim);
}

// Profissionais
async function popularFiltroProfissionais() {
    if (!filtroProfissional) return;
    filtroProfissional.innerHTML = '<option value="todos">Todos</option>';
    try {
        // A função 'collection' aqui agora funciona porque 'db' foi importado.
        const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = data.nome || data.name || docSnap.id;
            filtroProfissional.appendChild(option);
        });
    } catch (error) {
        // Esta é a linha 140 do seu erro original.
        console.error("Erro ao buscar profissionais:", error);
    }
}

// Dados das abas
function carregarAbaDados(abaId) {
    switch (abaId) {
        case "servicos":
            carregarRelatorioServicos();
            break;
        case "profissionais":
            carregarRelatorioProfissionais();
            break;
        case "faturamento":
            carregarRelatorioFaturamento();
            break;
        case "clientes":
            carregarRelatorioClientes();
            break;
        case "agenda":
            carregarRelatorioAgenda();
            break;
        case "comissao":
            carregarRelatorioComissao(); // NOVA aba: chama função adicionada ao final do arquivo
            break;
        default:
            carregarAbaPlaceholder(abaId);
    }
}

// Relatório Serviços - considera somente concluídos (realizado)
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
        // Agrupa
        let servicos = {};
        ags.forEach(ag => {
            if (!ag.servicoNome) return;
            if (!servicos[ag.servicoNome]) servicos[ag.servicoNome] = { qtd: 0, total: 0 };
            servicos[ag.servicoNome].qtd += 1;
            servicos[ag.servicoNome].total += parseFloat(ag.servicoPreco) || 0;
        });
        let linhas = Object.entries(servicos)
            .sort((a, b) => b[1].qtd - a[1].qtd)
            .map(([nome, info]) => [nome, info.qtd, `R$ ${info.total.toFixed(2)}`]);
        renderTabela(container, ["Serviço", "Qtd", "Faturamento"], linhas);
        adicionarBotaoExportar(container, "servicos");
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Relatório Profissionais - considera somente concluídos (realizado)
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
        let profs = {};
        ags.forEach(ag => {
            if (!ag.profissionalNome) return;
            if (!profs[ag.profissionalNome]) profs[ag.profissionalNome] = { qtd: 0, total: 0 };
            profs[ag.profissionalNome].qtd += 1;
            profs[ag.profissionalNome].total += parseFloat(ag.servicoPreco) || 0;
        });
        let linhas = Object.entries(profs)
            .sort((a, b) => b[1].qtd - a[1].qtd)
            .map(([nome, info]) => [nome, info.qtd, `R$ ${info.total.toFixed(2)}`]);
        renderTabela(container, ["Profissional", "Qtd Atendimentos", "Faturamento"], linhas);
        adicionarBotaoExportar(container, "profissionais");
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Relatório Faturamento - considera somente concluídos (realizado)
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
        let servicos = {};
        ags.forEach(ag => {
            if (!ag.servicoNome) return;
            if (!servicos[ag.servicoNome]) servicos[ag.servicoNome] = 0;
            servicos[ag.servicoNome] += parseFloat(ag.servicoPreco) || 0;
        });
        let linhas = Object.entries(servicos)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, total]) => [nome, `R$ ${total.toFixed(2)}`]);
        container.innerHTML = `<div>
            <p><b>Faturamento total:</b> R$ ${totalFaturamento.toFixed(2)}</p>
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

// Relatório Clientes - considera somente concluídos (realizado), não usa filtro por profissional
async function carregarRelatorioClientes() {
    const container = document.getElementById("clientes");
    container.innerHTML = "<p>Carregando...</p>";
    let clientesRef = collection(db, "empresarios", empresaId, "clientes");
    let agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");
    try {
        const [snapshotClientes, snapshotAgendamentos] = await Promise.all([
            getDocs(clientesRef),
            getDocs(agendamentosRef)
        ]);
        // Mapear agendamentos por clienteId e por período
        let agPorCliente = {};
        snapshotAgendamentos.forEach(docSnap => {
            let ag = docSnap.data();
            // Só conta atendimentos realizados
            if (ag.status !== "realizado") return;
            if (!ag.clienteId) return;
            // filtro de período (mantendo a mesma comparação que você usa em buscarAgendamentos)
            if (ag.data < filtroInicio.value || ag.data > filtroFim.value) return;
            if (!agPorCliente[ag.clienteId]) agPorCliente[ag.clienteId] = [];
            agPorCliente[ag.clienteId].push(ag);
        });
        let linhas = [];
        snapshotClientes.forEach(docSnap => {
            let c = docSnap.data();
            let ags = agPorCliente[docSnap.id] || [];
            let ultimoAt = ags.length ? ags.map(a => a.data).sort().reverse()[0] : "-";
            linhas.push([c.nome, ags.length, ultimoAt]);
        });
        renderTabela(container, ["Cliente", "Total atendimentos", "Último atendimento"], linhas);
        adicionarBotaoExportar(container, "clientes");
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Nova aba: Relatório Agenda (análise por status)
async function carregarRelatorioAgenda() {
    const container = document.getElementById("agenda");
    container.innerHTML = "<p>Carregando...</p>";
    try {
        // Busca todos os agendamentos do período para o profissional (todos status relevantes)
        const statusFiltro = ["ativo", "realizado", "cancelado", "cancelado_pelo_gestor", "nao_compareceu"];
        const ags = await buscarAgendamentos({
            inicio: filtroInicio.value,
            fim: filtroFim.value,
            profissionalId: filtroProfissional.value,
            statusFiltro
        });
        // Conta por status
        let contagem = {
            "ativo": 0,
            "realizado": 0,
            "nao_compareceu": 0,
            "cancelado": 0,
            "cancelado_pelo_gestor": 0
        };
        ags.forEach(ag => {
            if (contagem.hasOwnProperty(ag.status)) contagem[ag.status]++;
        });
        let linhas = [
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

// Placeholder
function carregarAbaPlaceholder(abaId) {
    const container = document.getElementById(abaId);
    if (!container) return;
    container.innerHTML = `<p>Conteúdo não disponível.</p>`;
}

/* ===================== NOVO: Funções para a aba COMISSÃO =====================
   Requisito: sem mudar nenhuma lógica atual — apenas buscar os cálculos de comissão
   no Firestore (se existirem) e apresentar na aba "comissao". Se os cálculos não
   estiverem pré-gerados no Firestore, o código faz o cálculo local (fallback).
   O arquivo tenta localizar os cálculos pré-computados em alguns caminhos comuns:
     - empresarios/{empresaId}/relatoriosComissao (coleção)
     - empresarios/{empresaId}/relatorios/comissao (subcollection)
     - relatoriosComissao (coleção global filtrada por empresaId)
   ========================================================================== */

// Formata BRL
function fmtBRL(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

// Tenta carregar aggregates de comissão pré-calculados no Firestore.
// Retorna array de objetos: { profissionalId, profissionalNome, totalFaturado, totalFuncionario, totalLiquido, avgCommissionPct }
async function fetchCommissionAggregatesFromFirestore(empresaId, from, to, profissionalFilter = "todos") {
    const candidatePaths = [
        () => collection(db, 'empresarios', empresaId, 'relatoriosComissao'),
        () => collection(db, 'empresarios', empresaId, 'relatorios', 'comissao'),
        () => collection(db, 'relatoriosComissao') // global collection, pode ter campo empresaId
    ];

    for (const getCol of candidatePaths) {
        try {
            const colRef = getCol();
            // if global collection, we will filter by empresaId
            let snap;
            if (colRef.path === `relatoriosComissao`) {
                // global collection -> filter by empresaId and date range if fields exist
                let q;
                try {
                    q = query(colRef, where('empresaId', '==', empresaId));
                } catch (e) {
                    q = colRef;
                }
                snap = await getDocs(q);
            } else {
                snap = await getDocs(colRef);
            }
            if (!snap.empty) {
                // Map docs -> aggregates (allow optional fields: periodo/from/to)
                const results = [];
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    // Optional: if the doc stores period, we may filter by it; if not, assume relevant
                    // Respect profissionalFilter if the stored docs include profissionalId
                    if (profissionalFilter && profissionalFilter !== "todos" && d.profissionalId && d.profissionalId !== profissionalFilter) {
                        return; // skip
                    }
                    // If documents store empresaId, ensure match
                    if (d.empresaId && d.empresaId !== empresaId) return;
                    // Accept docs that look like aggregated entries (have totals)
                    if (typeof d.totalFaturado !== 'undefined') {
                        results.push({
                            profissionalId: d.profissionalId || docSnap.id,
                            profissionalNome: d.profissionalNome || d.nome || d.profissional || docSnap.id,
                            totalFaturado: Number(d.totalFaturado || 0),
                            totalFuncionario: Number(d.totalFuncionario || 0),
                            totalLiquido: Number(d.totalLiquido || 0),
                            avgCommissionPct: typeof d.avgCommissionPct !== 'undefined' ? Number(d.avgCommissionPct) : (d.totalFaturado ? (Number(d.totalFuncionario) / Number(d.totalFaturado) * 100) : 0)
                        });
                    } else {
                        // skip documents without expected fields
                    }
                });
                if (results.length) return results;
            }
        } catch (err) {
            console.warn('[comissao] fetchCommissionAggregatesFromFirestore tentativa falhou em um caminho, tentando próximo:', err);
            // tentar próximo caminho
        }
    }
    // se nenhum caminho retornou dados, retorna null para sinalizar fallback
    return null;
}

// Fallback: calcula aggregates localmente (reaproveitando buscarAgendamentos)
async function calculateCommissionAggregatesLocal(empresaId, from, to, profissionalFilter = "todos") {
    // busca agendamentos concluídos no período
    const ags = await buscarAgendamentos({
        inicio: from,
        fim: to,
        profissionalId: profissionalFilter === 'todos' ? undefined : profissionalFilter,
        statusFiltro: ["realizado"]
    });
    // Map profissionalId -> aggregate
    const map = new Map();
    for (const a of ags) {
        const pid = a.profissionalId || '(sem)';
        // obter dados do profissional do Firestore (comissão padrão / por serviço)
        let profData = null;
        try {
            const profRef = doc(db, 'empresarios', empresaId, 'profissionais', pid);
            const profSnap = await getDoc(profRef);
            profData = profSnap && profSnap.exists() ? profSnap.data() : null;
        } catch (e) {
            profData = null;
        }
        const preco = Number(a.servicoPreco || a.preco || a.valor || 0);
        // determina comissão %
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
        cur.commissionWeightSum += employeeAmount; // we'll calculate avg pct = commissionWeightSum / totalFaturado *100
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

// Função principal que carrega o relatório de comissão (tenta buscar do Firestore primeiro)
async function carregarRelatorioComissao() {
    const container = document.getElementById("comissao");
    container.innerHTML = "<p>Carregando relatório de comissões...</p>";
    try {
        const from = filtroInicio.value;
        const to = filtroFim.value;
        const profissionalFilter = filtroProfissional.value || "todos";

        // 1) tentar buscar precomputed aggregates no Firestore
        let aggregates = await fetchCommissionAggregatesFromFirestore(empresaId, from, to, profissionalFilter);

        // 2) se não encontrou, calcular localmente (fallback)
        if (!aggregates) {
            aggregates = await calculateCommissionAggregatesLocal(empresaId, from, to, profissionalFilter);
        }

        // preparar linhas para renderTabela (mantendo consistência com outros relatórios)
        const linhas = aggregates.map(a => [
            a.profissionalNome || a.profissionalId,
            fmtBRL(a.totalFaturado),
            (Number(a.avgCommissionPct || 0).toFixed(2) + ' %'),
            fmtBRL(a.totalFuncionario),
            fmtBRL(a.totalLiquido)
        ]);

        // renderizar com cabeçalho específico
        renderTabela(container, ["Profissional", "Valor faturado", "Comissão % (média ponderada)", "Valor funcionário", "Valor líquido (dono)"], linhas);
        adicionarBotaoExportar(container, "comissao");

    } catch (err) {
        console.error('[comissao] erro carregarRelatorioComissao', err);
        container.innerHTML = `<p>Erro ao gerar relatório de comissões: ${err.message || err}</p>`;
    }
}

/* ===================== FIM: Aba COMISSÃO ===================== */

// Inicialização
window.addEventListener("DOMContentLoaded", () => {
    setDatasPadrao();
    popularFiltroProfissionais();
    carregarAbaDados("servicos");
});
