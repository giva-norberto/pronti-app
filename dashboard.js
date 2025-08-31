// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO FINAL COM LÓGICA DE CONTAGEM CORRIGIDA)
// ======================================================================

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- Listas de Status para Controle Preciso ---
const STATUS_REALIZADO = ["realizado", "concluido", "efetivado"];
// CORREÇÃO: Lista expandida para ignorar qualquer tipo de cancelamento/exclusão.
const STATUS_EXCLUIR = ["não compareceu", "ausente", "cancelado", "cancelado_pelo_gestor", "deletado"];
// CORREÇÃO: Status que contam como um agendamento válido no total do dia.
const STATUS_VALIDOS_DIA = ["ativo", "realizado", "concluido", "efetivado"];

// Debounce para filtro de data
function debounce(fn, delay ) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    // ...código sem alteração...
    try {
        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) return dataInicial;
        const donoId = empresaDoc.data().donoId;
        if (!donoId) return dataInicial;
        const horariosSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", donoId, "configuracoes", "horarios"));
        const horarios = horariosSnap.exists() ? horariosSnap.data() : null;
        if (!horarios) return dataInicial;
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
        console.error("Erro ao buscar próxima data disponível:", e);
        return dataInicial;
    }
}

// --- FUNÇÕES AUXILIARES "INTELIGENTES" PARA LER OS DADOS ---
function getStatus(ag) {
    const status = ag.status || ag.statusAgendamento;
    return status ? status.toLowerCase() : null;
}
function getPreco(ag) {
    const preco = ag.servicoPreco !== undefined ? ag.servicoPreco :
                  ag.preco !== undefined ? ag.preco :
                  ag.valor !== undefined ? ag.valor :
                  ag.servicoValor !== undefined ? ag.servicoValor :
                  ag.valorServico;
    return Number(preco) || 0;
}
function getServicoNome(ag) {
    return ag.servicoNome || ag.nomeServico || "Serviço não informado";
}

// --- FUNÇÃO DE MÉTRICAS COM CONTAGEM CORRIGIDA ---
async function obterMetricas(empresaId, dataSelecionada) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");

        const qDia = query(agRef, where("data", "==", dataSelecionada));
        const snapshotDia = await getDocs(qDia);

        let totalAgendamentosDia = 0, agendamentosPendentes = 0, faturamentoPrevistoDia = 0, faturamentoRealizadoDia = 0;

        snapshotDia.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            const preco = getPreco(ag);

            // CORREÇÃO: Total de agendamentos só conta os que são válidos para o dia.
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosDia++;
            }

            // Se o status for de exclusão, não entra nos cálculos de faturamento.
            if (STATUS_EXCLUIR.includes(status)) {
                return;
            }
            
            // Agendamentos pendentes (lógica correta)
            if (status === "ativo") {
                agendamentosPendentes++;
            }
            
            // Faturamento previsto (soma todos que não são excluídos)
            faturamentoPrevistoDia += preco;

            // Faturamento realizado (soma apenas os concluídos)
            if (STATUS_REALIZADO.includes(status)) {
                faturamentoRealizadoDia += preco;
            }
        });

        // --- 2. BUSCA SEPARADA PARA O FATURAMENTO MENSAL ---
        const anoAtual = new Date().getFullYear();
        const mesAtual = new Date().getMonth();
        const inicioDoMesStr = new Date(anoAtual, mesAtual, 1).toISOString().split("T")[0];
        const fimDoMesStr = new Date(anoAtual, mesAtual + 1, 0).toISOString().split("T")[0];

        const qMes = query(agRef, where("data", ">=", inicioDoMesStr), where("data", "<=", fimDoMesStr));
        const snapshotMes = await getDocs(qMes);

        let faturamentoRealizadoMes = 0;
        snapshotMes.forEach((d) => {
            const ag = d.data();
            if (STATUS_REALIZADO.includes(getStatus(ag))) {
                faturamentoRealizadoMes += getPreco(ag);
            }
        });

        return { totalAgendamentosDia, agendamentosPendentes, faturamentoRealizado: faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia };

    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevistoDia: 0, faturamentoRealizadoDia: 0 };
    }
}

// As demais funções (obterServicosMaisVendidosSemana, preencherPainel, etc.) não precisam de alteração.
// Colei abaixo para garantir o arquivo completo.

async function obterServicosMaisVendidosSemana(empresaId) {
    try {
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 6);
        const dataISOInicio = inicioSemana.toISOString().split("T")[0];
        const dataISOFim = hoje.toISOString().split("T")[0];
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(agRef, where("data", ">=", dataISOInicio), where("data", "<=", dataISOFim));
        const snapshot = await getDocs(q);
        const contagem = {};
        snapshot.forEach((d) => {
            const ag = d.data();
            if (STATUS_EXCLUIR.includes(getStatus(ag))) return;
            const nome = getServicoNome(ag);
            contagem[nome] = (contagem[nome] || 0) + 1;
        });
        return contagem;
    } catch (e) {
        console.error("Erro ao buscar serviços semanais:", e);
        return {};
    }
}

function preencherPainel(metricas, servicosSemana) {
    const formatCurrency = (value) => (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("faturamento-realizado").textContent = formatCurrency(metricas.faturamentoRealizado);
    document.getElementById("faturamento-previsto-dia").textContent = formatCurrency(metricas.faturamentoPrevistoDia);
    document.getElementById("faturamento-realizado-dia").textContent = formatCurrency(metricas.faturamentoRealizadoDia);
    document.getElementById("total-agendamentos-dia").textContent = metricas.totalAgendamentosDia;
    document.getElementById("agendamentos-pendentes").textContent = metricas.agendamentosPendentes;
    const ctx = document.getElementById('servicos-mais-vendidos').getContext('2d');
    if (window.servicosChart) window.servicosChart.destroy();
    window.servicosChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(servicosSemana),
            datasets: [{
                label: 'Vendas',
                data: Object.values(servicosSemana),
                backgroundColor: ['#6366f1','#4f46e5','#8b5cf6','#a78bfa','#fcd34d','#f87171','#34d399','#60a5fa']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

async function iniciarDashboard(empresaId) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) return;
    const hojeString = new Date().toISOString().split("T")[0];
    filtroData.value = await encontrarProximaDataDisponivel(empresaId, hojeString);
    const atualizarPainel = async () => {
        const dataSelecionada = filtroData.value;
        const [metricas, servicosSemana] = await Promise.all([
             obterMetricas(empresaId, dataSelecionada),
             obterServicosMaisVendidosSemana(empresaId)
        ]);
        preencherPainel(metricas, servicosSemana);
    };
    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    await atualizarPainel();
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    try {
        let empresaId = localStorage.getItem("empresaAtivaId");
        if (!empresaId) {
            const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                alert("Nenhuma empresa encontrada. Por favor, cadastre sua empresa.");
                window.location.href = 'cadastro-empresa.html';
                return;
            } else if (snapshot.docs.length === 1) {
                empresaId = snapshot.docs[0].id;
                localStorage.setItem("empresaAtivaId", empresaId);
            } else {
                alert("Você tem várias empresas. Por favor, selecione uma para continuar.");
                window.location.href = 'selecionar-empresa.html';
                return;
            }
        }
        await iniciarDashboard(empresaId);
    } catch (error) {
        console.error("Erro crítico na inicialização do dashboard:", error);
        alert("Ocorreu um erro ao carregar seus dados. Por favor, tente fazer login novamente.");
        window.location.href = "login.html";
    }
});
