import { db } from "./firebase-config.js"; // Seu Firebase já inicializado
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const abas = document.querySelectorAll(".aba");
const conteudosAbas = document.querySelectorAll(".aba-conteudo");
const filtroInicio = document.getElementById("filtro-data-inicio");
const filtroFim = document.getElementById("filtro-data-fim");
const filtroProfissional = document.getElementById("filtro-profissional");
const btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");

// Pega empresa ativa do localStorage
let empresaId = localStorage.getItem("empresaAtivaId");
if (!empresaId) {
    alert("Nenhuma empresa ativa encontrada. Selecione uma empresa.");
    window.location.href = "selecionar-empresa.html";
}

// Troca de abas
abas.forEach(botao => {
    botao.addEventListener("click", () => {
        // Remove active de todos
        abas.forEach(b => b.classList.remove("active"));
        botao.classList.add("active");

        // Mostra apenas a aba correspondente
        const abaSelecionada = botao.dataset.aba;
        conteudosAbas.forEach(c => {
            if (c.id === abaSelecionada) {
                c.classList.add("active");
            } else {
                c.classList.remove("active");
            }
        });

        // Atualiza conteúdo da aba
        carregarAbaDados(abaSelecionada);
    });
});

// Placeholder inicial ou chama função real ao aplicar filtro
btnAplicarFiltro.addEventListener("click", () => {
    const abaAtivaBtn = document.querySelector(".aba.active");
    if (!abaAtivaBtn) return;
    const abaAtiva = abaAtivaBtn.dataset.aba;

    carregarAbaDados(abaAtiva);
});

// Setar filtro de datas para mês atual
function setDatasPadrao() {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = hoje;
    const pad = n => n.toString().padStart(2, '0');
    const f = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    filtroInicio.value = f(inicio);
    filtroFim.value = f(fim);
}

// Preencher dropdown de profissionais
async function popularFiltroProfissionais() {
    if (!filtroProfissional) return;
    filtroProfissional.innerHTML = '<option value="todos">Todos</option>';
    try {
        const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = data.nome;
            filtroProfissional.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao buscar profissionais:", error);
    }
}

// Carregar dados reais da aba selecionada
function carregarAbaDados(abaId) {
    switch (abaId) {
        case "resumo":
            carregarResumoDiario();
            break;
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
        default:
            carregarAbaPlaceholder(abaId);
    }
}

