// agenda.js - VERSÃO SIMPLIFICADA E ROBUSTA

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

    // --- LÓGICA PRINCIPAL ---

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

    function popularFiltroProfissionais() {
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
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
            listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Nenhum agendamento ativo para esta seleção em ${dataFormatada}.</p></div>`;
            return;
        }

        agendamentos.sort((a,b) => a.horario.localeCompare(b.horario)).forEach(ag => {
            const cardContainer = document.createElement('div');
            cardContainer.className = "card-agendamento";
            cardContainer.innerHTML = `
                <div class="card-agendamento-header">
                    <div class="servico-info">
                        <span class="servico-nome">${ag.servicoNome || 'Serviço'}</span>
                        <span class="servico-horario">${ag.horario}</span>
                    </div>
                </div>
                <div class="card-agendamento-body">
                    <div class="info-item">
                        <span class="label">Profissional:</span>
                        <span class="valor">${ag.profissionalNome}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Cliente:</span>
                        <span class="valor">${ag.clienteNome}</span>
                    </div>
                </div>
                <div class="card-agendamento-footer">
                    <button class="btn-acao-card btn-concluir" data-id="${ag.id}">✔️ Concluir</button>
                    <button class="btn-acao-card btn-cancelar" data-id="${ag.id}">✖️ Cancelar</button>
                </div>`;
            listaAgendamentosEl.appendChild(cardContainer);
        });
    }

    // --- INICIALIZAÇÃO E EVENTOS ---

    onAuthStateChanged(auth, async (user) => {
        if (!user) return window.location.href = 'login.html';
        
        empresaIdGlobal = await getEmpresaIdDoDono(user.uid);
        if (!empresaIdGlobal) return document.body.innerHTML = '<h1>Acesso negado.</h1>';

        // 1. Define a data de hoje
        if (inputDataEl && !inputDataEl.value) {
            const hoje = new Date();
            hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
            inputDataEl.value = hoje.toISOString().split("T")[0];
        }
        
        // 2. Busca e popula os profissionais
        todosProfissionais = await buscarProfissionais(empresaIdGlobal);
        popularFiltroProfissionais();
        
        // 3. Adiciona os listeners para atualizar a agenda
        inputDataEl.addEventListener("change", atualizarAgenda);
        filtroProfissionalEl.addEventListener("change", atualizarAgenda);
        
        // 4. Adiciona listener para os botões de ação
        listaAgendamentosEl.addEventListener('click', (e) => {
            const target = e.target;
            const agendamentoId = target.dataset.id;
            if (target.matches('.btn-concluir')) concluirAgendamento(agendamentoId);
            if (target.matches('.btn-cancelar')) cancelarAgendamento(agendamentoId);
        });
        
        // 5. Carga inicial da agenda
        atualizarAgenda();
    });

    // Funções de ação
    async function concluirAgendamento(agendamentoId) { if (!agendamentoId) return; try { const ref = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId); await updateDoc(ref, { status: 'concluido' }); alert("Agendamento concluído!"); atualizarAgenda(); } catch (e) { console.error(e); alert("Erro ao concluir."); } }
    async function cancelarAgendamento(agendamentoId) { if (!agendamentoId) return; if (!confirm("Certeza?")) return; try { const ref = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId); await updateDoc(ref, { status: 'cancelado_pelo_gestor' }); alert("Agendamento cancelado."); atualizarAgenda(); } catch (e) { console.error(e); alert("Erro ao cancelar."); } }
});
