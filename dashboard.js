// dashboard.js - VERSÃO MAIS SEGURA E COM MELHOR DEPURAÇÃO
// Verifica se os elementos HTML existem antes de tentar modificá-los.

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- FUNÇÕES AUXILIARES ---

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
    if (empresaId) localStorage.setItem('empresaId', empresaId);
    return empresaId;
}

function formatarDataHora(dataStr, horarioStr) {
    const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const [ano, mes, dia] = dataStr.split('-');
    const dataObj = new Date(`${dataStr}T${horarioStr || '00:00'}:00`);
    return `${dias[dataObj.getDay()]}, ${dia}/${mes} às ${horarioStr}`;
}

// --- FUNÇÕES DE RENDERIZAÇÃO (UI) ---

function desenharOcupacao(percent) {
    const container = document.getElementById("ocupacao-circular");
    if (!container) {
        console.error("Elemento com ID 'ocupacao-circular' não encontrado no HTML!");
        return; 
    }
    // ... (resto da função mantido)
}

function desenharAgendamentosDoDia(agendamentos) {
    const container = document.getElementById("agenda-resultado");
    if (!container) {
        console.error("Elemento com ID 'agenda-resultado' não encontrado no HTML!");
        return;
    }
    // ... (resto da função mantido)
}

function atualizarCard(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valor;
    } else {
        console.error(`Elemento com ID '${id}' não foi encontrado no HTML!`);
    }
}

// --- FUNÇÃO PRINCIPAL ---

async function preencherDashboard(user, dataSelecionada) {
    const empresaId = await getEmpresaId(user);
    if (!empresaId) {
        alert("Empresa não definida. Associe seu usuário a uma empresa no perfil.");
        return;
    }

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

    // 4. Ocupação (exemplo)
    const totalSlotsExemplo = 20; 
    const ocupacaoPercent = Math.round((agsDoDia.length / totalSlotsExemplo) * 100);
    desenharOcupacao(ocupacaoPercent);
    atualizarCard("ocupacao-texto", `Sua agenda está ${ocupacaoPercent}% ocupada hoje.`);
}


// --- INICIALIZAÇÃO E EVENTOS ---

window.addEventListener("DOMContentLoaded", () => {
    
    // Configura eventos de botões estáticos
    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) btnVoltar.addEventListener('click', () => { window.location.href = "/"; });
    
    // Inicia o listener de autenticação
    onAuthStateChanged(auth, user => {
        if (user) {
            const filtroData = document.getElementById("filtro-data");
            
            const hoje = new Date().toISOString().split('T')[0];
            if (filtroData && !filtroData.value) {
                filtroData.value = hoje;
            }
            
            const dataInicial = filtroData ? filtroData.value : hoje;
            preencherDashboard(user, dataInicial).catch(err => {
                console.error("Erro ao carregar o dashboard:", err);
                alert("Erro ao carregar dados: " + err.message);
            });

            if (filtroData) {
                filtroData.addEventListener("change", () => {
                    preencherDashboard(user, filtroData.value).catch(err => {
                        console.error("Erro ao atualizar o dashboard:", err);
                        alert("Erro ao recarregar dados: " + err.message);
                    });
                });
            }
        } else {
            console.log("Usuário não autenticado, redirecionando para login.");
            // window.location.href = "login.html"; 
        }
    });
});
