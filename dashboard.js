// ======================================================================
// ARQUIVO: DASHBOARD.JS (VERSÃO SEGURA PARA MULTI-EMPRESA E MULTI-FUNCIONÁRIO)
// ======================================================================

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

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

        // Carregando mapa de preços dos serviços
        const snapshotServicos = await getDocs(servicosRef);
        const mapaDePrecos = new Map();
        snapshotServicos.forEach(doc => {
            const servicoData = doc.data();
            const precoServico = servicoData.preco || servicoData.valor || 0;
            mapaDePrecos.set(doc.id, Number(precoServico) || 0);
        });

        // --- Filtro Condicional ---
        const addProfissionalFilter = (q) => profissionalId ? [...q, where("profissionalId", "==", profissionalId)] : q;

        // --- Métricas do dia selecionado ---
        const qDia = query(agRef, ...addProfissionalFilter([where("data", "==", dataSelecionada)]));
        const snapshotDia = await getDocs(qDia);
        
        let totalAgendamentosDia = 0;
        let agendamentosPendentes = 0;
        let faturamentoPrevistoDia = 0;
        let faturamentoRealizadoDia = 0;

        snapshotDia.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            
            if (STATUS_EXCLUIR.includes(status)) return;
            
            const preco = getPreco(ag, mapaDePrecos);
            
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosDia++;
                faturamentoPrevistoDia += preco;
                if (status === "ativo" || status === "agendado") {
                    agendamentosPendentes++;
                }
                if (STATUS_REALIZADO.includes(status)) {
                    faturamentoRealizadoDia += preco;
                }
            }
        });

        // --- Faturamento mensal ---
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth();
        const pad = (n) => n.toString().padStart(2, '0');
        const inicioDoMesStr = `${anoAtual}-${pad(mesAtual + 1)}-01`;
        const ultimoDiaDoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
        const fimDoMesStr = `${anoAtual}-${pad(mesAtual + 1)}-${pad(ultimoDiaDoMes)}`;

        const qMes = query(agRef, ...addProfissionalFilter([where("data", ">=", inicioDoMesStr), where("data", "<=", fimDoMesStr)]));
        const snapshotMes = await getDocs(qMes);

        let faturamentoRealizadoMes = 0;
        let totalAgendamentosMes = 0;

        snapshotMes.forEach((d) => {
            const ag = d.data();
            const status = getStatus(ag);
            
            if (STATUS_EXCLUIR.includes(status)) return;
            
            const preco = getPreco(ag, mapaDePrecos);
            
            if (STATUS_VALIDOS_DIA.includes(status)) {
                totalAgendamentosMes++;
                if (STATUS_REALIZADO.includes(status)) {
                    faturamentoRealizadoMes += preco;
                }
            }
        });

        console.log("Métricas calculadas:", {
            totalAgendamentosDia, agendamentosPendentes, faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia, totalAgendamentosMes
        });

        return { 
            totalAgendamentosDia, agendamentosPendentes, faturamentoRealizado: faturamentoRealizadoMes, faturamentoPrevistoDia, faturamentoRealizadoDia, totalAgendamentosMes
        };

    } catch (e) {
        console.error("Erro ao obter métricas:", e);
        return { 
            totalAgendamentosDia: 0, agendamentosPendentes: 0, faturamentoRealizado: 0, faturamentoPrevistoDia: 0, faturamentoRealizadoDia: 0, totalAgendamentosMes: 0
        };
    }
}

// ✅ MODIFICADA para aceitar profissionalId e filtrar os dados
async function obterServicosMaisVendidos(empresaId, profissionalId) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        
        // Se profissionalId for fornecido, filtra por ele. Senão, busca todos.
        const q = profissionalId ? query(agRef, where("profissionalId", "==", profissionalId)) : query(agRef);
        
        const snapshot = await getDocs(q);

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

// --- Funções de UI (Seu código original, sem alterações) ---
function preencherResumoInteligente(servicosVendidos) {
    const resumoEl = document.getElementById("resumo-inteligente");
    if (!resumoEl) return;
    let html = "<ul>";
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
    resumoEl.innerHTML = html === "<ul></ul>" ? "" : html;
}

function preencherPainel(metricas, servicosVendidos) {
    const formatCurrency = (value) => (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById("faturamento-realizado").textContent = formatCurrency(metricas.faturamentoRealizado);
    document.getElementById("faturamento-previsto-dia").textContent = formatCurrency(metricas.faturamentoPrevistoDia);
    document.getElementById("faturamento-realizado-dia").textContent = formatCurrency(metricas.faturamentoRealizadoDia);
    document.getElementById("total-agendamentos-dia").textContent = metricas.totalAgendamentosDia;
    document.getElementById("agendamentos-pendentes").textContent = metricas.agendamentosPendentes;
    document.getElementById("total-agendamentos-mes").textContent = metricas.totalAgendamentosMes;

    const canvasEl = document.getElementById('servicos-mais-vendidos');
    if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        if (window.servicosChart) window.servicosChart.destroy();
        const entries = Object.entries(servicosVendidos).sort((a, b) => b[1] - a[1]).slice(0, 5);
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
    preencherResumoInteligente(servicosVendidos);
}

// --- INICIALIZAÇÃO DA PÁGINA (REVISADA PARA SEGURANÇA) ---

// ✅ MODIFICADA para receber os IDs necessários
async function iniciarDashboard(empresaId, profissionalId) {
    const filtroData = document.getElementById("filtro-data");
    if (!filtroData) return;

    const atualizarPainel = async () => {
        const dataSelecionada = filtroData.value;
        const [metricas, servicosVendidos] = await Promise.all([
             obterMetricas(empresaId, profissionalId, dataSelecionada),
             obterServicosMaisVendidos(empresaId, profissionalId) 
        ]);
        preencherPainel(metricas, servicosVendidos);
    };

    const hojeString = new Date().toISOString().split("T")[0];
    filtroData.value = await encontrarProximaDataDisponivel(empresaId, profissionalId, hojeString);
    filtroData.addEventListener("change", debounce(atualizarPainel, 300));
    
    await atualizarPainel();
}

// ✅ Bloco de inicialização principal REVISADO para determinar o papel do usuário
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    try {
        document.body.style.opacity = '0.5'; // Feedback visual

        let empresaId = localStorage.getItem("empresaAtivaId");
        if (!empresaId) {
            const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);
                if (mapaSnap.exists() && mapaSnap.data().empresas?.length === 1) {
                    empresaId = mapaSnap.data().empresas[0];
                    localStorage.setItem("empresaAtivaId", empresaId);
                } else {
                    window.location.replace('selecionar-empresa.html');
                    return;
                }
            } else if (snapshot.docs.length === 1) {
                empresaId = snapshot.docs[0].id;
                localStorage.setItem("empresaAtivaId", empresaId);
            } else {
                window.location.replace('selecionar-empresa.html');
                return;
            }
        }

        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) {
            localStorage.removeItem("empresaAtivaId");
            throw new Error("Empresa ativa não encontrada.");
        }

        const isOwner = empresaDoc.data().donoId === user.uid;
        const profissionalIdParaFiltro = isOwner ? null : user.uid;

        await iniciarDashboard(empresaId, profissionalIdParaFiltro);

    } catch (error) {
        console.error("Erro crítico na inicialização do dashboard:", error);
        alert("Ocorreu um erro ao carregar seus dados. Por favor, tente fazer login novamente.");
        window.location.replace("login.html");
    } finally {
        document.body.style.opacity = '1';
    }
});
