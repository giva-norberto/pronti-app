// dashboard.js - VERSÃO REVISADA E FUNCIONAL (PAINEL INTELIGENTE)
// Fuso horário garantido na string de data e lógica robusta de data inteligente para o Brasil.
// Não pula o dia se ainda houver expediente hoje e a tela não trava!
// Agenda do Dia mostra apenas os próximos 3 agendamentos (ou todos se menos de 3) + botão/link para "ver agenda completa"

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const totalSlots = 20;

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

async function buscarTodosOsHorarios(empresaId) {
    try {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const profissionaisSnap = await getDocs(profissionaisRef);
        if (profissionaisSnap.empty) return [];

        const promessasDeHorarios = profissionaisSnap.docs.map(profDoc => {
            const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profDoc.id, "configuracoes", "horarios");
            return getDoc(horariosRef);
        });

        const horariosSnaps = await Promise.all(promessasDeHorarios);
        return horariosSnaps.map(snap => snap.exists() ? snap.data() : null).filter(Boolean);
    } catch (error) {
        console.error("Erro ao buscar todos os horários:", error);
        return [];
    }
}

// Retorna a data e hora atual no fuso horário de São Paulo.
function getAgoraEmSaoPaulo() {
    const local = new Date();
    const utc = local.getTime() + (local.getTimezoneOffset() * 60000);
    const offset = -3; // Horário padrão de Brasília
    const brasil = new Date(utc + (3600000 * offset));
    return brasil;
}

function getHojeStringSaoPaulo() {
    const hojeSP = getAgoraEmSaoPaulo();
    return [
      hojeSP.getFullYear(),
      String(hojeSP.getMonth() + 1).padStart(2, "0"),
      String(hojeSP.getDate()).padStart(2, "0")
    ].join("-");
}

async function encontrarProximaDataDisponivel(empresaId, dataInicial) {
    const todosOsHorarios = await buscarTodosOsHorarios(empresaId);
    if (todosOsHorarios.length === 0) return dataInicial;

    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    let partes = dataInicial.split('-');
    let dataAtual = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 12, 0, 0, 0);

    for (let i = 0; i < 90; i++) {
        const nomeDia = diaDaSemana[dataAtual.getDay()];
        let diaDeTrabalho = false;
        let ultimoHorarioGeral = 0;

        todosOsHorarios.forEach(horarioProf => {
            if (horarioProf[nomeDia] && horarioProf[nomeDia].ativo) {
                diaDeTrabalho = true;
                horarioProf[nomeDia].blocos.forEach(bloco => {
                    const fimMinutos = timeStringToMinutes(bloco.fim);
                    if (fimMinutos > ultimoHorarioGeral) {
                        ultimoHorarioGeral = fimMinutos;
                    }
                });
            }
        });

        if (diaDeTrabalho) {
            if (i === 0) { // Hoje
                const agoraSP = getAgoraEmSaoPaulo();
                const agoraEmMinutos = agoraSP.getHours() * 60 + agoraSP.getMinutes();
                if (agoraEmMinutos < ultimoHorarioGeral) {
                    return [
                        dataAtual.getFullYear(),
                        String(dataAtual.getMonth() + 1).padStart(2, "0"),
                        String(dataAtual.getDate()).padStart(2, "0")
                    ].join("-");
                }
            } else {
                return [
                    dataAtual.getFullYear(),
                    String(dataAtual.getMonth() + 1).padStart(2, "0"),
                    String(dataAtual.getDate()).padStart(2, "0")
                ].join("-");
            }
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return dataInicial;
}

// --- FUNÇÕES DE CÁLCULO ---

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

// --- FUNÇÃO INTELIGENTE DE RENDERIZAÇÃO DA AGENDA DO DIA ---

function preencherAgendaDoDia(agsDoDia) {
    const agendaContainer = document.getElementById("agenda-resultado");
    if (!agendaContainer) return;
    agendaContainer.innerHTML = "";

    if (agsDoDia.length === 0) {
        agendaContainer.innerHTML = `<div class="aviso-horarios">Nenhum agendamento para esta data.</div>`;
        return;
    }

    // Pega o horário atual (HH:MM) no fuso de SP
    const agoraSP = getAgoraEmSaoPaulo();
    const horaAtual = String(agoraSP.getHours()).padStart(2, "0") + ":" + String(agoraSP.getMinutes()).padStart(2, "0");

    // Ordena todos e pega só os próximos a partir de agora, ou todos se for para outro dia
    const agsOrdenados = agsDoDia.slice().sort((a, b) => a.horario.localeCompare(b.horario));

    // Se for hoje, mostra só os que ainda vão acontecer, senão mostra do começo do dia
    let agsFuturos = agsOrdenados;
    const filtroData = document.getElementById("filtro-data");
    if (filtroData && filtroData.value === getHojeStringSaoPaulo()) {
        agsFuturos = agsOrdenados.filter(ag => ag.horario >= horaAtual);
        if (agsFuturos.length === 0) agsFuturos = agsOrdenados.slice(-3); // Se já passou tudo, mostra últimos 3
    }
    const agsVisiveis = agsFuturos.slice(0, 3);

    // Renderiza os próximos até 3 agendamentos
    agsVisiveis.forEach(ag => {
        agendaContainer.innerHTML += `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <strong>${ag.horario}</strong> — ${ag.servicoNome || "-"}${ag.profissionalNome ? " (" + ag.profissionalNome + ")" : ""}
            </div>
        `;
    });

    // Se houver mais, mostra aviso/link para agenda completa
    if (agsFuturos.length > 3) {
        agendaContainer.innerHTML += `
            <div style="margin-top: 6px; color: #679;">
                +${agsFuturos.length - 3} agendamentos — <a href="agenda.html" style="color:#1976d2;text-decoration:underline;">ver agenda completa</a>
            </div>
        `;
    }
}

// --- RESTANTE DAS FUNÇÕES DE RENDERIZAÇÃO (SEM ALTERAÇÃO) ---

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

// --- FUNÇÃO DE DEBOUNCE PARA MELHORAR PERFORMANCE ---

function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --- INICIALIZAÇÃO E EVENTOS ---

window.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const filtroData = document.getElementById("filtro-data");
                const empresaId = await getEmpresaId(user);

                if (!empresaId) {
                    alert("Não foi possível identificar sua empresa.");
                    return;
                }

                const hojeString = getHojeStringSaoPaulo();
                const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);

                if (filtroData) {
                    filtroData.value = dataInicial;
                    filtroData.addEventListener("change", debounce(() => {
                        preencherDashboard(user, filtroData.value);
                    }, 300));
                }

                await preencherDashboard(user, dataInicial);
            } catch (e) {
                alert("Erro inesperado ao carregar o dashboard.");
                console.error(e);
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
