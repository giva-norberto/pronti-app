// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO FINAL COM CORREÇÃO DE SINCRONIA)
// ======================================================================

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- Listas de Status para Controle Preciso ---
const STATUS_REALIZADO = ["realizado", "concluido", "concluído", "efetivado"];
const STATUS_EXCLUIR = ["nao compareceu", "ausente", "cancelado", "cancelado_pelo_gestor", "deletado"];
const STATUS_VALIDOS_DIA = ["ativo", "realizado", "concluido", "concluído", "efetivado"];

// --- FUNÇÕES UTILITÁRIAS ---

function debounce(fn, delay   ) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    try {
        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) return dataInicial;

        const donoId = empresaDoc.data().donoId;
        if (!donoId) return dataInicial;

        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", donoId, "configuracoes", "horarios");
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

// --- FUNÇÕES PRINCIPAIS DO DASHBOARD ---

async function obterMetricas(empresaId, dataSelecionada) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");

        const snapshotServicos = await getDocs(servicosRef);
        const mapaDePrecos = new Map();
        snapshotServicos.forEach(doc => {
            mapaDePrecos.set(doc.id, getPreco(doc.data(), new Map()));
        });

        const qDia = query(agRef, where("data", "==", dataSelecionada));
        const snapshotDia = await getDocs(qDia);
        let totalAgendamentosDia = 0, agendamentosPendentes = 0, faturamentoPrevistoDia = 0, faturamentoRealizadoDia = 0;
        snapshotDia.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            const preco = getPreco(ag, mapaDePrecos);
            if (STATUS_VALIDOS_DIA.includes(status)) totalAgendamentosDia++;
            if (STATUS_EXCLUIR.includes(status)) return;
            if (status === "ativo") agendamentosPendentes++;
            faturamentoPrevistoDia += preco;
            if (STATUS_REALIZADO.includes(status)) faturamentoRealizadoDia += preco;
        });

        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth();
        const pad = (n) => n.toString().padStart(2, '0');
        const inicioDoMesStr = `${anoAtual}-${pad(mesAtual + 1)}-01`;
        const ultimoDiaDoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
        const fimDoMesStr = `${anoAtual}-${pad(mesAtual + 1)}-${pad(ultimoDiaDoMes)}`;

        const qMes = query(agRef, where("data", ">=", inicioDoMesStr), where("data", "<=", fimDoMesStr));
        const snapshotMes = await getDocs(qMes);
        let faturamentoRealizadoMes = 0;
        snapshotMes.forEach((d) => {
            const ag = d.data();
            if (STATUS_REALIZADO.includes(getStatus(ag))) {
                faturamentoRealizadoMes += getPreco(ag, mapaDePrecos);
            }
        });

        return { totalAgendamentosDia, agendamentosPendentes, faturamentoRealizado: faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia };

    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevistoDia: 0, faturamentoRealizadoDia: 0 };
    }
}

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
            const status = getStatus(ag);
            
            if (STATUS_EXCLUIR.includes(status)) {
                return;
            }
            
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

// --- INICIALIZAÇÃO DA PÁGINA (CORRIGIDA) ---

async function iniciarDashboard(empresaId) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) return;

    // Define uma função separada para buscar e preencher os dados
    const atualizarPainel = async () => {
        const dataSelecionada = filtroData.value;
        
        // CORREÇÃO: Espera (await) que as buscas terminem ANTES de continuar.
        const [metricas, servicosSemana] = await Promise.all([
             obterMetricas(empresaId, dataSelecionada),
             obterServicosMaisVendidosSemana(empresaId)
        ]);
        
        // CORREÇÃO: Só chama preencherPainel DEPOIS que os dados chegaram.
        preencherPainel(metricas, servicosSemana);
    };

    // 1. Define a data inicial no filtro
    const hojeString = new Date().toISOString().split("T")[0];
    filtroData.value = await encontrarProximaDataDisponivel(empresaId, hojeString);
    
    // 2. Adiciona o listener para futuras mudanças
    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    
    // 3. Chama a função para carregar os dados pela primeira vez
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
