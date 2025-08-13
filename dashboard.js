// dashboard.js - VERSÃO COMPLETA E CORRIGIDA
// Organização melhorada para evitar erros de "null" e garantir o carregamento correto.

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- FUNÇÕES AUXILIARES ---

// Busca empresaId de URL, localStorage ou Firestore
async function getEmpresaId(user) {
    const params = new URLSearchParams(window.location.search);
    let empresaId = params.get('empresaId');
    if (!empresaId) empresaId = localStorage.getItem('empresaId');
    
    if (!empresaId && user) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
            empresaId = snap.docs[0].id;
        }
    }
    // Salva no localStorage para acessos futuros
    if (empresaId) localStorage.setItem('empresaId', empresaId);
    return empresaId;
}

// Formata data e horário amigavelmente
function formatarDataHora(dataStr, horarioStr) {
    const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const [ano, mes, dia] = dataStr.split('-');
    const dataObj = new Date(`${dataStr}T${horarioStr || '00:00'}:00`);
    return `${dias[dataObj.getDay()]}, ${dia}/${mes}/${ano} às ${horarioStr}`;
}

// --- FUNÇÕES DE RENDERIZAÇÃO (UI) ---

function desenharOcupacao(percent) {
    const container = document.getElementById("ocupacao-circular");
    // CORREÇÃO: Verifica se o elemento existe antes de tentar modificá-lo
    if (!container) return; 

    const svg = `
        <svg viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="32" stroke="#ffffff33" stroke-width="8" fill="none"/>
            <circle cx="37" cy="37" r="32" stroke="#3cec6c" stroke-width="8" fill="none"
                stroke-dasharray="${2 * Math.PI * 32}"
                stroke-dashoffset="${2 * Math.PI * 32 * (1 - percent/100)}"
                transform="rotate(-90 37 37)"
                style="transition: stroke-dashoffset 0.8s ease-out"/>
        </svg>
        <div class="percent">${percent}%</div>
    `;
    container.innerHTML = svg;
}

function desenharAgendamentosDoDia(agendamentos) {
    const container = document.getElementById("agenda-resultado");
    // CORREÇÃO: Verifica se o elemento existe
    if (!container) return;

    container.innerHTML = "";
    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `<div class="aviso-horarios">Nenhum agendamento ativo para hoje.</div>`;
        return;
    }
    // Ordena por horário antes de exibir
    agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));

    agendamentos.forEach(ag => {
        container.innerHTML += `
            <div class="card-agendamento">
                <span class="horario-destaque">${ag.horario}</span>
                <div class="agendamento-info">
                    <strong>${ag.servicoNome || "Serviço"}</strong>
                    <span>Profissional: ${ag.profissionalNome || "Não informado"}</span>
                    <small>Cliente: ${ag.clienteNome || "Não informado"}</small>
                </div>
            </div>
        `;
    });
}

function atualizarCard(id, valor) {
    const elemento = document.getElementById(id);
    // CORREÇÃO: Verifica se o elemento existe
    if (elemento) {
        elemento.textContent = valor;
    }
}

// --- FUNÇÃO PRINCIPAL ---

async function preencherDashboard(user, dataSelecionada) {
    const empresaId = await getEmpresaId(user);
    if (!empresaId) {
        alert("Empresa não definida. Associe seu usuário a uma empresa no perfil.");
        return;
    }

    // Busca agendamentos da data
    const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
    const agQuery = query(
        agCollection,
        where("data", "==", dataSelecionada),
        where("status", "==", "ativo")
    );
    const agSnap = await getDocs(agQuery);
    const agsDoDia = agSnap.docs.map(doc => doc.data());

    // 1. Agenda do Dia
    desenharAgendamentosDoDia(agsDoDia);

    // 2. Serviço Destaque
    const servicosContados = agsDoDia.reduce((acc, ag) => {
        const nome = ag.servicoNome || "N/A";
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});
    const servicoDestaque = Object.entries(servicosContados).sort((a,b) => b[1] - a[1])[0];
    atualizarCard("servico-destaque", servicoDestaque ? servicoDestaque[0] : "Nenhum serviço hoje");

    // 3. Profissional Destaque
    const profsContados = agsDoDia.reduce((acc, ag) => {
        const nome = ag.profissionalNome || "N/A";
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});
    const profDestaque = Object.entries(profsContados).sort((a,b) => b[1] - a[1])[0];
    if (profDestaque) {
        atualizarCard("prof-destaque-nome", profDestaque[0]);
        atualizarCard("prof-destaque-qtd", `${profDestaque[1]} agendamento(s)`);
    } else {
        atualizarCard("prof-destaque-nome", "Nenhum profissional");
        atualizarCard("prof-destaque-qtd", "");
    }

    // 4. Ocupação (exemplo simples, idealmente viria do banco)
    const totalSlotsExemplo = 20; // Ex: 20 horários disponíveis no dia
    const ocupacaoPercent = Math.round((agsDoDia.length / totalSlotsExemplo) * 100);
    desenharOcupacao(ocupacaoPercent);
    atualizarCard("ocupacao-texto", `Sua agenda está ${ocupacaoPercent}% ocupada hoje.`);
    
    // As demais lógicas (comparativo, alerta, IA) podem ser adicionadas aqui
}


// --- INICIALIZAÇÃO E EVENTOS ---

// A estrutura de inicialização foi centralizada para garantir a ordem correta
window.addEventListener("DOMContentLoaded", () => {
    
    // Configura eventos de botões estáticos
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) btnVoltar.addEventListener('click', () => { window.location.href = "/"; });
    
    const btnExportar = document.getElementById("btn-exportar");
    if (btnExportar) btnExportar.addEventListener('click', () => { window.print(); });

    const btnPromocao = document.getElementById("btn-promocao");
    if (btnPromocao) btnPromocao.addEventListener('click', () => { alert("Função de criar promoção em desenvolvimento!"); });

    // Inicia o listener de autenticação
    onAuthStateChanged(auth, user => {
        if (user) {
            // Se o usuário está logado, executa a lógica principal
            const filtroData = document.getElementById("filtro-data");
            
            // Define a data de hoje como padrão
            const hoje = new Date().toISOString().split('T')[0];
            if (filtroData && !filtroData.value) {
                filtroData.value = hoje;
            }
            
            // Carrega o dashboard com a data inicial
            preencherDashboard(user, filtroData ? filtroData.value : hoje).catch(err => {
                console.error("Erro ao carregar o dashboard:", err);
                alert("Erro ao carregar dados: " + err.message);
            });

            // Adiciona o listener para MUDANÇAS na data
            if (filtroData) {
                filtroData.addEventListener("change", () => {
                    preencherDashboard(user, filtroData.value).catch(err => {
                        console.error("Erro ao atualizar o dashboard:", err);
                        alert("Erro ao recarregar dados: " + err.message);
                    });
                });
            }
        } else {
            // Se não há usuário, redireciona para o login
            alert("Faça login para acessar o dashboard!");
            // window.location.href = "login.html"; // Descomente para redirecionar
        }
    });
});
