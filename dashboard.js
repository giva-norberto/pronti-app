// ======================================================================
//                       DASHBOARD.JS (VERSÃO ATUALIZADA)
//          Resumo do dia sem carregar todos os agendamentos completos
//          Multi-empresa, cards do dashboard e sugestão IA
// ======================================================================

import { verificarAcesso, checkUserStatus } from "./userService.js";
import { showCustomAlert } from "./custom-alert.js";
import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { gerarResumoDiarioInteligente } from "./inteligencia.js";

const totalSlots = 20;

// --------------------------------------------------
// UTILITÁRIOS
// --------------------------------------------------

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function getEmpresaIdAtiva() {
    const empresaId = localStorage.getItem("empresaAtivaId");
    if (!empresaId) {
        window.location.href = "selecionar-empresa.html";
        throw new Error("Empresa não selecionada.");
    }
    return empresaId;
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --------------------------------------------------
// FUNÇÕES PRINCIPAIS
// --------------------------------------------------

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    try {
        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) return dataInicial;
        const donoId = empresaDoc.data().donoId;
        if (!donoId) return dataInicial;

        const horariosSnap = await getDoc(doc(db, "empresarios", empresaId, "profissionais", donoId, "configuracoes", "horarios"));
        const horarios = horariosSnap.exists() ? horariosSnap.data() : null;
        if (!horarios) return dataInicial;

        const diaDaSemana = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
        let dataAtual = new Date(`${dataInicial}T12:00:00`);

        for (let i = 0; i < 90; i++) {
            const nomeDia = diaDaSemana[dataAtual.getDay()];
            const diaConfig = horarios[nomeDia];
            if (diaConfig && diaConfig.ativo) {
                if (i === 0) {
                    const ultimoBloco = diaConfig.blocos[diaConfig.blocos.length - 1];
                    const fimExpediente = timeStringToMinutes(ultimoBloco.fim);
                    const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
                    if (agoraMin < fimExpediente) return dataAtual.toISOString().split("T")[0];
                } else {
                    return dataAtual.toISOString().split("T")[0];
                }
            }
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return dataInicial;
    } catch (e) {
        console.error("Erro ao buscar próxima data disponível:", e);
        return dataInicial;
    }
}

// --------------------------------------------------
// RESUMO DO DIA (SEM CARREGAR TODOS AGENDAMENTOS)
// --------------------------------------------------

async function obterResumoDoDia(empresaId, dataSelecionada) {
    try {
        const agRef = collection(db, "empresarios", empresaId, "agendamentos");
        const q = query(agRef, where("data", "==", dataSelecionada), where("status", "==", "ativo"));
        const snapshot = await getDocs(q);

        let totalAgendamentos = snapshot.size;
        let faturamentoPrevisto = 0;
        let servicosCount = {};
        let profsCount = {};

        snapshot.forEach(doc => {
            const ag = doc.data();
            faturamentoPrevisto += parseFloat(ag.servicoPreco) || 0;
            if (ag.servicoNome) servicosCount[ag.servicoNome] = (servicosCount[ag.servicoNome] || 0) + 1;
            if (ag.profissionalNome) profsCount[ag.profissionalNome] = (profsCount[ag.profissionalNome] || 0) + 1;
        });

        const servicoDestaque = Object.keys(servicosCount).sort((a,b) => servicosCount[b]-servicosCount[a])[0];
        const profissionalDestaque = Object.keys(profsCount).sort((a,b) => profsCount[b]-profsCount[a])[0];

        return { totalAgendamentos, faturamentoPrevisto, servicoDestaque, profissionalDestaque };
    } catch (e) {
        console.error("Erro ao obter resumo do dia:", e);
        return { totalAgendamentos: 0, faturamentoPrevisto: 0, servicoDestaque: null, profissionalDestaque: null };
    }
}

// --------------------------------------------------
// FUNÇÕES PARA ATUALIZAR CARDS
// --------------------------------------------------

