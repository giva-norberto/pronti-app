// agenda.js - VERSÃO CORRIGIDA
// Mostra a linha do tempo completa do dia, com horários livres e ocupados.

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

    // --- FUNÇÕES DE LÓGICA E DADOS ---

    function timeStringToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
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
        const agendamentosRef = collection(db, "empresarios", empresaId, "agendamentos");
        if (profissionalId === 'todos') {
            q = query(agendamentosRef, where("status", "==", "ativo"), where("data", "==", data));
        } else {
            q = query(agendamentosRef, where("status", "==", "ativo"), where("data", "==", data), where("profissionalId", "==", profissionalId));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // --- FUNÇÕES DE ATUALIZAÇÃO DE TELA (UI) ---

    function popularFiltroProfissionais() {
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        todosProfissionais.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nome;
            filtroProfissionalEl.appendChild(option);
        });
    }

    // ==========================================================
    // LÓGICA DE RENDERIZAÇÃO TOTALMENTE REFEITA
    // ==========================================================
    function renderizarAgenda(dataSelecionada, agendamentos, profissionalSelecionado = null) {
        listaAgendamentosEl.innerHTML = "";

        if (profissionalSelecionado) {
            // Se um profissional foi selecionado, mostra a linha do tempo dele
            renderizarLinhaDoTempoProfissional(dataSelecionada, agendamentos, profissionalSelecionado);
        } else {
            // Se "Todos" foi selecionado, mostra uma lista simples
            renderizarListaGeral(agendamentos, dataSelecionada);
        }
    }

    function renderizarLinhaDoTempoProfissional(dataSelecionada, agendamentos, profissional) {
        const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const dataObj = new Date(`${dataSelecionada}T12:00:00`);
        const nomeDia = diaDaSemana[dataObj.getDay()];

        const horariosTrabalho = profissional.horarios;
        const diaDeTrabalho = horariosTrabalho?.[nomeDia];

        if (!diaDeTrabalho || !diaDeTrabalho.ativo || diaDeTrabalho.blocos.length === 0) {
            listaAgendamentosEl.innerHTML = `<div class="card-info"><p>${profissional.nome} não trabalha neste dia.</p></div>`;
            return;
        }

        const intervalo = horariosTrabalho.intervalo || 30;
        let tempoOcupadoAte = 0; // Controla o tempo para não criar slots livres dentro de um serviço longo

        diaDeTrabalho.blocos.forEach(bloco => {
            const inicioBloco = timeStringToMinutes(bloco.inicio);
            const fimBloco = timeStringToMinutes(bloco.fim);

            for (let t = inicioBloco; t < fimBloco; t += intervalo) {
                if (t < tempoOcupadoAte) continue; // Pula slots que estão dentro de um agendamento

                const horarioSlot = new Date(t * 60 * 1000).toISOString().substr(11, 5);
                const agendamentoNoSlot = agendamentos.find(ag => ag.horario === horarioSlot);

                if (agendamentoNoSlot) {
                    const card = criarCardAgendamento(agendamentoNoSlot);
                    listaAgendamentosEl.appendChild(card);
                    tempoOcupadoAte = t + (agendamentoNoSlot.servicoDuracao || intervalo);
                } else {
                    const slotLivre = criarSlotLivre(horarioSlot);
                    listaAgendamentosEl.appendChild(slotLivre);
                    tempoOcupadoAte = t + intervalo;
                }
            }
        });
    }

    function renderizarListaGeral(agendamentos, dataSelecionada) {
        if (agendamentos.length === 0) {
            const dataFormatada = dataSelecionada.split("-").reverse().join("/");
            listaAgendamentosEl.innerHTML = `<div class="card-info"><h2 style="font-size:1.35rem;font-weight:600;">Nenhum agendamento ativo</h2><p>Não existem compromissos para <span style="font-weight:700">${dataFormatada}</span>.</p></div>`;
            return;
        }
        agendamentos.sort((a,b) => a.horario.localeCompare(b.horario)).forEach(ag => {
            listaAgendamentosEl.appendChild(criarCardAgendamento(ag));
        });
    }

    function criarCardAgendamento(ag) {
        const card = document.createElement("div");
        card.className = "card-agendamento";
        card.innerHTML = `
            <div class="card-agendamento-header">
                <div class="servico-info">
                    <span class="servico-nome">${ag.servicoNome || 'Serviço'}</span>
                    <span class="servico-horario">${ag.horario}</span>
                </div>
                <div class="servico-preco">R$ ${ag.servicoPreco ? ag.servicoPreco.toFixed(2) : '0.00'}</div>
            </div>
            <div class="card-agendamento-body">
                <div class="info-item"><span class="label">Profissional:</span><span class="valor">${ag.profissionalNome}</span></div>
                <div class="info-item"><span class="label">Cliente:</span><span class="valor">${ag.clienteNome}</span></div>
            </div>
            <div class="card-agendamento-footer">
                <button class="btn-acao-card btn-concluir" data-id="${ag.id}">✔️ Concluir</button>
                <button class="btn-acao-card btn-cancelar" data-id="${ag.id}">✖️ Cancelar</button>
            </div>`;
        return card;
    }
    
    function criarSlotLivre(horario) {
        const slot = document.createElement("div");
        slot.className = "slot-livre";
        slot.innerHTML = `<span>${horario}</span><span>Livre</span>`;
        return slot;
    }

    // --- FUNÇÃO PRINCIPAL DE ATUALIZAÇÃO ---

    async function atualizarAgenda() {
        const data = inputDataEl.value;
        const profId = filtroProfissionalEl.value;
        if (!data) return;

        listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Carregando agenda...</p></div>`;
        
        let profissionalSelecionado = null;
        if (profId !== 'todos') {
            profissionalSelecionado = todosProfissionais.find(p => p.id === profId);
            if (profissionalSelecionado) {
                profissionalSelecionado.horarios = await buscarHorariosDoProfissional(empresaIdGlobal, profId);
            }
        }
        
        const agendamentos = await buscarAgendamentos(empresaIdGlobal, data, profId);
        renderizarAgenda(data, agendamentos, profissionalSelecionado);
    }

    // --- INICIALIZAÇÃO E EVENTOS ---

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaIdGlobal = await getEmpresaIdDoDono(user.uid);
            if (empresaIdGlobal) {
                if (inputDataEl && !inputDataEl.value) {
                    const hoje = new Date();
                    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
                    inputDataEl.value = hoje.toISOString().split("T")[0];
                }
                
                todosProfissionais = await buscarProfissionais(empresaIdGlobal);
                popularFiltroProfissionais();
                
                inputDataEl.addEventListener("change", atualizarAgenda);
                filtroProfissionalEl.addEventListener("change", atualizarAgenda);
                
                // Adiciona listener de clique para os botões de ação na área geral
                listaAgendamentosEl.addEventListener('click', (e) => {
                    const concluirBtn = e.target.closest('.btn-concluir');
                    const cancelarBtn = e.target.closest('.btn-cancelar');
                    if(concluirBtn) concluirAgendamento(concluirBtn.dataset.id);
                    if(cancelarBtn) cancelarAgendamento(cancelarBtn.dataset.id);
                });
                
                atualizarAgenda(); // Carga inicial
            } else {
                document.body.innerHTML = '<h1>Acesso negado. Você não é o dono de uma empresa.</h1>';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    // Colar aqui as funções de ação
    async function concluirAgendamento(agendamentoId) { if (!agendamentoId) return; try { const ref = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId); await updateDoc(ref, { status: 'concluido' }); alert("Agendamento concluído!"); atualizarAgenda(); } catch (e) { console.error(e); alert("Erro ao concluir."); } }
    async function cancelarAgendamento(agendamentoId) { if (!agendamentoId) return; if (!confirm("Certeza?")) return; try { const ref = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId); await updateDoc(ref, { status: 'cancelado_pelo_gestor' }); alert("Agendamento cancelado."); atualizarAgenda(); } catch (e) { console.error(e); alert("Erro ao cancelar."); } }
});
