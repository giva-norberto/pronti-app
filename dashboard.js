// dashboard.js - VERSÃO FINAL COM RESUMO FINANCEIRO COMPLETO

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- FUNÇÕES DE LÓGICA ---

async function getEmpresaId(user) {
    // Esta função busca o ID da empresa associado ao usuário logado
    const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const empresaId = snap.docs[0].id;
        localStorage.setItem('empresaId', empresaId); // Salva para uso futuro
        return empresaId;
    }
    return localStorage.getItem('empresaId'); // Tenta pegar do cache se a busca falhar
}

// --- FUNÇÃO PRINCIPAL ---

async function preencherDashboard(user, dataSelecionada) {
    const empresaId = await getEmpresaId(user);
    if (!empresaId) {
        alert("ID da Empresa não encontrado. Por favor, acesse a partir do painel principal.");
        return;
    }

    const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
    const agQuery = query(agCollection, where("data", "==", dataSelecionada), where("status", "==", "ativo"));
    const agSnap = await getDocs(agQuery);
    const agsDoDia = agSnap.docs.map(doc => doc.data());

    // Chamadas para preencher todos os cards
    preencherAgendaDoDia(agsDoDia);
    preencherCardServico(agsDoDia);
    preencherCardProfissional(agsDoDia);
    preencherCardResumo(agsDoDia); // <--- A antiga função de ocupação agora é esta
    preencherCardIA(agsDoDia);
}

// --- FUNÇÕES DE PREENCHIMENTO DOS CARDS ---

function preencherAgendaDoDia(agsDoDia) {
    const agendaContainer = document.getElementById("agenda-resultado");
    if (!agendaContainer) return;
    agendaContainer.innerHTML = "";
    if (agsDoDia.length === 0) {
        agendaContainer.innerHTML = `<div class="aviso-horarios">Nenhum agendamento para esta data.</div>`;
    } else {
        agsDoDia.sort((a, b) => a.horario.localeCompare(b.horario)).forEach(ag => {
            agendaContainer.innerHTML += `
                <div class="card-agendamento">
                    <span class="horario-destaque">${ag.horario}</span>
                    <div class="agendamento-info">
                        <strong>${ag.servicoNome || 'Serviço'}</strong>
                        <span>${ag.profissionalNome || 'Profissional'}</span>
                    </div>
                </div>`;
        });
    }
}

function preencherCardServico(agsDoDia) {
    const servicoDestaqueEl = document.getElementById("servico-destaque");
    if (!servicoDestaqueEl) return;
    const servicosContados = agsDoDia.reduce((acc, ag) => {
        const nome = ag.servicoNome || "N/A";
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});
    const servicoDestaque = Object.entries(servicosContados).sort((a,b) => b[1] - a[1])[0];
    servicoDestaqueEl.textContent = servicoDestaque ? servicoDestaque[0] : "Nenhum";
}

function preencherCardProfissional(agsDoDia) {
    const profNomeEl = document.getElementById("prof-destaque-nome");
    const profQtdEl = document.getElementById("prof-destaque-qtd");
    if (!profNomeEl || !profQtdEl) return;
    const profsContados = agsDoDia.reduce((acc, ag) => {
        const nome = ag.profissionalNome || "N/A";
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});
    const profDestaque = Object.entries(profsContados).sort((a,b) => b[1] - a[1])[0];
    if (profDestaque) {
        profNomeEl.textContent = profDestaque[0];
        profQtdEl.textContent = `${profDestaque[1]} agendamento(s)`;
    } else {
        profNomeEl.textContent = "Nenhum profissional";
        profQtdEl.textContent = "hoje";
    }
}

// ==========================================================
// FUNÇÃO DO CARD DE RESUMO DO DIA (ANTIGO CARD DE OCUPAÇÃO)
// ==========================================================
function preencherCardResumo(agsDoDia) {
    const totalAgendamentosEl = document.getElementById("total-agendamentos-dia");
    const faturamentoPrevistoEl = document.getElementById("faturamento-previsto");
    const percentualOcupacaoEl = document.getElementById("percentual-ocupacao");

    if (!totalAgendamentosEl || !faturamentoPrevistoEl || !percentualOcupacaoEl) return;

    // 1. Total de Agendamentos do Dia
    const totalAgendamentos = agsDoDia.length;
    totalAgendamentosEl.textContent = totalAgendamentos;

    // 2. Valor Previsto em Reais (Faturamento)
    const faturamentoPrevisto = agsDoDia.reduce((soma, agendamento) => {
        return soma + (agendamento.servicoPreco || 0);
    }, 0);
    faturamentoPrevistoEl.textContent = faturamentoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 3. Percentual da Agenda
    const totalSlotsExemplo = 20; // No futuro, este número virá das suas configurações de horário
    const percentualOcupacao = Math.min(100, Math.round((totalAgendamentos / totalSlotsExemplo) * 100));
    percentualOcupacaoEl.textContent = `${percentualOcupacao}%`;
}

function preencherCardIA(agsDoDia) {
    const iaSugestaoEl = document.getElementById("ia-sugestao");
    if(!iaSugestaoEl) return;

    const totalSlotsExemplo = 20;
    const ocupacaoPercent = Math.min(100, Math.round((agsDoDia.length / totalSlotsExemplo) * 100));

    if(agsDoDia.length === 0){
        iaSugestaoEl.textContent = "O dia está livre! Que tal criar uma promoção para atrair clientes?";
    } else if (ocupacaoPercent < 50) {
        iaSugestaoEl.textContent = "Ainda há muitos horários vagos. Considere enviar um lembrete para seus clientes.";
    } else {
        iaSugestaoEl.textContent = "O dia está movimentado! Prepare-se para um dia produtivo.";
    }
}

// --- INICIALIZAÇÃO E EVENTOS ---

window.addEventListener("DOMContentLoaded", () => {
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const filtroData = document.getElementById("filtro-data");
            
            const hoje = new Date().toISOString().split('T')[0];
            if (filtroData && !filtroData.value) {
                filtroData.value = hoje;
            }
            
            const dataInicial = filtroData ? filtroData.value : hoje;
            await preencherDashboard(user, dataInicial);

            if (filtroData) {
                filtroData.addEventListener("change", () => {
                    preencherDashboard(user, filtroData.value);
                });
            }
        } else {
            // window.location.href = "login.html"; 
        }
    });

    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            window.location.href = "index.html"; 
        });
    }
});
