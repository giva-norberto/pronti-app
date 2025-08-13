// dashboard.js - VERSÃO FINAL VALIDADA E COM MELHORIA DE PERFORMANCE (DEBOUNCE)

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
        return localStorage.getItem('empresaId'); // Fallback para o cache
    } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        return localStorage.getItem('empresaId');
    }
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

    const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
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
                    return dataAtual.toISOString().split('T')[0];
                }
            } else {
                return dataAtual.toISOString().split('T')[0];
            }
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return dataInicial;
}

// --- FUNÇÕES DE CÁLCULO ---

function calcularServicosDestaque(agsDoDia) { /* ...código mantido... */ }
function calcularProfissionalDestaque(agsDoDia) { /* ...código mantido... */ }
function calcularResumo(agsDoDia) { /* ...código mantido... */ }
function calcularSugestaoIA(agsDoDia) { /* ...código mantido... */ }

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function preencherAgendaDoDia(agsDoDia) { /* ...código mantido... */ }
function preencherCardServico(servicoDestaque) { /* ...código mantido... */ }
function preencherCardProfissional(profissionalDestaque) { /* ...código mantido... */ }
function preencherCardResumo(resumo) { /* ...código mantido... */ }
function preencherCardIA(mensagem) { /* ...código mantido... */ }

// --- FUNÇÃO PRINCIPAL PARA PREENCHER O DASHBOARD ---

async function preencherDashboard(user, dataSelecionada) {
    const empresaId = await getEmpresaId(user);
    if (!empresaId) {
        alert("ID da Empresa não encontrado. Por favor, acesse a partir do painel principal.");
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
        alert("Ocorreu um erro ao carregar os dados do dashboard. Tente novamente.");
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
            const filtroData = document.getElementById("filtro-data");
            const empresaId = await getEmpresaId(user);
            
            if (!empresaId) {
                alert("Não foi possível identificar sua empresa.");
                return;
            }

            const hojeString = new Date().toISOString().split('T')[0];
            const dataInicial = await encontrarProximaDataDisponivel(empresaId, hojeString);
            
            if (filtroData) {
                filtroData.value = dataInicial;
                filtroData.addEventListener("change", debounce(() => {
                    preencherDashboard(user, filtroData.value);
                }, 300));
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

// Nota: O código das funções omitidas (marcadas com /* ...código mantido... */) 
// é o mesmo da sua versão e deve ser mantido no seu arquivo final.
