// agenda.js - VERSÃO FINAL COM DATA INTELIGENTE E LAYOUT CORRIGIDO

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

    function timeStringToMinutes(timeStr) { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }

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

    // ==========================================================
    // NOVA LÓGICA: Encontrar próxima data com expediente
    // ==========================================================
    function encontrarProximaDataComExpediente(dataInicial, horariosTrabalho) {
        const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        let dataAtual = new Date(`${dataInicial}T12:00:00`);

        for (let i = 0; i < 90; i++) {
            const nomeDia = diaDaSemana[dataAtual.getDay()];
            const diaDeTrabalho = horariosTrabalho?.[nomeDia];

            if (diaDeTrabalho && diaDeTrabalho.ativo) {
                // Se hoje for um dia de trabalho, verifica o horário
                if (i === 0) {
                    const ultimoBloco = diaDeTrabalho.blocos[diaDeTrabalho.blocos.length - 1];
                    const fimDoExpediente = timeStringToMinutes(ultimoBloco.fim);
                    const agora = new Date().getHours() * 60 + new Date().getMinutes();

                    if (agora < fimDoExpediente) {
                        return dataAtual.toISOString().split('T')[0]; // Ainda há expediente hoje
                    }
                } else {
                    return dataAtual.toISOString().split('T')[0]; // Encontrou o próximo dia útil
                }
            }
            // Avança para o próximo dia
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return dataInicial; // Retorna a data inicial se não encontrar nada em 90 dias
    }
    
    // --- FUNÇÕES DE ATUALIZAÇÃO DE TELA (UI) ---

    function popularFiltroProfissionais() {
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        todosProfissionais.forEach(p => {
            const option = new Option(p.nome, p.id);
            filtroProfissionalEl.appendChild(option);
        });
    }

    function renderizarAgenda(dataSelecionada, agendamentos, profissionalSelecionado = null) {
        listaAgendamentosEl.innerHTML = "";
        if (profissionalSelecionado) {
            renderizarLinhaDoTempoProfissional(dataSelecionada, agendamentos, profissionalSelecionado);
        } else {
            renderizarListaGeral(agendamentos, dataSelecionada);
        }
    }

    function renderizarLinhaDoTempoProfissional(dataSelecionada, agendamentos, profissional) {
        const diaDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const dataObj = new Date(`${dataSelecionada}T12:00:00`);
        const nomeDia = diaDaSemana[dataObj.getDay()];

        const horariosTrabalho = profissional.horarios;
        if (!horariosTrabalho) {
            listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Horários de ${profissional.nome} não configurados.</p></div>`;
            return;
        }
        const diaDeTrabalho = horariosTrabalho[nomeDia];

        if (!diaDeTrabalho || !diaDeTrabalho.ativo || diaDeTrabalho.blocos.length === 0) {
            listaAgendamentosEl.innerHTML = `<div class="card-info"><p>${profissional.nome} não trabalha neste dia.</p></div>`;
            return;
        }

        const intervalo = horariosTrabalho.intervalo || 30;
        let tempoOcupadoAte = 0;

        diaDeTrabalho.blocos.forEach(bloco => {
            const inicioBloco = timeStringToMinutes(bloco.inicio);
            const fimBloco = timeStringToMinutes(bloco.fim);

            for (let t = inicioBloco; t < fimBloco; t += intervalo) {
                if (t < tempoOcupadoAte) continue;

                const horarioSlot = new Date(t * 60 * 1000).toISOString().substr(11, 5);
                const agendamentoNoSlot = agendamentos.find(ag => ag.horario === horarioSlot);

                if (agendamentoNoSlot) {
                    listaAgendamentosEl.appendChild(criarCardAgendamento(agendamentoNoSlot));
                    tempoOcupadoAte = t + (agendamentoNoSlot.servicoDuracao || intervalo);
                } else {
                    listaAgendamentosEl.appendChild(criarSlotLivre(horarioSlot));
                    tempoOcupadoAte = t + intervalo;
                }
            }
        });
    }

    function renderizarListaGeral(agendamentos, dataSelecionada) {
        if (agendamentos.length === 0) {
            const dataFormatada = new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString('pt-BR');
            listaAgendamentosEl.innerHTML = `<div class="card-info"><h2>Nenhum agendamento ativo</h2><p>Não existem compromissos para ${dataFormatada}.</p></div>`;
            return;
        }
        agendamentos.sort((a,b) => a.horario.localeCompare(b.horario)).forEach(ag => {
            listaAgendamentosEl.appendChild(criarCardAgendamento(ag));
        });
    }

    function criarCardAgendamento(ag) {
        const card = document.createElement("div");
        card.className = "card-agendamento-container"; // Usa a classe container
        card.innerHTML = `<div class="card-agendamento">
            <div class="card-agendamento-header">
                <div class="servico-info">
                    <span class="servico-nome">${ag.servicoNome}</span>
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
            </div>
        </div>`;
        return card;
    }
    
    function criarSlotLivre(horario) {
        const slot = document.createElement("div");
        slot.className = "card-agendamento-container"; // Usa a mesma classe container
        slot.innerHTML = `<div class="slot-livre">
            <span>${horario}</span>
            <span>Livre</span>
        </div>`;
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
                todosProfissionais = await buscarProfissionais(empresaIdGlobal);
                popularFiltroProfissionais();
                
                // Lógica de data inteligente
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
    async function concluirAgendamento(agendamentoId) { /* ...código mantido... */ }
    async function cancelarAgendamento(agendamentoId) { /* ...código mantido... */ }
});
