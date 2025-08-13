// dashboard.js - VERSÃO COMPLETA E CORRIGIDA
// Preenche todos os cards do dashboard e evita erros de carregamento.

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- FUNÇÃO PRINCIPAL ---

async function preencherDashboard(user, dataSelecionada) {
    const empresaId = localStorage.getItem('empresaId');
    if (!empresaId) {
        alert("ID da Empresa não encontrado. Por favor, acesse a partir do painel principal.");
        return;
    }

    // Busca agendamentos da data selecionada
    const agCollection = collection(db, "empresarios", empresaId, "agendamentos");
    const agQuery = query(agCollection, where("data", "==", dataSelecionada), where("status", "==", "ativo"));
    const agSnap = await getDocs(agQuery);
    const agsDoDia = agSnap.docs.map(doc => doc.data());

    // 1. Renderiza a Agenda do Dia
    const agendaContainer = document.getElementById("agenda-resultado");
    if (agendaContainer) {
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

    // 2. Calcula e preenche o Card "Serviço Mais Procurado"
    const servicoDestaqueEl = document.getElementById("servico-destaque");
    if (servicoDestaqueEl) {
        const servicosContados = agsDoDia.reduce((acc, ag) => {
            const nome = ag.servicoNome || "N/A";
            acc[nome] = (acc[nome] || 0) + 1;
            return acc;
        }, {});
        const servicoDestaque = Object.entries(servicosContados).sort((a,b) => b[1] - a[1])[0];
        servicoDestaqueEl.textContent = servicoDestaque ? servicoDestaque[0] : "Nenhum";
    }

    // 3. Calcula e preenche o Card "Profissional Destaque"
    const profNomeEl = document.getElementById("prof-destaque-nome");
    const profQtdEl = document.getElementById("prof-destaque-qtd");
    if (profNomeEl && profQtdEl) {
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

    // 4. Calcula e preenche o Card "Ocupação"
    const ocupacaoCircularEl = document.getElementById("ocupacao-circular");
    const ocupacaoTextoEl = document.getElementById("ocupacao-texto");
    if (ocupacaoCircularEl && ocupacaoTextoEl) {
        const totalSlotsExemplo = 20; // Idealmente, este número viria do seu banco
        const ocupacaoPercent = Math.min(100, Math.round((agsDoDia.length / totalSlotsExemplo) * 100));
        
        ocupacaoCircularEl.innerHTML = `
            <svg viewBox="0 0 74 74">
                <circle cx="37" cy="37" r="32" stroke="#ffffff33" stroke-width="8" fill="none"/>
                <circle cx="37" cy="37" r="32" stroke="#3cec6c" stroke-width="8" fill="none"
                    stroke-dasharray="${2 * Math.PI * 32}"
                    stroke-dashoffset="${2 * Math.PI * 32 * (1 - ocupacaoPercent/100)}"
                    transform="rotate(-90 37 37)"
                    style="transition: stroke-dashoffset 0.8s ease-out"/>
            </svg>
            <div class="percent">${ocupacaoPercent}%</div>`;
        ocupacaoTextoEl.textContent = `Sua agenda está ${ocupacaoPercent}% ocupada`;
    }

    // 5. Calcula e preenche a "Sugestão da IA"
    const iaSugestaoEl = document.getElementById("ia-sugestao");
    if(iaSugestaoEl){
        if(agsDoDia.length === 0){
            iaSugestaoEl.textContent = "O dia está livre! Que tal criar uma promoção para atrair clientes?";
        } else if (ocupacaoPercent < 50) {
            iaSugestaoEl.textContent = "Ainda há muitos horários vagos. Considere enviar um lembrete para seus clientes sobre os horários disponíveis.";
        } else {
            iaSugestaoEl.textContent = "O dia está movimentado! Prepare-se para um dia produtivo.";
        }
    }
}

// --- INICIALIZAÇÃO E EVENTOS ---

window.addEventListener("DOMContentLoaded", () => {
    
    onAuthStateChanged(auth, user => {
        if (user) {
            const filtroData = document.getElementById("filtro-data");
            
            // Define a data de hoje como padrão no filtro
            const hoje = new Date().toISOString().split('T')[0];
            if (filtroData && !filtroData.value) {
                filtroData.value = hoje;
            }
            
            // Carrega o dashboard com a data inicial
            preencherDashboard(user, filtroData.value).catch(err => {
                console.error("Erro ao carregar o dashboard:", err);
                alert("Erro ao carregar dados: " + err.message);
            });

            // Adiciona o evento para quando o usuário MUDAR a data
            if (filtroData) {
                filtroData.addEventListener("change", () => {
                    preencherDashboard(user, filtroData.value);
                });
            }
        } else {
            // Se não há usuário, redireciona para o login
            // window.location.href = "login.html"; 
        }
    });

    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            // Idealmente, volte para a página do painel principal, ex: 'index.html'
            window.location.href = "index.html"; 
        });
    }
});
