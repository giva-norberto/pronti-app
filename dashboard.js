// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO FINAL, SEGURA PARA MULTI-EMPRESA)
// ======================================================================

// ✅ Importa apenas o necessário, confiando no user-service para a sessão.
import { db } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { verificarAcesso } from './user-service.js';

// --- Constantes de Status (Sua lógica original, mantida) ---
const STATUS_REALIZADO = ["realizado", "concluido", "efetivado", "pago", "finalizado"];
const STATUS_EXCLUIR = ["nao compareceu", "ausente", "cancelado", "cancelado_pelo_gestor", "deletado"];
const STATUS_VALIDOS_DIA = ["ativo", "realizado", "concluido", "efetivado", "pago", "finalizado", "andamento", "agendado"];

// ======================================================================
// PONTO DE ENTRADA PRINCIPAL DA PÁGINA
// ======================================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fornece um feedback visual de que a página está validando o acesso.
        document.body.style.opacity = '0.5';

        // 1. CHAMA O "GUARDA": `verificarAcesso` é a única fonte da verdade.
        // Ele valida o usuário, a empresa e as permissões antes de tudo.
        const sessao = await verificarAcesso();

        // 2. ACESSO LIBERADO: Se o código chegou aqui, o usuário está 100% autorizado.
        // Agora, e somente agora, iniciamos o dashboard com os dados seguros da sessão.
        await iniciarDashboard(sessao);

    } catch (error) {
        // Se `verificarAcesso` rejeitar, ele já fez o redirecionamento necessário.
        // Apenas registramos no console para fins de depuração.
        if (error.message && !error.message.includes("Redirecionando")) {
           console.warn("Acesso à página negado pelo serviço:", error.message);
        }
    } finally {
        // Garante que a página seja exibida, mesmo em caso de erro (pois o usuário já terá sido redirecionado).
        document.body.style.opacity = '1';
    }
});

// ======================================================================
// FUNÇÕES DE LÓGICA DO DASHBOARD
// ======================================================================

/**
 * Inicia o dashboard APENAS com os dados seguros da sessão.
 * @param {object} sessao - O objeto de sessão validado vindo do `verificarAcesso`.
 */
async function iniciarDashboard(sessao) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) return;

    // ✅ Pega os dados DIRETAMENTE da sessão segura, a fonte da verdade.
    const { empresaId, user, isOwner } = sessao;
    
    // Se o usuário não for o dono (ou admin), os dados serão filtrados pelo ID dele.
    // Se for o dono, o filtro é nulo e ele vê os dados de todos os profissionais.
    const profissionalIdParaFiltro = isOwner ? null : user.uid;

    const atualizarPainel = async () => {
        const dataSelecionada = filtroData.value;
        const [metricas, servicosVendidos] = await Promise.all([
             obterMetricas(empresaId, profissionalIdParaFiltro, dataSelecionada),
             obterServicosMaisVendidos(empresaId, profissionalIdParaFiltro) 
        ]);
        preencherPainel(metricas, servicosVendidos);
    };

    const hojeString = new Date().toISOString().split("T")[0];
    filtroData.value = await encontrarProximaDataDisponivel(empresaId, profissionalIdParaFiltro, hojeString);
    
    // Adiciona o listener para o filtro de data.
    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    
    // Carrega os dados iniciais.
    await atualizarPainel();
}


// ======================================================================
// FUNÇÕES DE BUSCA DE DADOS (SUA LÓGICA ORIGINAL FOI MANTIDA E MELHORADA)
// ======================================================================

async function obterMetricas(empresaId, profissionalId, dataSelecionada) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const snapshotServicos = await getDocs(servicosRef);
        const mapaDePrecos = new Map();
        snapshotServicos.forEach(doc => { mapaDePrecos.set(doc.id, Number(doc.data().preco || doc.data().valor || 0)); });
        
        // Função auxiliar para adicionar o filtro de profissional apenas se necessário.
        const addProfissionalFilter = (queryConstraints) => profissionalId ? [...queryConstraints, where("profissionalId", "==", profissionalId)] : queryConstraints;

        const qDia = query(agRef, ...addProfissionalFilter([where("data", "==", dataSelecionada)]));
        const snapshotDia = await getDocs(qDia);
        let totalAgendamentosDia = 0, agendamentosPendentes = 0, faturamentoPrevistoDia = 0, faturamentoRealizadoDia = 0;
        snapshotDia.forEach((d) => {
            const ag = d.data(); const status = getStatus(ag); if (STATUS_EXCLUIR.includes(status)) return;
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosDia++; faturamentoPrevistoDia += getPreco(ag, mapaDePrecos);
                if (status === "ativo" || status === "agendado") agendamentosPendentes++;
                if (STATUS_REALIZADO.includes(status)) faturamentoRealizadoDia += getPreco(ag, mapaDePrecos);
            }
        });

        const hoje = new Date(), ano = hoje.getFullYear(), mes = hoje.getMonth();
        const inicioMes = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
        const fimMes = `${ano}-${String(mes + 1).padStart(2, '0')}-${new Date(ano, mes + 1, 0).getDate()}`;
        const qMes = query(agRef, ...addProfissionalFilter([where("data", ">=", inicioMes), where("data", "<=", fimMes)]));
        const snapshotMes = await getDocs(qMes);
        let faturamentoRealizadoMes = 0, totalAgendamentosMes = 0;
        snapshotMes.forEach((d) => {
            const ag = d.data(); const status = getStatus(ag); if (STATUS_EXCLUIR.includes(status)) return;
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosMes++; if (STATUS_REALIZADO.includes(status)) faturamentoRealizadoMes += getPreco(ag, mapaDePrecos);
            }
        });
        return { totalAgendamentosDia, agendamentosPendentes, faturamentoRealizado: faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia, totalAgendamentosMes };
    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevistoDia: 0, faturamentoRealizadoDia: 0, totalAgendamentosMes: 0 };
    }
}