function preencherCardResumo(resumo) {
    const totalEl = document.getElementById("total-agendamentos-dia");
    const fatEl = document.getElementById("faturamento-previsto");
    const percEl = document.getElementById("percentual-ocupacao");
    if (!totalEl || !fatEl || !percEl) return;
    totalEl.textContent = resumo.totalAgendamentos;
    fatEl.textContent = resumo.faturamentoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    percEl.textContent = `${Math.min(100, Math.round((resumo.totalAgendamentos / totalSlots) * 100))}%`;
}

function preencherCardServico(servicoDestaque) {
    const el = document.getElementById("servico-destaque");
    if (el) el.textContent = servicoDestaque || "Nenhum";
}

function preencherCardProfissional(profissionalDestaque) {
    const nomeEl = document.getElementById("prof-destaque-nome");
    const qtdEl = document.getElementById("prof-destaque-qtd");
    if (!nomeEl || !qtdEl) return;
    if (profissionalDestaque) {
        nomeEl.textContent = profissionalDestaque;
        qtdEl.textContent = `Hoje`;
    } else {
        nomeEl.textContent = "Nenhum profissional";
        qtdEl.textContent = "hoje";
    }
}

function calcularSugestaoIA(resumo) {
    const ocupacaoPercent = Math.min(100, Math.round((resumo.totalAgendamentos / totalSlots) * 100));
    if (resumo.totalAgendamentos === 0) return "O dia está livre! Que tal criar uma promoção para atrair clientes?";
    else if (ocupacaoPercent < 50) return "Ainda há horários vagos. Considere enviar um lembrete aos clientes.";
    else return "O dia está movimentado! Prepare-se para um dia produtivo.";
}

function preencherCardIA(mensagem) {
    const el = document.getElementById("ia-sugestao");
    if (el) el.textContent = mensagem;
}

// --------------------------------------------------
// FUNÇÃO PRINCIPAL DO DASHBOARD
// --------------------------------------------------

async function preencherDashboard(user, dataSelecionada, empresaId) {
    try {
        const resumoDoDia = await obterResumoDoDia(empresaId, dataSelecionada);

        preencherCardResumo(resumoDoDia);
        preencherCardServico(resumoDoDia.servicoDestaque);
        preencherCardProfissional(resumoDoDia.profissionalDestaque);
        preencherCardIA(calcularSugestaoIA(resumoDoDia));

        // Resumo Inteligente via IA
        const resumoInteligente = gerarResumoDiarioInteligente([
            { quantidade: resumoDoDia.totalAgendamentos, faturamento: resumoDoDia.faturamentoPrevisto }
        ]);
        const elResumo = document.getElementById("resumo-inteligente");
        if (elResumo) elResumo.innerHTML = resumoInteligente?.mensagem || "Nenhum dado disponível.";

    } catch (error) {
        console.error("Erro ao preencher dashboard:", error);
        alert("Ocorreu um erro ao carregar o dashboard.");
    }
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------

async function iniciarDashboard(user, empresaId) {
    const filtroData = document.getElementById("filtro-data");
    const hojeString = new Date().toISOString().split("T")[0];
    const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);

    if (filtroData) {
        filtroData.value = dataInicial;
        filtroData.addEventListener("change", debounce(() => {
            preencherDashboard(user, filtroData.value, empresaId);
        }, 300));
    }

    await preencherDashboard(user, dataInicial, empresaId);
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        const { user, perfil, isOwner } = await verificarAcesso();
        const empresaId = getEmpresaIdAtiva();
        iniciarDashboard(user, empresaId);

        // Notificação trial
        if (isOwner) {
            const status = await checkUserStatus();
            if (status.isTrialActive && status.trialEndDate) {
                const banner = document.getElementById('trial-notification-banner');
                if (banner) {
                    const hoje = new Date();
                    const trialEnd = new Date(status.trialEndDate);
                    const diasRestantes = Math.max(0, Math.ceil((trialEnd - hoje) / (1000 * 60 * 60 * 24)));
                    banner.innerHTML = `🎉 Seu período de teste termina em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}.`;
                    banner.style.display = 'block';
                }
            }
        }

    } catch (error) {
        console.error("Erro no porteiro:", error.message);
        window.location.href = "login.html";
    }

    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) btnVoltar.addEventListener('click', () => window.location.href = "index.html");
});
