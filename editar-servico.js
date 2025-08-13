// dashboard.js - VERSÃO FINAL COM DATA INTELIGENTE

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const totalSlots = 20; // Total de horários disponíveis no dia, idealmente virá da configuração do sistema

// --- FUNÇÕES DE LÓGICA E DADOS ---

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

async function getEmpresaId(user) {
    try {
        const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const empresaId = snap.docs[0].id;
            localStorage.setItem('empresaId', empresaId);
            return empresaId;
        }
        return localStorage.getItem('empresaId');
    } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        return localStorage.getItem('empresaId');
    }
}

// NOVO: Busca os horários do dono da empresa para usar como referência
async function buscarHorariosDoDono(empresaId) {
    const empresaDoc = await getDoc(doc(db, "empresarios", empresaId));
    if (!empresaDoc.exists()) return null;
    
    const donoId = empresaDoc.data().donoId;
    if (!donoId) return null;
    
    const horariosRef = doc(db, "empresarios", empresaId, "profissionais", donoId, "configuracoes", "horarios");
    const horariosSnap = await getDoc(horariosRef);
    return horariosSnap.exists() ? horariosSnap.data() : null;
}

// NOVO: Lógica de data inteligente
async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    const horariosTrabalho = await buscarHorariosDoDono(empresaId);
    if (!horariosTrabalho) return dataInicial; // Se não achar horários, retorna hoje

    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    let dataAtual = new Date(`${dataInicial}T12:00:00`);

    for (let i = 0; i < 90; i++) { // Procura nos próximos 90 dias
        const nomeDia = diaDaSemana[dataAtual.getDay()];
        const diaDeTrabalho = horariosTrabalho[nomeDia];

        if (diaDeTrabalho && diaDeTrabalho.ativo) {
            // Se for hoje, verifica se o expediente já encerrou
            if (i === 0) {
                const ultimoBloco = diaDeTrabalho.blocos[diaDeTrabalho.blocos.length - 1];
                const fimDoExpediente = timeStringToMinutes(ultimoBloco.fim);
                const agoraEmMinutos = new Date().getHours() * 60 + new Date().getMinutes();
                if (agoraEmMinutos < fimDoExpediente) {
                    return dataAtual.toISOString().split('T')[0]; // Ainda há expediente hoje
                }
            } else {
                // Se for um dia futuro, retorna ele
                return dataAtual.toISOString().split('T')[0];
            }
        }
        // Se não é dia de trabalho ou já acabou, avança para o dia seguinte
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return dataInicial; // Fallback
}


// --- FUNÇÕES DE CÁLCULO (O seu código, mantido) ---

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
    if (profDestaque) {
        return { nome: profDestaque[0], qtd: profDestaque[1] };
    }
    return null;
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

// --- FUNÇÕES DE RENDERIZAÇÃO (O seu código, mantido) ---

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
    const servicoDestaqueEl = document.getElementById("servico-destaque");
    if (!servicoDestaqueEl) return;
    servicoDestaqueEl.textContent = servicoDestaque || "Nenhum";
}

function preencherCardProfissional(profissionalDestaque) {
    const profNomeEl = document.getElementById("prof-destaque-nome");
    const profQtdEl = document.getElementById("prof-destaque-qtd");
    if (!profNomeEl || !profQtdEl) return;
    if (profissionalDestaque) {
        profNomeEl.textContent = profissionalDestaque.nome;
        profQtdEl.textContent = `${profissionalDestaque.qtd} agendamento(s)`;
    } else {
        profNomeEl.textContent = "Nenhum profissional";
        profQtdEl.textContent = "hoje";
    }
}

function preencherCardResumo(resumo) {
    const totalAgendamentosEl = document.getElementById("total-agendamentos-dia");
    const faturamentoPrevistoEl = document.getElementById("faturamento-previsto");
    const percentualOcupacaoEl = document.getElementById("percentual-ocupacao");
    if (!totalAgendamentosEl || !faturamentoPrevistoEl || !percentualOcupacaoEl) return;
    totalAgendamentosEl.textContent = resumo.totalAgendamentos;
    faturamentoPrevistoEl.textContent = resumo.faturamentoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    percentualOcupacaoEl.textContent = `${resumo.percentualOcupacao}%`;
}

function preencherCardIA(mensagem) {
    const iaSugestaoEl = document.getElementById("ia-sugestao");
    if(!iaSugestaoEl) return;
    iaSugestaoEl.textContent = mensagem;
}

// --- FUNÇÃO PRINCIPAL PARA PREENCHER O DASHBOARD ---

async function preencherDashboard(user, dataSelecionada) {
    const empresaId = await getEmpresaId(user);
    if (!empresaId) {
        alert("ID da Empresa não encontrado.");
        return;
    }
    try {
        const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
        const agQuery = query(agCollection, where("data", "==", dataSelecionada), where("status", "==", "ativo"));
        const agSnap = await getDocs(agQuery);
        const agsDoDia = agSnap.docs.map(doc => doc.data());

        preencherAgendaDoDia(agsDoDia);
        preencherCardServico(calcularServicosDestaque(agsDoDia));
        preencherCardProfissional(calcularProfissionalDestaque(agsDoDia));
        preencherCardResumo(calcularResumo(agsDoDia));
        preencherCardIA(calcularSugestaoIA(agsDoDia));
    } catch (error) {
        console.error("Erro ao carregar agendamentos:", error);
        alert("Ocorreu um erro ao carregar os dados do dashboard.");
    }
}

// --- INICIALIZAÇÃO E EVENTOS ---

window.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const filtroData = document.getElementById("filtro-data");
            const empresaId = await getEmpresaId(user); // Busca o ID da empresa
            
            if (!empresaId) {
                alert("Não foi possível identificar sua empresa.");
                return;
            }

            // ALTERAÇÃO: Lógica de data inteligente
            const hojeString = new Date().toISOString().split('T')[0];
            const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);
            
            if (filtroData) {
                filtroData.value = dataInicial;
                filtroData.addEventListener("change", () => {
                    preencherDashboard(user, filtroData.value);
                });
            }
            
            await preencherDashboard(user, dataInicial);

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