async function obterServicosMaisVendidos(empresaId, profissionalId) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const q = profissionalId ? query(agRef, where("profissionalId", "==", profissionalId)) : query(agRef);
        const snapshot = await getDocs(q);
        const contagem = {};
        snapshot.forEach((d) => {
            const ag = d.data();
            if (STATUS_VALIDOS_DIA.includes(getStatus(ag))) {
                contagem[getServicoNome(ag)] = (contagem[getServicoNome(ag)] || 0) + 1;
            }
        });
        return contagem;
    } catch (e) {
        console.error("Erro ao buscar serviços mais vendidos:", e);
        return {};
    }
}

// ======================================================================
// FUNÇÕES DE UI E UTILITÁRIAS (SUA LÓGICA ORIGINAL FOI MANTIDA)
// ======================================================================

function preencherPainel(metricas, servicosVendidos) {
    const formatCurrency = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("faturamento-realizado").textContent = formatCurrency(metricas.faturamentoRealizado);
    document.getElementById("faturamento-previsto-dia").textContent = formatCurrency(metricas.faturamentoPrevistoDia);
    document.getElementById("faturamento-realizado-dia").textContent = formatCurrency(metricas.faturamentoRealizadoDia);
    document.getElementById("total-agendamentos-dia").textContent = metricas.totalAgendamentosDia;
    document.getElementById("agendamentos-pendentes").textContent = metricas.agendamentosPendentes;
    document.getElementById("total-agendamentos-mes").textContent = metricas.totalAgendamentosMes;
    const canvasEl = document.getElementById('servicos-mais-vendidos');
    if (canvasEl) {
        if (window.servicosChart) window.servicosChart.destroy();
        const entries = Object.entries(servicosVendidos).sort((a, b) => b[1] - a[1]).slice(0, 5);
        window.servicosChart = new window.Chart(canvasEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: entries.map(([nome]) => nome),
                datasets: [{
                    label: 'Vendas', data: entries.map(([, qtd]) => qtd),
                    backgroundColor: ['#6366f1','#4f46e5','#8b5cf6','#a78bfa','#fcd34d']
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }
    preencherResumoInteligente(servicosVendidos);
}

function preencherResumoInteligente(servicosVendidos) {
    const resumoEl = document.getElementById("resumo-inteligente");
    if (!resumoEl) return;
    let html = "<ul>";
    let servicoMaisAgendado = null, max = 0;
    for (const [nome, qtd] of Object.entries(servicosVendidos)) {
        if (qtd > max && nome && nome !== "Serviço não informado") {
            servicoMaisAgendado = nome;
            max = qtd;
        }
    }
    if (servicoMaisAgendado) {
        html += `<li>Seu serviço mais agendado: <strong>${servicoMaisAgendado}</strong>.</li>`;
    }
    resumoEl.innerHTML = html === "<ul></ul>" ? "" : html;
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function encontrarProximaDataDisponivel(empresaId, profissionalId, dataInicial) {
    try {
        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) return dataInicial;
        const idDoProfissionalParaAgenda = profissionalId || empresaDoc.data().donoId;
        if (!idDoProfissionalParaAgenda) return dataInicial;
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", idDoProfissionalParaAgenda, "configuracoes", "horarios");
        const horariosSnap = await getDoc(horariosRef);
        if (!horariosSnap.exists()) return dataInicial;
        const horarios = horariosSnap.data();
        const diaDaSemana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
        let dataAtual = new Date(`${dataInicial}T12:00:00`);
        for (let i = 0; i < 90; i++) {
            const nomeDia = diaDaSemana[dataAtual.getDay()];
            const diaConfig = horarios[nomeDia];
            if (diaConfig && diaConfig.ativo) {
                return dataAtual.toISOString().split("T")[0];
            }
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return dataInicial; 
    } catch (e) {
        console.error("Erro ao buscar próxima data disponível, usando hoje como padrão:", e);
        return dataInicial; 
    }
}

function normalizarString(str) {
    if (!str) return null;
    return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getStatus(ag) {
    const status = ag.status || ag.statusAgendamento;
    return normalizarString(status);
}

function getPreco(ag, mapaDePrecos) {
    let preco = ag.servicoPreco !== undefined ? ag.servicoPreco :
                ag.preco !== undefined ? ag.preco :
                ag.valor;
    if (preco !== undefined && preco !== null) return Number(preco) || 0;
    if (ag.servicoId && mapaDePrecos.has(ag.servicoId)) return Number(mapaDePrecos.get(ag.servicoId)) || 0;
    return 0;
}

function getServicoNome(ag) {
    return ag.servicoNome || ag.nomeServico || "Serviço não informado";
}
