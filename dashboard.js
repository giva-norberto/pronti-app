// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO CORRIGIDA - CARDS COM DADOS CONFIÁVEIS)
// ======================================================================

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// --- Listas de Status para Controle Preciso ---
const STATUS_REALIZADO = ["realizado", "concluido", "efetivado", "pago", "finalizado"];
const STATUS_EXCLUIR = ["nao compareceu", "ausente", "cancelado", "cancelado_pelo_gestor", "deletado"];
const STATUS_VALIDOS_DIA = ["ativo", "realizado", "concluido", "efetivado", "pago", "finalizado", "andamento", "agendado"];

// --- FUNÇÕES UTILITÁRIAS ---
function debounce(fn, delay) {
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

// --- FUNÇÕES PRINCIPAIS DO DASHBOARD (CORRIGIDAS) ---
async function obterMetricas(empresaId, dataSelecionada) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");

        // Carregando mapa de preços dos serviços
        const snapshotServicos = await getDocs(servicosRef);
        const mapaDePrecos = new Map();
        snapshotServicos.forEach(doc => {
            const servicoData = doc.data();
            const precoServico = servicoData.preco || servicoData.valor || 0;
            mapaDePrecos.set(doc.id, Number(precoServico) || 0);
        });

        // --- Métricas do dia selecionado ---
        const qDia = query(agRef, where("data", "==", dataSelecionada));
        const snapshotDia = await getDocs(qDia);
        
        let totalAgendamentosDia = 0;
        let agendamentosPendentes = 0;
        let faturamentoPrevistoDia = 0;
        let faturamentoRealizadoDia = 0;

        snapshotDia.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            
            // Pular agendamentos excluídos/cancelados
            if (STATUS_EXCLUIR.includes(status)) return;
            
            const preco = getPreco(ag, mapaDePrecos);
            
            // Contar apenas agendamentos válidos
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosDia++;
                
                // Faturamento previsto: todos os agendamentos válidos
                faturamentoPrevistoDia += preco;
                
                // Agendamentos pendentes: apenas os ativos
                if (status === "ativo" || status === "agendado") {
                    agendamentosPendentes++;
                }
                
                // Faturamento realizado: apenas os concluídos
                if (STATUS_REALIZADO.includes(status)) {
                    faturamentoRealizadoDia += preco;
                }
            }
        });

        // --- Faturamento mensal (CORRIGIDO) ---
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
        let totalAgendamentosMes = 0;

        snapshotMes.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            
            // Pular agendamentos excluídos/cancelados
            if (STATUS_EXCLUIR.includes(status)) return;
            
            const preco = getPreco(ag, mapaDePrecos);
            
            // Contar todos os agendamentos válidos do mês
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosMes++;
                
                // Somar apenas o faturamento dos agendamentos realizados
                if (STATUS_REALIZADO.includes(status)) {
                    faturamentoRealizadoMes += preco;
                }
            }
        });

        console.log("Métricas calculadas:", {
            totalAgendamentosDia,
            agendamentosPendentes,
            faturamentoRealizadoMes,
            faturamentoPrevistoDia,
            faturamentoRealizadoDia,
            totalAgendamentosMes
        });

        return { 
            totalAgendamentosDia, 
            agendamentosPendentes, 
            faturamentoRealizado: faturamentoRealizadoMes, 
            faturamentoPrevistoDia, 
            faturamentoRealizadoDia,
            totalAgendamentosMes
        };

    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { 
            totalAgendamentosDia: 0, 
            agendamentosPendentes: 0, 
            faturamentoRealizado: 0, 
            faturamentoPrevistoDia: 0, 
            faturamentoRealizadoDia: 0,
            totalAgendamentosMes: 0
        };
    }
}

// --- Lógica do gráfico (agora mostra só os 5 mais vendidos) ---
async function obterServicosMaisVendidos(empresaId) {
    try {
        const hoje = new Date().toISOString().split("T")[0];
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");

        const qAtivos = query(agRef, where("data", ">=", hoje));
        const qConcluidos = query(agRef, where("data", "<", hoje));

        const [snapAtivos, snapConcluidos] = await Promise.all([getDocs(qAtivos), getDocs(qConcluidos)]);
        const snapshot = [...snapAtivos.docs, ...snapConcluidos.docs];

        const contagem = {};
        snapshot.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            if (!STATUS_VALIDOS_DIA.includes(status)) return;
            const nome = getServicoNome(ag);
            contagem[nome] = (contagem[nome] || 0) + 1;
        });

        return contagem;
    } catch (e) {
        console.error("Erro ao buscar serviços mais vendidos:", e);
        return {};
    }
}

