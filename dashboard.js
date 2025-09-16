// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO FINAL SEM CONFLITOS E SEGURA PARA MULTI-EMPRESA)
// ======================================================================

// ✅ 1. Importa o 'verificarAcesso' do seu serviço e remove 'auth' e 'onAuthStateChanged' daqui.
import { db } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { verificarAcesso } from './user-service.js';

// --- Listas de Status para Controle Preciso (Seu código original, sem alterações ) ---
const STATUS_REALIZADO = ["realizado", "concluido", "efetivado", "pago", "finalizado"];
const STATUS_EXCLUIR = ["nao compareceu", "ausente", "cancelado", "cancelado_pelo_gestor", "deletado"];
const STATUS_VALIDOS_DIA = ["ativo", "realizado", "concluido", "efetivado", "pago", "finalizado", "andamento", "agendado"];

// --- FUNÇÕES UTILITÁRIAS (Seu código original, com uma modificação) ---
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ✅ MODIFICADA para aceitar o ID do profissional e buscar a agenda correta
async function encontrarProximaDataDisponivel(empresaId, profissionalId, dataInicial) {
    try {
        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) return dataInicial;

        // Se o profissionalId não for fornecido (caso do dono), usa o donoId como padrão.
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

// --- FUNÇÕES PRINCIPAIS DO DASHBOARD (REVISADAS PARA SEGURANÇA) ---

// ✅ MODIFICADA para aceitar profissionalId e filtrar os dados
async function obterMetricas(empresaId, profissionalId, dataSelecionada) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");

        const snapshotServicos = await getDocs(servicosRef);
        const mapaDePrecos = new Map();
        snapshotServicos.forEach(doc => {
            mapaDePrecos.set(doc.id, Number(doc.data().preco || doc.data().valor || 0));
        });

        const addProfissionalFilter = (q) => profissionalId ? [...q, where("profissionalId", "==", profissionalId)] : q;

        const qDia = query(agRef, ...addProfissionalFilter([where("data", "==", dataSelecionada)]));
        const snapshotDia = await getDocs(qDia);
        
        let totalAgendamentosDia = 0, agendamentosPendentes = 0, faturamentoPrevistoDia = 0, faturamentoRealizadoDia = 0;
        snapshotDia.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            if (STATUS_EXCLUIR.includes(status)) return;
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosDia++;
                faturamentoPrevistoDia += getPreco(ag, mapaDePrecos);
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
            const ag = d.data();
            const status = getStatus(ag);
            if (STATUS_EXCLUIR.includes(status)) return;
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosMes++;
                if (STATUS_REALIZADO.includes(status)) faturamentoRealizadoMes += getPreco(ag, mapaDePrecos);
            }
        });

        console.log("Métricas calculadas:", { totalAgendamentosDia, agendamentosPendentes, faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia, totalAgendamentosMes });
        return { totalAgendamentosDia, agendamentosPendentes, faturamentoRealizado: faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia, totalAgendamentosMes };
    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevistoDia: 0, faturamentoRealizadoDia: 0, totalAgendamentosMes: 0 };
    }
}

// ✅ MODIFICADA para aceitar profissionalId e filtrar os dados
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

// --- Funções de UI (Seu código original, sem alterações) ---
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
                    label: 'Vendas',
                    data: entries.map(([, qtd]) => qtd),
                    backgroundColor: ['#6366f1','#4f46e5','#8b5cf6','#a78bfa','#fcd34d','#f87171','#34d399','#60a5fa']
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }
    preencherResumoInteligente(servicosVendidos);
}

// --- INICIALIZAÇÃO DA PÁGINA (REVISADA PARA SEGURANÇA) ---

// ✅ MODIFICADA para receber o objeto de sessão seguro
async function iniciarDashboard(sessao) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) return;

    const { empresaId, user, isOwner } = sessao;
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
    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    
    await atualizarPainel();
}

// ✅ 2. Bloco de inicialização final que confia 100% no user-service.js e elimina o 'onAuthStateChanged' local.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        document.body.style.opacity = '0.5'; // Mostra feedback visual de carregamento

        // Chama o 'verificarAcesso' que é a única fonte da verdade.
        // Ele já trata todos os redirecionamentos (login, selecionar-empresa, etc).
        const sessao = await verificarAcesso();

        // Se o código chegou aqui, significa que o usuário está autenticado,
        // tem uma empresa selecionada e permissão para estar nesta página.
        // Agora, iniciamos o dashboard com os dados seguros da sessão.
        await iniciarDashboard(sessao);

    } catch (error) {
        // Se 'verificarAcesso' rejeitar a promessa, ele já fez o redirecionamento.
        // Apenas registramos o erro aqui para depuração, não precisamos fazer mais nada.
        console.warn("Acesso negado pelo serviço, redirecionamento já efetuado:", error.message);
    } finally {
        // Garante que a página seja exibida, mesmo em caso de erro (pois o usuário já foi redirecionado).
        document.body.style.opacity = '1';
    }
});
