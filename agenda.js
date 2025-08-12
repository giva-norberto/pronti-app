// agenda.js (ou o nome do seu arquivo)
// VERSÃO COMPLETA E CORRIGIDA - 12/08/2025

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    const listaAgendamentos = document.getElementById("lista-agendamentos");
    const inputData = document.getElementById("data-agenda");
    let empresaIdGlobal = null; // Variável para guardar o ID da empresa

    function formatarDataCompleta(data, horario) {
        if (!data || !horario) return "-";
        const [ano, mes, dia] = data.split("-");
        return `${dia}/${mes}/${ano} às ${horario}`;
    }

    async function getEmpresaIdDoDono(uid) {
        const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(empresQ);
        if (snapshot.empty) return null;
        return snapshot.docs[0].id;
    }

    // Função para cancelar o agendamento
    async function cancelarAgendamento(agendamentoId) {
        if (!empresaIdGlobal || !agendamentoId) return;

        const confirmou = confirm("Tem certeza que deseja cancelar este agendamento?");
        if (!confirmou) return;

        try {
            const agendamentoRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
            await updateDoc(agendamentoRef, {
                status: 'cancelado_pelo_gestor' // Status mais descritivo
            });
            alert("Agendamento cancelado com sucesso!");
            // Recarrega a lista para o dia selecionado para refletir a mudança
            carregarAgendamentosPorData(empresaIdGlobal, inputData.value);
        } catch (error) {
            console.error("Erro ao cancelar agendamento:", error);
            alert("Ocorreu um erro ao tentar cancelar.");
        }
    }

    async function carregarAgendamentosPorData(empresaId, dataSelecionada) {
        if (!empresaId || !listaAgendamentos) return;
        listaAgendamentos.innerHTML = `<div class="card-info"><p>Carregando agendamentos...</p></div>`;

        if (!dataSelecionada) {
            listaAgendamentos.innerHTML = `<div class="card-info"><p>Selecione uma data para ver os agendamentos.</p></div>`;
            return;
        }

        // A busca usa 'ativo' para corresponder ao que salvamos na vitrine
        const q = query(
            collection(db, "empresarios", empresaId, "agendamentos"),
            where("status", "==", "ativo"),
            where("data", "==", dataSelecionada)
        );

        try {
            const snapshot = await getDocs(q);
            const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarAgendamentos(agendamentos, dataSelecionada);
        } catch (error) {
            console.error("Erro ao carregar agendamentos:", error);
            listaAgendamentos.innerHTML = `<div class="card-info"><p>Ocorreu um erro ao carregar os agendamentos. Verifique se o índice do Firestore foi criado corretamente.</p></div>`;
        }
    }

    function renderizarAgendamentos(agendamentos, dataSelecionada) {
        if (!listaAgendamentos) return;
        listaAgendamentos.innerHTML = "";

        if (agendamentos.length === 0) {
            const dataFormatada = dataSelecionada.split("-").reverse().join("/");
            listaAgendamentos.innerHTML = `
                <div class="card-info" style="padding:38px 22px;text-align:center;border-radius:15px;background:#eef2ff;color:#5f6dfa;box-shadow:0 4px 24px #d6d2f8;margin-bottom:32px;">
                    <svg width="48" height="48" style="margin-bottom:8px;" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
                    <h2 style="font-size:1.35rem;font-weight:600;margin-bottom:10px;">Nenhum agendamento encontrado</h2>
                    <p style="font-size:1rem;margin-bottom:0;color:#3d3a57;">Não existem compromissos marcados para <span style="font-weight:700">${dataFormatada}</span>.</p>
                </div>`;
            return;
        }

        agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));
        agendamentos.forEach(ag => {
            const card = document.createElement("div");
            card.className = "card-agendamento";
            card.style = "background:#fff;border-radius:15px;padding:24px 20px;box-shadow:0 2px 12px #e1e8ed;margin-bottom:22px;display:flex;flex-direction:column;gap:11px";
            card.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:16px;">
                        <div style="background:#eef2ff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center; flex-shrink: 0;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
                        </div>
                        <div>
                            <span style="font-size:1.12rem;font-weight:600;color:#22223b;">${ag.servicoNome || 'Serviço'}</span>
                            <div style="margin-top:2px;font-size:0.95rem;color:#3d3a57;">${formatarDataCompleta(ag.data, ag.horario)}</div>
                        </div>
                    </div>
                    <button class="btn-cancelar" data-id="${ag.id}" title="Cancelar Agendamento">✖</button>
                </div>
                <div style="display:flex;align-items:center;gap:18px;margin-top:10px; flex-wrap: wrap;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/></svg>
                        <span style="font-size:1rem;color:#22223b;">${ag.profissionalNome || 'Profissional'}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                        <span style="font-size:1rem;color:#22223b;">${ag.clienteNome || 'Cliente'}</span>
                    </div>
                </div>
            `;
            listaAgendamentos.appendChild(card);
        });

        // Adiciona os event listeners para os novos botões de cancelar
        listaAgendamentos.querySelectorAll('.btn-cancelar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const agendamentoId = e.target.dataset.id;
                cancelarAgendamento(agendamentoId);
            });
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const empresaId = await getEmpresaIdDoDono(user.uid);
            empresaIdGlobal = empresaId; // Guarda o ID da empresa globalmente

            if (empresaId) {
                if (inputData && !inputData.value) {
                    const hoje = new Date();
                    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
                    inputData.value = hoje.toISOString().split("T")[0];
                }
                carregarAgendamentosPorData(empresaId, inputData.value);
                if (inputData) {
                    inputData.addEventListener("change", () => carregarAgendamentosPorData(empresaId, inputData.value));
                }
            } else {
                if(listaAgendamentos) listaAgendamentos.innerHTML = `<div class="card-info"><p>Você não parece ser o dono de nenhuma empresa cadastrada.</p></div>`;
            }
        } else {
            window.location.href = 'login.html';
        }
    });
});