// --- Resumo Inteligente 100% dinâmico (só mostra se houver dado real) ---
function preencherResumoInteligente(servicosVendidos) {
    const resumoEl = document.getElementById("resumo-inteligente");
    if (!resumoEl) return;

    let html = "<ul>";

    // Serviço mais agendado (se existir)
    let servicoMaisAgendado = null;
    let max = 0;
    for (const [nome, qtd] of Object.entries(servicosVendidos)) {
        if (qtd > max && nome && nome !== "Serviço não informado") {
            servicoMaisAgendado = nome;
            max = qtd;
        }
    }
    if (servicoMaisAgendado) {
        html += `<li>Seu serviço mais agendado: <strong>${servicoMaisAgendado}</strong>.</li>`;
    }

    html += "</ul>";
    // Só mostra a UL se houver pelo menos um item real
    resumoEl.innerHTML = html === "<ul></ul>" ? "" : html;
}

function preencherPainel(metricas, servicosVendidos) {
    const formatCurrency = (value) => {
        const numValue = Number(value) || 0;
        return numValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    // --- Card Faturamento Mensal (CORRIGIDO) ---
    const faturamentoMensalEl = document.getElementById("faturamento-realizado");
    if (faturamentoMensalEl) {
        faturamentoMensalEl.textContent = formatCurrency(metricas.faturamentoRealizado);
    }

    // --- Card Faturamento do Dia (CORRIGIDO) ---
    const faturamentoPrevistoDiaEl = document.getElementById("faturamento-previsto-dia");
    if (faturamentoPrevistoDiaEl) {
        faturamentoPrevistoDiaEl.textContent = formatCurrency(metricas.faturamentoPrevistoDia);
    }

    const faturamentoRealizadoDiaEl = document.getElementById("faturamento-realizado-dia");
    if (faturamentoRealizadoDiaEl) {
        faturamentoRealizadoDiaEl.textContent = formatCurrency(metricas.faturamentoRealizadoDia);
    }

    // --- Card Agendamentos do Dia ---
    const totalAgendamentosDiaEl = document.getElementById("total-agendamentos-dia");
    if (totalAgendamentosDiaEl) {
        totalAgendamentosDiaEl.textContent = metricas.totalAgendamentosDia;
    }

    const agendamentosPendentesEl = document.getElementById("agendamentos-pendentes");
    if (agendamentosPendentesEl) {
        agendamentosPendentesEl.textContent = metricas.agendamentosPendentes;
    }

    // --- Card Total Agendamentos Mês ---
    const totalMesEl = document.getElementById("total-agendamentos-mes");
    if (totalMesEl) {
        totalMesEl.textContent = metricas.totalAgendamentosMes;
    }

    // --- Gráfico de Serviços Mais Vendidos (apenas top 5) ---
    const canvasEl = document.getElementById('servicos-mais-vendidos');
    if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        if (window.servicosChart) window.servicosChart.destroy();

        // LIMITAR AO TOP 5 MAIS VENDIDOS
        const entries = Object.entries(servicosVendidos)
            .sort((a, b) => b[1] - a[1]) // Ordena do maior pro menor
            .slice(0, 5); // Pega só os 5 primeiros

        const labels = entries.map(([nome]) => nome);
        const values = entries.map(([, qtd]) => qtd);

        window.servicosChart = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vendas',
                    data: values,
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

    // --- Chamar Resumo Inteligente ---
    preencherResumoInteligente(servicosVendidos);
}

// --- INICIALIZAÇÃO DA PÁGINA (mantida igual) ---
async function iniciarDashboard(empresaId) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) return;

    const atualizarPainel = async () => {
        const dataSelecionada = filtroData.value;
        const [metricas, servicosVendidos] = await Promise.all([
             obterMetricas(empresaId, dataSelecionada),
             obterServicosMaisVendidos(empresaId) 
        ]);
        preencherPainel(metricas, servicosVendidos);
    };

    const hojeString = new Date().toISOString().split("T")[0];
    filtroData.value = await encontrarProximaDataDisponivel(empresaId, hojeString);
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
