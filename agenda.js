// agenda.js - VERSÃO FINAL COM CONFIRMAÇÃO PARA CANCELAR E MARCAR FALTA
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    const listaAgendamentosEl = document.getElementById("lista-agendamentos");
    const inputDataEl = document.getElementById("data-agenda");
    const filtroProfissionalEl = document.getElementById("filtro-profissional");
    let empresaIdGlobal = null;
    let todosProfissionais = [];

    function timeStringToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    async function getEmpresaIdDoDono(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : snapshot.docs[0].id;
    }
    async function buscarProfissionais(empresaId) {
        const q = query(collection(db, "empresarios", empresaId, "profissionais"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    async function buscarHorariosDoProfissional(empresaId, profissionalId) {
        const ref = doc(db, "empresarios", empresaId, "profissionais", profissionalId, "configuracoes", "horarios");
        const docSnap = await getDoc(ref);
        return docSnap.exists() ? docSnap.data() : null;
    }
    async function buscarAgendamentos(empresaId, data, profissionalId) {
        let q;
        const ref = collection(db, "empresarios", empresaId, "agendamentos");
        if (profissionalId === 'todos') {
            q = query(ref, where("status", "==", "ativo"), where("data", "==", data));
        } else {
            q = query(ref, where("status", "==", "ativo"), where("data", "==", data), where("profissionalId", "==", profissionalId));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    function encontrarProximaDataComExpediente(dataInicial, horariosTrabalho) {
        if (!horariosTrabalho || !horariosTrabalho.segunda) return dataInicial;
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

    function popularFiltroProfissionais() {
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos</option>';
        todosProfissionais.forEach(p => {
            const option = new Option(p.nome, p.id);
            filtroProfissionalEl.appendChild(option);
        });
    }

    async function atualizarAgenda() {
        const data = inputDataEl.value;
        const profId = filtroProfissionalEl.value;
        if (!data || !profId) return;
        listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Buscando agendamentos...</p></div>`;
        const agendamentos = await buscarAgendamentos(empresaIdGlobal, data, profId);
        renderizarAgendamentos(agendamentos, data);
    }

    function renderizarAgendamentos(agendamentos, dataSelecionada) {
        listaAgendamentosEl.innerHTML = "";
        if (agendamentos.length === 0) {
            const dataFormatada = new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString('pt-BR');
            listaAgendamentosEl.innerHTML = `
                <div class="card-info" style="padding:18px 10px;text-align:center;border-radius:10px;background:#eef2ff;color:#5f6dfa;box-shadow:0 2px 8px #d6d2f8;margin-bottom:24px;">
                    <svg width="34" height="34" style="margin-bottom:4px;" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
                    <h3 style="font-size:1.08rem;font-weight:600;margin-bottom:7px;">Nenhum agendamento encontrado</h3>
                    <p style="font-size:0.93rem;margin-bottom:0;color:#3d3a57;">Ainda não existem compromissos marcados para <b>${dataFormatada}</b>.</p>
                </div>
            `;
            return;
        }
        agendamentos.sort((a,b) => a.horario.localeCompare(b.horario)).forEach(ag => {
            const cardContainer = document.createElement('div');
            cardContainer.className = "card-agendamento pequeno";
            cardContainer.style = `
                background:#fff;
                border-radius:10px;
                padding:10px 13px;
                box-shadow:0 1px 5px #e1e8ed;
                margin-bottom:12px;
                display:flex;
                flex-direction:row;
                align-items:center;
                gap:12px;
                min-height:45px;
                font-size:0.96rem;
            `;
            cardContainer.innerHTML = `
                <div style="flex:1 1 0;display:flex;flex-direction:column;gap:2px;">
                    <span style="font-weight:600;color:#22223b;">${ag.servicoNome || 'Serviço'}</span>
                    <span style="font-size:0.95em;color:#5f6dfa;">${ag.horario}</span>
                </div>
                <div style="flex:1 1 0;display:flex;flex-direction:column;gap:2px;">
                    <span style="color:#22223b;">${ag.profissionalNome}</span>
                    <span style="color:#3d3a57;font-size:0.95em;">${ag.clienteNome}</span>
                </div>
                <div style="flex-shrink:0;display:flex;gap:4px;">
                    <button class="btn-acao-card btn-nao-compareceu" data-id="${ag.id}" title="Não Compareceu" style="font-size:0.92em;background:#fff3cd;border:none;padding:4px 8px;border-radius:7px;cursor:pointer;">⚠️</button>
                    <button class="btn-acao-card btn-cancelar" data-id="${ag.id}" title="Cancelar" style="font-size:0.92em;background:#fdeceb;border:none;padding:4px 8px;border-radius:7px;cursor:pointer;">✖️</button>
                </div>
            `;
            listaAgendamentosEl.appendChild(cardContainer);
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) return window.location.href = 'login.html';
        empresaIdGlobal = await getEmpresaIdDoDono(user.uid);
        if (!empresaIdGlobal) return document.body.innerHTML = '<h1>Acesso negado.</h1>';
        
        todosProfissionais = await buscarProfissionais(empresaIdGlobal);
        popularFiltroProfissionais();
        
        const hojeString = new Date(new Date().setMinutes(new Date().getMinutes() - new Date().getTimezoneOffset())).toISOString().split("T")[0];
        const primeiroProfissional = todosProfissionais[0];
        if(primeiroProfissional) {
            const horariosPrimeiroProf = await buscarHorariosDoProfissional(empresaIdGlobal, primeiroProfissional.id);
            if (horariosPrimeiroProf) {
               inputDataEl.value = encontrarProximaDataComExpediente(hojeString, horariosPrimeiroProf);
            } else {
               inputDataEl.value = hojeString;
            }
        } else {
            inputDataEl.value = hojeString;
        }

        inputDataEl.addEventListener("change", atualizarAgenda);
        filtroProfissionalEl.addEventListener("change", atualizarAgenda);

        listaAgendamentosEl.addEventListener('click', (e) => {
            const target = e.target.closest('.btn-acao-card');
            if (!target) return;
            const agendamentoId = target.dataset.id;
            
            if (target.matches('.btn-cancelar')) cancelarAgendamento(agendamentoId);
            if (target.matches('.btn-nao-compareceu')) marcarNaoCompareceu(agendamentoId);
        });
        
        atualizarAgenda();
    });

    // ==========================================================
    // ALTERAÇÃO: Adicionada a janela de confirmação
    // ==========================================================
    async function cancelarAgendamento(agendamentoId) {
        // NOVO: Pergunta ao usuário se ele tem certeza
        if (!confirm("Tem certeza que deseja CANCELAR este agendamento?")) {
            return; // Se clicar em "Cancelar", a função para aqui
        }
        const agRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
        await updateDoc(agRef, { status: "cancelado_pelo_gestor" }); // Status mais específico
        atualizarAgenda();
    }
    
    // ==========================================================
    // ALTERAÇÃO: Adicionada a janela de confirmação
    // ==========================================================
    async function marcarNaoCompareceu(agendamentoId) {
        // NOVO: Pergunta ao usuário se ele tem certeza
        if (!confirm("Marcar FALTA para este agendamento? A ação não pode ser desfeita.")) {
            return; // Se clicar em "Cancelar", a função para aqui
        }
        const agRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
        await updateDoc(agRef, { status: "nao_compareceu" });
        atualizarAgenda();
    }
});
