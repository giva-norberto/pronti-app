// ======================================================================
//                       DASHBOARD.JS (VERSÃO FINAL)
//          Inclui o "porteiro" de acesso e a notificação de trial
//          Revisado para multi-empresa: usa empresaId ativo do localStorage
// ======================================================================

import { verificarAcesso, checkUserStatus } from "./userService.js"; 
import { showCustomAlert } from "./custom-alert.js";
import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { gerarResumoDiarioInteligente } from "./inteligencia.js";

const totalSlots = 20;

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

// Obtém empresaId multi-empresa do localStorage
function getEmpresaIdAtiva() {
    const empresaId = localStorage.getItem("empresaAtivaId");
    if (!empresaId) {
        window.location.href = "selecionar-empresa.html";
        throw new Error("Empresa não selecionada.");
    }
    return empresaId;
}

async function buscarHorariosDoDono(empresaId) {
    try {
        const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
        if (!empresaDoc.exists()) return null;
        const donoId = empresaDoc.data().donoId;
        if (!donoId) return null;
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", donoId, "configuracoes", "horarios");
        const horariosSnap = await getDoc(horariosRef);
        return horariosSnap.exists() ? horariosSnap.data() : null;
    } catch (error) {
        console.error("Erro ao buscar horários do dono:", error);
        return null;
    }
}

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    const horariosTrabalho = await buscarHorariosDoDono(empresaId);
    if (!horariosTrabalho) return dataInicial;

    const diaDaSemana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    let dataAtual = new Date(`${dataInicial}T12:00:00`);

    for (let i = 0; i < 90; i++) {
        const nomeDia = diaDaSemana[dataAtual.getDay()];
        const diaDeTrabalho = horariosTrabalho[nomeDia];

        if (diaDeTrabalho && diaDeTrabalho.ativo) {
            if (i === 0) {
                const ultimoBloco = diaDeTrabalho.blocos[diaDeTrabalho.blocos.length - 1];
                const fimDoExpediente = timeStringToMinutes(ultimoBloco.fim);
                const agoraEmMinutos = new Date().getHours() * 60 + new Date().getMinutes();
                if (agoraEmMinutos < fimDoExpediente) {
                    return dataAtual.toISOString().split("T")[0];
                }
            } else {
                return dataAtual.toISOString().split("T")[0];
            }
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return dataInicial;
}

function calcularServicosDestaque(agsDoDia) {
    const servicosContados = agsDoDia.reduce((acc, ag) => {
        const nome = ag.servicoNome || "N/A";
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});
    const servicoDestaque = Object.entries(servicosContados).sort((a,b) => b[1] - a[1])[0];
    return servicoDestaque ? servicoDestaque[0] : null;
}

function calcularProfissionalDestaque(agsDoDia) {
    const profsContados = agsDoDia.reduce((acc, ag) => {
        const nome = ag.profissionalNome || "N/A";
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});
    const profDestaque = Object.entries(profsContados).sort((a,b) => b[1] - a[1])[0];
    return profDestaque ? { nome: profDestaque[0], qtd: profDestaque[1] } : null;
}

function calcularResumo(agsDoDia) {
    const totalAgendamentos = agsDoDia.length;
    const faturamentoPrevisto = agsDoDia.reduce((soma, ag) => soma + (Number(ag.servicoPreco) || 0), 0);
    const percentualOcupacao = Math.min(100, Math.round((totalAgendamentos / totalSlots) * 100));
    return { totalAgendamentos, faturamentoPrevisto, percentualOcupacao };
}

function calcularSugestaoIA(agsDoDia) {
    const ocupacaoPercent = Math.min(100, Math.round((agsDoDia.length / totalSlots) * 100));
    if(agsDoDia.length === 0){
        return "O dia está livre! Que tal criar uma promoção para atrair clientes?";
    } else if (ocupacaoPercent < 50) {
        return "Ainda há muitos horários vagos. Considere enviar um lembrete para seus clientes.";
    } else {
        return "O dia está movimentado! Prepare-se para um dia produtivo.";
    }
}

function preencherAgendaDoDia(agsDoDia) {
    const agendaContainer = document.getElementById("agenda-resultado");
    if (!agendaContainer) return;
    agendaContainer.innerHTML = "";
    if (agsDoDia.length === 0) {
        agendaContainer.innerHTML = `<div class="aviso-horarios">Nenhum agendamento para esta data.</div>`;
        return;
    }
    agsDoDia.sort((a, b) => a.horario.localeCompare(b.horario)).forEach(ag => {
        agendaContainer.innerHTML += `<div class="card-agendamento"><span class="horario-destaque">${ag.horario}</span><div class="agendamento-info"><strong>${ag.servicoNome || 'Serviço'}</strong><span>${ag.profissionalNome || 'Profissional'}</span></div></div>`;
    });
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
        nomeEl.textContent = profissionalDestaque.nome;
        qtdEl.textContent = `${profissionalDestaque.qtd} agendamento(s)`;
    } else {
        nomeEl.textContent = "Nenhum profissional";
        qtdEl.textContent = "hoje";
    }
}

function preencherCardResumo(resumo) {
    const totalEl = document.getElementById("total-agendamentos-dia");
    const fatEl = document.getElementById("faturamento-previsto");
    const percEl = document.getElementById("percentual-ocupacao");
    if (!totalEl || !fatEl || !percEl) return;
    totalEl.textContent = resumo.totalAgendamentos;
    fatEl.textContent = resumo.faturamentoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    percEl.textContent = `${resumo.percentualOcupacao}%`;
}

