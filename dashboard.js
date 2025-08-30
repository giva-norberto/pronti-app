// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO FINAL COM FATURAMENTO MENSAL CORRIGIDO)
// ======================================================================

// --- IMPORTS ---
import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// Se você usa a IA, descomente a linha abaixo.
// import { gerarResumoDiarioInteligente } from "./inteligencia.js";

// --- CONSTANTES DE NEGÓCIO ---
const STATUS_VALIDOS_DIA = ["ativo", "realizado"]; // Status para contagem do dia
const STATUS_PARA_PREVISAO_MES = ["ativo", "realizado", "concluido", "efetivado"]; // Status para previsão do mês
const STATUS_REALIZADOS_MES = ["realizado", "concluido", "efetivado"]; // Status para faturamento realizado do mês

// --- FUNÇÕES UTILITÁRIAS (Mantidas do seu código original) ---
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --- LÓGICA DE BUSCA DE DADOS ---

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    // Sua lógica original, sem alterações.
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

/**
 * [FUNÇÃO REVISADA E UNIFICADA]
 * Busca todas as métricas necessárias: resumo do dia selecionado E faturamento do mês inteiro.
 */
async function obterMetricas(empresaId, dataSelecionada) {
    try {
        const agora = new Date();
        const anoAtual = agora.getFullYear();
        const mesAtual = agora.getMonth();
        const inicioDoMesStr = new Date(anoAtual, mesAtual, 1).toISOString().split("T")[0];
        const fimDoMesStr = new Date(anoAtual, mesAtual + 1, 0).toISOString().split("T")[0];

        // 1. Busca agendamentos do DIA SELECIONADO para as métricas diárias
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const qDia = query(agRef, where("data", "==", dataSelecionada), where("status", "in", STATUS_VALIDOS_DIA));
        const snapshotDia = await getDocs(qDia);

        const resumoDia = {
            totalAgendamentosDia: snapshotDia.size,
            agendamentosPendentes: snapshotDia.docs.filter(d => d.data().status === 'ativo').length
        };

        // 2. Busca agendamentos do MÊS INTEIRO para o faturamento
        const qMes = query(agRef, where("data", ">=", inicioDoMesStr), where("data", "<=", fimDoMesStr));
        const snapshotMes = await getDocs(qMes);

        let faturamentoPrevistoMes = 0;
        let faturamentoRealizadoMes = 0;

        snapshotMes.forEach((d) => {
            const ag = d.data();
            const preco = Number(ag.servicoPreco) || 0;

            // Lógica de Faturamento Previsto (Mês)
            if (STATUS_PARA_PREVISAO_MES.includes(ag.status)) {
                faturamentoPrevistoMes += preco;
            }

            // Lógica de Faturamento Realizado (Mês)
            if (STATUS_REALIZADOS_MES.includes(ag.status)) {
                const dataHoraAgendamento = new Date(`${ag.data}T${ag.horario || '00:00:00'}`);
                if (dataHoraAgendamento <= agora) {
                    faturamentoRealizadoMes += preco;
                }
            }
        });

        // Retorna um objeto único com todas as métricas
        return { ...resumoDia, faturamentoRealizado: faturamentoRealizadoMes, faturamentoPrevisto: faturamentoPrevistoMes };

    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevisto: 0 };
    }
}


async function obterServicosMaisVendidosSemana(empresaId) {
    // Sua lógica original, sem alterações.
    try {
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 6);
        const dataISOInicio = inicioSemana.toISOString().split("T")[0];
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(agRef, where("data", ">=", dataISOInicio), where("data", "<=", hoje.toISOString().split("T")[0]), where("status", "in", STATUS_VALIDOS_DIA));
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

// --- FUNÇÕES DE RENDERIZAÇÃO NA UI ---

function preencherPainel(metricas, servicosSemana) {
    const formatCurrency = (value) => (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const faturamentoRealizadoEl = document.getElementById("faturamento-realizado");
    if (faturamentoRealizadoEl) faturamentoRealizadoEl.textContent = formatCurrency(metricas.faturamentoRealizado);

    const faturamentoPrevistoEl = document.getElementById("faturamento-previsto");
    if (faturamentoPrevistoEl) faturamentoPrevistoEl.textContent = formatCurrency(metricas.faturamentoPrevisto);
    
    const totalAgendamentosEl = document.getElementById("total-agendamentos-dia");
    if (totalAgendamentosEl) totalAgendamentosEl.textContent = metricas.totalAgendamentosDia;

    const agendamentosPendentesEl = document.getElementById("agendamentos-pendentes");
    if (agendamentosPendentesEl) agendamentosPendentesEl.textContent = metricas.agendamentosPendentes;
    
    // ...Sua lógica de gráfico e IA permanece aqui...
}

// --- FUNÇÃO DE INICIALIZAÇÃO DO DASHBOARD ---

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
        // Chama a nova função unificada de métricas
        const metricas = await obterMetricas(empresaId, dataSelecionada);
        const servicosSemana = await obterServicosMaisVendidosSemana(empresaId);
        preencherPainel(metricas, servicosSemana);
    };

    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    await atualizarPainel(); // Carga inicial dos dados.
}

// --- PONTO DE ENTRADA: AUTENTICAÇÃO E LÓGICA MULTIEMPRESA ---

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
