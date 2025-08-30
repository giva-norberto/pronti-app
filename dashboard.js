// ======================================================================
// ARQUIVO: DASHBOARD.JS (FUNCIONAL, MULTIEMPRESA, FIREBASE PURO, EXCLUINDO AUSENTE/NÃO COMPARECEU)
// ======================================================================

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Status para métricas
const STATUS_PREVISTO_DIA = ["ativo", "realizado", "concluido", "efetivado"];
const STATUS_REALIZADO = ["realizado", "concluido", "efetivado"];
const STATUS_SEMANA = ["ativo", "realizado"];
const STATUS_EXCLUIR_TOTAL = ["não compareceu", "ausente"];

// Debounce para filtro de data
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Descobre próxima data disponível, respeitando multiempresa
async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
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

// Busca todas as métricas do painel
async function obterMetricas(empresaId, dataSelecionada) {
    try {
        const agora = new Date();
        const anoAtual = agora.getFullYear();
        const mesAtual = agora.getMonth();
        const inicioDoMesStr = new Date(anoAtual, mesAtual, 1).toISOString().split("T")[0];
        const fimDoMesStr = new Date(anoAtual, mesAtual + 1, 0).toISOString().split("T")[0];

        // 1. Agendamentos do dia
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const qDia = query(agRef, where("data", "==", dataSelecionada));
        const snapshotDia = await getDocs(qDia);

        let totalAgendamentosDia = 0;
        let agendamentosPendentes = 0;
        let faturamentoPrevistoDia = 0;
        let faturamentoRealizadoDia = 0;

        snapshotDia.forEach((d) => {
            const ag = d.data();
            const preco = Number(ag.servicoPreco) || 0;
            // Exclui "não compareceu" e "ausente" do total do dia
            if (!STATUS_EXCLUIR_TOTAL.includes((ag.status || "").toLowerCase())) {
                totalAgendamentosDia += 1;
                if (ag.status === "ativo") agendamentosPendentes++;
                if (STATUS_PREVISTO_DIA.includes(ag.status)) faturamentoPrevistoDia += preco;
                if (STATUS_REALIZADO.includes(ag.status)) faturamentoRealizadoDia += preco;
            }
        });

        // 2. Faturamento mensal realizado
        const qMes = query(agRef, where("data", ">=", inicioDoMesStr), where("data", "<=", fimDoMesStr));
        const snapshotMes = await getDocs(qMes);

        let faturamentoRealizadoMes = 0;
        snapshotMes.forEach((d) => {
            const ag = d.data();
            const preco = Number(ag.servicoPreco) || 0;
            if (STATUS_REALIZADO.includes(ag.status)) {
                const dataHoraAgendamento = new Date(`${ag.data}T${ag.horario || '00:00:00'}`);
                if (dataHoraAgendamento <= agora) {
                    faturamentoRealizadoMes += preco;
                }
            }
        });

        return {
            totalAgendamentosDia,
            agendamentosPendentes,
            faturamentoRealizado: faturamentoRealizadoMes,
            faturamentoPrevistoDia,
            faturamentoRealizadoDia
        };
    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return {
            totalAgendamentosDia: 0,
            agendamentosPendentes: 0,
            faturamentoRealizado: 0,
            faturamentoPrevistoDia: 0,
            faturamentoRealizadoDia: 0
        };
    }
}

// Serviços mais vendidos na semana (multiempresa, só dados reais)
async function obterServicosMaisVendidosSemana(empresaId) {
    try {
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 6);
        const dataISOInicio = inicioSemana.toISOString().split("T")[0];
        const dataISOFim = hoje.toISOString().split("T")[0];
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(
            agRef,
            where("data", ">=", dataISOInicio),
            where("data", "<=", dataISOFim),
            where("status", "in", STATUS_SEMANA)
        );
        const snapshot = await getDocs(q);
        const contagem = {};
        snapshot.forEach((d) => {
            const ag = d.data();
            const nome = ag.servicoNome || "Serviço";
            contagem[nome] = (contagem[nome] || 0) + 1;
        });
        return contagem;
    } catch (e) {
        console.error("Erro ao buscar serviços semanais:", e);
        return {};
    }
}

// Preenche todos os cards e gráfico
function preencherPainel(metricas, servicosSemana) {
    const formatCurrency = (value) => (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Faturamento Mensal (realizado)
    const faturamentoRealizadoEl = document.getElementById("faturamento-realizado");
    if (faturamentoRealizadoEl) faturamentoRealizadoEl.textContent = formatCurrency(metricas.faturamentoRealizado);

    // Faturamento do Dia (realizado e previsto)
    const faturamentoPrevistoDiaEl = document.getElementById("faturamento-previsto-dia");
    if (faturamentoPrevistoDiaEl) faturamentoPrevistoDiaEl.textContent = formatCurrency(metricas.faturamentoPrevistoDia);

    const faturamentoRealizadoDiaEl = document.getElementById("faturamento-realizado-dia");
    if (faturamentoRealizadoDiaEl) faturamentoRealizadoDiaEl.textContent = formatCurrency(metricas.faturamentoRealizadoDia);

    // Agendamentos do dia
    const totalAgendamentosEl = document.getElementById("total-agendamentos-dia");
    if (totalAgendamentosEl) totalAgendamentosEl.textContent = metricas.totalAgendamentosDia;

    const agendamentosPendentesEl = document.getElementById("agendamentos-pendentes");
    if (agendamentosPendentesEl) agendamentosPendentesEl.textContent = metricas.agendamentosPendentes;

    // Gráfico de Serviços mais vendidos
    const ctx = document.getElementById('servicos-mais-vendidos').getContext('2d');
    const labels = Object.keys(servicosSemana);
    const data = Object.values(servicosSemana);

    if (window.servicosChart) window.servicosChart.destroy();
    window.servicosChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vendas',
                data: data,
                backgroundColor: ['#6366f1','#4f46e5','#8b5cf6','#a78bfa','#fcd34d','#f87171','#34d399','#60a5fa']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Inicializa o dashboard multiempresa
async function iniciarDashboard(empresaId) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) {
        console.warn("Elemento de filtro de data não encontrado.");
        return;
    }

    const hojeString = new Date().toISOString().split("T")[0];
    const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);
    filtroData.value = dataInicial;

    const atualizarPainel = async () => {
        const dataSelecionada = filtroData.value;
        const metricas = await obterMetricas(empresaId, dataSelecionada);
        const servicosSemana = await obterServicosMaisVendidosSemana(empresaId);
        preencherPainel(metricas, servicosSemana);
    };

    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    await atualizarPainel();
}

// Multiempresa: valida empresa ativa no localStorage, senão busca do user
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