function preencherCardIA(mensagem) {
    const el = document.getElementById("ia-sugestao");
    if (el) el.textContent = mensagem;
}

function preencherResumoInteligente(resumoInteligente) {
    const el = document.getElementById("resumo-inteligente");
    if (!el) return;

    if (!resumoInteligente || resumoInteligente.totalAtendimentos === 0) {
        el.innerHTML = `<span>${resumoInteligente?.mensagem || "Nenhum dado disponível."}</span>`;
        return;
    }

    let resumoHtml = `
        <div><strong>Total atendimentos:</strong> ${resumoInteligente.totalAtendimentos}</div>
        <div><strong>Primeiro:</strong> ${resumoInteligente.primeiro.horario} - ${resumoInteligente.primeiro.cliente} (${resumoInteligente.primeiro.servico})</div>
        <div><strong>Último:</strong> ${resumoInteligente.ultimo.horario} - ${resumoInteligente.ultimo.cliente} (${resumoInteligente.ultimo.servico})</div>
        <div><strong>Faturamento estimado:</strong> ${resumoInteligente.faturamentoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
    `;

    if (resumoInteligente.maiorIntervalo) {
        resumoHtml += `<div><strong>Maior intervalo:</strong> ${resumoInteligente.maiorIntervalo.inicio} - ${resumoInteligente.maiorIntervalo.fim} (${resumoInteligente.maiorIntervalo.duracaoMinutos} min)</div>`;
    }

    el.innerHTML = resumoHtml;
}

async function preencherDashboard(user, dataSelecionada, empresaId) {
    if (!empresaId) {
        alert("ID da Empresa não encontrado.");
        return;
    }
    try {
        const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
        const agQuery = query(agCollection, where("data", "==", dataSelecionada), where("status", "==", "ativo"));
        const agSnap = await getDocs(agQuery);
        const agsDoDia = agSnap.docs.map(doc => doc.data());

        // LOGS PARA AJUDAR NA VALIDAÇÃO DOS CARDS
        console.log('Agendamentos do dia:', agsDoDia);

        preencherAgendaDoDia(agsDoDia);
        preencherCardServico(calcularServicosDestaque(agsDoDia));
        preencherCardProfissional(calcularProfissionalDestaque(agsDoDia));
        preencherCardResumo(calcularResumo(agsDoDia));
        preencherCardIA(calcularSugestaoIA(agsDoDia));

        const resumoInteligente = gerarResumoDiarioInteligente(
            agsDoDia.map(ag => ({
                inicio: ag.inicio || `${ag.data}T${ag.horario}:00`,
                fim: ag.fim || `${ag.data}T${ag.horarioFim || ag.horario}:00`,
                cliente: ag.cliente ? ag.cliente : (ag.clienteNome || "Cliente"),
                servico: ag.servico ? ag.servico : (ag.servicoNome || "Serviço"),
                preco: ag.servicoPreco ? Number(ag.servicoPreco) : 0 // importante: garantir o campo de preço
            }))
        );
        console.log('Resumo Inteligente:', resumoInteligente);

        preencherResumoInteligente(resumoInteligente);

    } catch (error) {
        console.error("Erro ao carregar agendamentos:", error);
        alert("Ocorreu um erro ao carregar os dados do dashboard.");
    }
}

function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        const { user, perfil, empresaId: _, isOwner } = await verificarAcesso();
        // Sempre pega empresaId multi-empresa do localStorage:
        const empresaId = getEmpresaIdAtiva();

        console.log("Acesso ao Dashboard liberado para:", perfil.nome);

        iniciarDashboard(user, empresaId);

        // NOTIFICAÇÃO DO TRIAL COM DIAS RESTANTES
        if (isOwner) {
            const status = await checkUserStatus();
            if (status.isTrialActive && status.trialEndDate) {
                const banner = document.getElementById('trial-notification-banner');
                if (banner) {
                    const hoje = new Date();
                    const trialEnd = (status.trialEndDate instanceof Date) ? status.trialEndDate : new Date(status.trialEndDate);
                    const diffTime = trialEnd - hoje;
                    const diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                    const dataFinal = trialEnd.toLocaleDateString('pt-BR');
                    banner.innerHTML = `🎉 Bem-vindo! Seu período de teste gratuito está ativo até <strong>${dataFinal}</strong> (${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} restante${diasRestantes === 1 ? '' : 's'}).`;
                    banner.style.display = 'block';
                }
            }
        }

    } catch (error) {
        console.error("Acesso ao Dashboard bloqueado pelo porteiro:", error.message);
        window.location.href = 'login.html';
    }
    
    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = "index.html";
        });
    }
});

async function iniciarDashboard(user, empresaId) {
    const filtroData = document.getElementById("filtro-data");
    
    if (!empresaId) {
        alert("Não foi possível identificar sua empresa.");
        return;
    }

    const hojeString = new Date().toISOString().split('T')[0];
    const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);

    if (filtroData) {
        filtroData.value = dataInicial;
        filtroData.addEventListener("change", debounce(() => {
            preencherDashboard(user, filtroData.value, empresaId);
        }, 300));
    }

    await preencherDashboard(user, dataInicial, empresaId);
}