// Carregar Resumo Diário com dados reais
async function carregarResumoDiario() {
    const container = document.getElementById("resumo");
    container.innerHTML = "<p>Carregando...</p>";

    const dataSelecionada = filtroInicio.value; // Resumo Diário usa só uma data (do filtro de início)
    const profissionalId = filtroProfissional.value;
    let agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");

    try {
        const snapshot = await getDocs(agendamentosRef);
        let agendamentos = [];

        snapshot.forEach(doc => {
            let ag = doc.data();
            ag.id = doc.id;

            // Filtro por data (formato 'YYYY-MM-DD')
            if (ag.data !== dataSelecionada) return;
            // Filtro status ativo
            if (ag.status !== "ativo") return;
            // Filtro profissional
            if (profissionalId !== "todos" && ag.profissionalId !== profissionalId) return;

            agendamentos.push(ag);
        });

        // Métricas
        const totalAgend = agendamentos.length;
        const totalFaturamento = agendamentos.reduce((tot, ag) => tot + (parseFloat(ag.servicoPreco) || 0), 0);

        // Serviço em destaque
        let servicosCount = {};
        agendamentos.forEach(ag => {
            if (ag.servicoNome) {
                servicosCount[ag.servicoNome] = (servicosCount[ag.servicoNome] || 0) + 1;
            }
        });
        const servicoDestaque = Object.keys(servicosCount).sort((a, b) => servicosCount[b] - servicosCount[a])[0];

        // Profissional em destaque
        let profCount = {};
        agendamentos.forEach(ag => {
            if (ag.profissionalNome) {
                profCount[ag.profissionalNome] = (profCount[ag.profissionalNome] || 0) + 1;
            }
        });
        const profissionalDestaque = Object.keys(profCount).sort((a, b) => profCount[b] - profCount[a])[0];

        // Renderizando
        container.innerHTML = `
            <div style="font-size:1.11em;">
                <p><b>Total de agendamentos:</b> ${totalAgend}</p>
                <p><b>Faturamento do dia:</b> R$ ${totalFaturamento.toFixed(2)}</p>
                <p><b>Serviço em destaque:</b> ${servicoDestaque || "N/D"}</p>
                <p><b>Profissional em destaque:</b> ${profissionalDestaque || "N/D"}</p>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Carregar Serviços mais solicitados
async function carregarRelatorioServicos() {
    const container = document.getElementById("servicos");
    container.innerHTML = "<p>Carregando...</p>";

    const dataInicio = filtroInicio.value;
    const dataFim = filtroFim.value;
    const profissionalId = filtroProfissional.value;
    let agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");

    try {
        const snapshot = await getDocs(agendamentosRef);
        let agendamentos = [];

        snapshot.forEach(doc => {
            let ag = doc.data();
            ag.id = doc.id;

            // Filtros por data, status, profissional
            if (ag.data < dataInicio || ag.data > dataFim) return;
            if (ag.status !== "ativo") return;
            if (profissionalId !== "todos" && ag.profissionalId !== profissionalId) return;

            agendamentos.push(ag);
        });

        // Agrupamento por serviço
        let servicos = {};
        agendamentos.forEach(ag => {
            if (!ag.servicoNome) return;
            if (!servicos[ag.servicoNome]) {
                servicos[ag.servicoNome] = { qtd: 0, total: 0 };
            }
            servicos[ag.servicoNome].qtd += 1;
            servicos[ag.servicoNome].total += parseFloat(ag.servicoPreco) || 0;
        });

        // Render tabela
        let linhas = Object.entries(servicos)
            .sort((a, b) => b[1].qtd - a[1].qtd)
            .map(([nome, info]) =>
                `<tr>
                    <td>${nome}</td>
                    <td>${info.qtd}</td>
                    <td>R$ ${info.total.toFixed(2)}</td>
                </tr>`
            ).join("");

        container.innerHTML = linhas
            ? `<table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left;">Serviço</th>
                    <th>Qtd</th>
                    <th>Faturamento</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
              </table>`
            : "<p>Nenhum serviço encontrado no período.</p>";
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Carregar Profissionais
async function carregarRelatorioProfissionais() {
    const container = document.getElementById("profissionais");
    container.innerHTML = "<p>Carregando...</p>";

    const dataInicio = filtroInicio.value;
    const dataFim = filtroFim.value;
    let agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");

    try {
        const snapshot = await getDocs(agendamentosRef);
        let agendamentos = [];

        snapshot.forEach(doc => {
            let ag = doc.data();
            ag.id = doc.id;

            // Filtros por data, status
            if (ag.data < dataInicio || ag.data > dataFim) return;
            if (ag.status !== "ativo") return;

            agendamentos.push(ag);
        });

        // Agrupamento por profissional
        let profs = {};
        agendamentos.forEach(ag => {
            if (!ag.profissionalNome) return;
            if (!profs[ag.profissionalNome]) {
                profs[ag.profissionalNome] = { qtd: 0, total: 0 };
            }
            profs[ag.profissionalNome].qtd += 1;
            profs[ag.profissionalNome].total += parseFloat(ag.servicoPreco) || 0;
        });

        // Render tabela
        let linhas = Object.entries(profs)
            .sort((a, b) => b[1].qtd - a[1].qtd)
            .map(([nome, info]) =>
                `<tr>
                    <td>${nome}</td>
                    <td>${info.qtd}</td>
                    <td>R$ ${info.total.toFixed(2)}</td>
                </tr>`
            ).join("");

        container.innerHTML = linhas
            ? `<table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left;">Profissional</th>
                    <th>Qtd Atendimentos</th>
                    <th>Faturamento</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
              </table>`
            : "<p>Nenhum profissional com atendimentos no período.</p>";
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Carregar Faturamento
async function carregarRelatorioFaturamento() {
    const container = document.getElementById("faturamento");
    container.innerHTML = "<p>Carregando...</p>";

    const dataInicio = filtroInicio.value;
    const dataFim = filtroFim.value;
    const profissionalId = filtroProfissional.value;
    let agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");

    try {
        const snapshot = await getDocs(agendamentosRef);
        let agendamentos = [];

        snapshot.forEach(doc => {
            let ag = doc.data();
            ag.id = doc.id;

            // Filtros por data, status, profissional
            if (ag.data < dataInicio || ag.data > dataFim) return;
            if (ag.status !== "ativo") return;
            if (profissionalId !== "todos" && ag.profissionalId !== profissionalId) return;

            agendamentos.push(ag);
        });

        // Total faturamento
        const totalFaturamento = agendamentos.reduce((tot, ag) => tot + (parseFloat(ag.servicoPreco) || 0), 0);

        // Agrupamento opcional (por serviço)
        let servicos = {};
        agendamentos.forEach(ag => {
            if (!ag.servicoNome) return;
            if (!servicos[ag.servicoNome]) {
                servicos[ag.servicoNome] = 0;
            }
            servicos[ag.servicoNome] += parseFloat(ag.servicoPreco) || 0;
        });

        // Render
        let linhas = Object.entries(servicos)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, total]) => `<tr><td>${nome}</td><td>R$ ${total.toFixed(2)}</td></tr>`)
            .join("");

        container.innerHTML = `
            <div>
                <p><b>Faturamento total:</b> R$ ${totalFaturamento.toFixed(2)}</p>
                <h4 style="margin:18px 0 7px 0;">Por serviço:</h4>
                ${
                  linhas
                    ? `<table style="width:100%;border-collapse:collapse;">
                        <thead>
                          <tr>
                            <th style="text-align:left;">Serviço</th>
                            <th>Faturamento</th>
                          </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                      </table>`
                    : "<p>Nenhum faturamento no período.</p>"
                }
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Carregar Clientes
async function carregarRelatorioClientes() {
    const container = document.getElementById("clientes");
    container.innerHTML = "<p>Carregando...</p>";

    // Busque clientes
    let clientesRef = collection(db, "empresarios", empresaId, "clientes");
    let agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");

    try {
        // Busca agendamentos primeiro (para relacionamento)
        const [snapshotClientes, snapshotAgendamentos] = await Promise.all([
            getDocs(clientesRef),
            getDocs(agendamentosRef)
        ]);

        // Mapear agendamentos por clienteId
        let agPorCliente = {};
        snapshotAgendamentos.forEach(doc => {
            let ag = doc.data();
            if (ag.status !== "ativo") return;
            if (!ag.clienteId) return;
            if (!agPorCliente[ag.clienteId]) agPorCliente[ag.clienteId] = [];
            agPorCliente[ag.clienteId].push(ag);
        });

        let linhas = [];
        snapshotClientes.forEach(doc => {
            let c = doc.data();
            let ags = agPorCliente[doc.id] || [];
            let ultimoAt = ags.length ? ags.map(a => a.data).sort().reverse()[0] : "-";
            linhas.push(
                `<tr>
                    <td>${c.nome}</td>
                    <td>${ags.length}</td>
                    <td>${ultimoAt}</td>
                </tr>`
            );
        });

        container.innerHTML = linhas.length
            ? `<table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left;">Cliente</th>
                    <th>Total atendimentos</th>
                    <th>Último atendimento</th>
                  </tr>
                </thead>
                <tbody>${linhas.join("")}</tbody>
              </table>`
            : "<p>Nenhum cliente encontrado.</p>";
    } catch (e) {
        container.innerHTML = `<p>Erro ao buscar dados: ${e.message}</p>`;
    }
}

// Carregar placeholder (caso alguma aba não implementada)
function carregarAbaPlaceholder(abaId) {
    const container = document.getElementById(abaId);
    if (!container) return;

    switch (abaId) {
        case "resumo":
            container.innerHTML = `<p>Resumo diário será exibido aqui.</p>`;
            break;
        case "servicos":
            container.innerHTML = `<p>Lista de serviços e métricas será exibida aqui.</p>`;
            break;
        case "profissionais":
            container.innerHTML = `<p>Lista de profissionais e métricas será exibida aqui.</p>`;
            break;
        case "faturamento":
            container.innerHTML = `<p>Resumo financeiro será exibido aqui.</p>`;
            break;
        case "clientes":
            container.innerHTML = `<p>Lista de clientes e métricas será exibida aqui.</p>`;
            break;
        default:
            container.innerHTML = `<p>Conteúdo não disponível.</p>`;
    }
}

// Inicializações
window.addEventListener("DOMContentLoaded", () => {
    setDatasPadrao();
    popularFiltroProfissionais();
    // Carrega aba inicial (Resumo Diário)
    carregarAbaDados("resumo");
});
