/**
 * agenda.js (VERSÃO DE DIAGNÓSTICO)
 * Adicionados console.log para rastrear a execução.
 */

import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

console.log("--- MÓDULO agenda.js CARREGADO ---");

// --- INICIALIZAÇÃO E ELEMENTOS DO DOM ---
const db = getFirestore(app);
const auth = getAuth(app);

const listaAgendamentos = document.getElementById("lista-agendamentos");
const inputData = document.getElementById("data-agenda");
const modalConfirmacao = document.getElementById('modal-confirmacao');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');
const btnModalConfirmar = document.getElementById('btn-modal-confirmar');
const modalMensagem = document.getElementById('modal-mensagem');

console.log("Elementos do DOM:", { listaAgendamentos, inputData, modalConfirmacao });

let agendamentoParaCancelarId = null;
let currentUid = null;

// --- FUNÇÕES ---

function formatarHorario(dataIso) {
    if (!dataIso) return "Horário inválido";
    const data = new Date(dataIso);
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function carregarAgendamentos(uid) {
    console.log(`[1] Chamando carregarAgendamentos para o UID: ${uid}`);
    currentUid = uid;
    listaAgendamentos.innerHTML = "<p>Carregando...</p>";
    const dataSelecionada = inputData.value;

    try {
        const colecao = collection(db, `users/${uid}/agendamentos`);
        const snapshot = await getDocs(colecao);
        const agendamentos = [];

        for (const docAg of snapshot.docs) {
            const ag = docAg.data();
            if (!ag.horario) continue;
            const dataAgFormatada = new Date(ag.horario).toISOString().split("T")[0];

            if (dataAgFormatada === dataSelecionada && ag.status !== 'cancelado') {
                ag.id = docAg.id;
                if (ag.servicoId) {
                    const servicoSnap = await getDoc(doc(db, `users/${uid}/servicos/${ag.servicoId}`));
                    ag.servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço Avulso";
                } else {
                    ag.servicoNome = "Serviço Avulso";
                }
                agendamentos.push(ag);
            }
        }

        console.log(`[2] Agendamentos filtrados para a data: ${agendamentos.length}`);
        renderizarAgendamentos(agendamentos);

    } catch (error) {
        console.error("ERRO em carregarAgendamentos:", error);
    }
}

function renderizarAgendamentos(agendamentos) {
    console.log("[3] Chamando renderizarAgendamentos...");
    listaAgendamentos.innerHTML = "";

    if (agendamentos.length === 0) {
        listaAgendamentos.innerHTML = `<p>Nenhum agendamento encontrado.</p>`;
        console.log("[3.1] Nenhum agendamento para renderizar.");
        return;
    }

    agendamentos.sort((a, b) => new Date(a.horario) - new Date(b.horario));

    agendamentos.forEach(ag => {
        const div = document.createElement("div");
        div.className = "agendamento-item";
        div.innerHTML = `
            <h3>${ag.servicoNome}</h3>
            <p><strong>Cliente:</strong> ${ag.cliente}</p>
            <p><strong>Horário:</strong> ${formatarHorario(ag.horario)}</p>
            <button class="btn-cancelar-agendamento" data-id="${ag.id}">Cancelar Agendamento</button>
        `;
        listaAgendamentos.appendChild(div);
    });
    console.log("[3.2] Agendamentos renderizados no HTML.");

    // --- PONTO CRÍTICO DA VERIFICAÇÃO ---
    const botoesCancelar = document.querySelectorAll('.btn-cancelar-agendamento');
    console.log(`[4] SELETOR ENCONTROU ${botoesCancelar.length} BOTÕES com a classe '.btn-cancelar-agendamento'`);

    botoesCancelar.forEach(button => {
        button.addEventListener('click', (event) => {
            console.log("%c[5] BOTÃO 'CANCELAR' FOI CLICADO!", "color: green; font-weight: bold;");
            agendamentoParaCancelarId = event.target.dataset.id;
            console.log(`> ID para cancelar: ${agendamentoParaCancelarId}`);
            
            if (modalConfirmacao) {
                console.log("> Mostrando modal de confirmação...");
                modalConfirmacao.style.display = 'flex';
            } else {
                console.error("ERRO CRÍTICO: A variável 'modalConfirmacao' é nula. Verifique o ID no HTML.");
            }
        });
    });
}

async function cancelarAgendamentoFirebase(agendamentoId, uid) {
    console.log("[6] Chamando cancelarAgendamentoFirebase...");
    // ... (o resto da função é o mesmo)
    try {
        const agendamentoRef = doc(db, `users/${uid}/agendamentos`, agendamentoId);
        await updateDoc(agendamentoRef, { status: 'cancelado' });
        Toastify({ text: "Agendamento cancelado!", duration: 3000, backgroundColor: "#4CAF50" }).showToast();
        carregarAgendamentos(uid);
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        Toastify({ text: "Erro ao cancelar.", duration: 3000, backgroundColor: "#FF6347" }).showToast();
    } finally {
        fecharModalConfirmacao();
    }
}

function fecharModalConfirmacao() {
    if (modalConfirmacao) modalConfirmacao.style.display = 'none';
    agendamentoParaCancelarId = null;
}

// --- EVENT LISTENERS E INICIALIZAÇÃO ---

if (btnModalCancelar && btnModalConfirmar) {
    btnModalCancelar.addEventListener('click', fecharModalConfirmacao);
    btnModalConfirmar.addEventListener('click', () => {
        if (agendamentoParaCancelarId && currentUid) {
            cancelarAgendamentoFirebase(agendamentoParaCancelarId, currentUid);
        }
    });
} else {
    console.warn("AVISO: Botões do modal não foram encontrados. O modal não funcionará.");
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("--- USUÁRIO AUTENTICADO ---");
        if (!inputData.value) {
            inputData.value = new Date().toISOString().split("T")[0];
        }
        carregarAgendamentos(user.uid);
        inputData.addEventListener("change", () => carregarAgendamentos(user.uid));
    } else {
        console.log("--- NENHUM USUÁRIO AUTENTICADO ---");
    }
});
