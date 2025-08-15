// agenda.js - VERSÃO MELHORADA: cards modernos, coloridos e didáticos (Profissional/Cliente), sem CSS inline

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

    // Utilitário para converter hora string para minutos
    function timeStringToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    // Busca o ID da empresa pelo dono
    async function getEmpresaIdDoDono(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : snapshot.docs[0].id;
    }

    // Busca todos profissionais
    async function buscarProfissionais(empresaId) {
        const q = query(collection(db, "empresarios", empresaId, "profissionais"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Busca os horários de trabalho de um profissional
    async function buscarHorariosDoProfissional(empresaId, profissionalId) {
        const ref = doc(db, "empresarios", empresaId, "profissionais", profissionalId, "configuracoes", "horarios");
        const docSnap = await getDoc(ref);
        return docSnap.exists() ? docSnap.data() : null;
    }

    // Busca todos agendamentos ativos da data (e profissional se filtrado)
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

    // Encontra a próxima data útil de trabalho do profissional
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

    // Preenche o select de profissionais
    function popularFiltroProfissionais() {
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos</option>';
        todosProfissionais.forEach(p => {
            const option = new Option(p.nome, p.id);
            filtroProfissionalEl.appendChild(option);
        });
    }

    // Atualiza agenda na tela
    async function atualizarAgenda() {
        const data = inputDataEl.value;
        const profId = filtroProfissionalEl.value;
        if (!data || !profId) return;
        listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Buscando agendamentos...</p></div>`;
        const agendamentos = await buscarAgendamentos(empresaIdGlobal, data, profId);
        renderizarAgendamentos(agendamentos, data);
    }

    // Renderiza os cards dos agendamentos
    function renderizarAgendamentos(agendamentos, dataSelecionada) {
        listaAgendamentosEl.innerHTML = "";
        if (agendamentos.length === 0) {
            const dataFormatada = new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString('pt-BR');
            listaAgendamentosEl.innerHTML = `
                <div class="card-info card-info-vazia">
                    <svg width="34" height="34" style="margin-bottom:4px;" viewBox="0 0 24 24" fill="none" stroke="#5f6dfa" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M16 2v4M8 2v4M4 10h16"></path></svg>
                    <h3>Nenhum agendamento encontrado</h3>
                    <p>Ainda não existem compromissos marcados para <b>${dataFormatada}</b>.</p>
                </div>
            `;
            return;
        }
        agendamentos
            .sort((a, b) => a.horario.localeCompare(b.horario))
            .forEach(ag => {
                // ALTERAÇÃO: Usa card universal padronizado sem mudar lógica/função
                const cardContainer = document.createElement('div');
                cardContainer.className = "card";
                cardContainer.innerHTML = `
                    <div class="card-title">${ag.servicoNome || 'Serviço'}</div>
                    <div class="card-info">
                        <span class="tag-label">Horário</span> ${ag.horario}<br>
                        <span class="tag-label">Profissional</span> ${ag.profissionalNome}<br>
                        <span class="tag-label">Cliente</span> ${ag.clienteNome}
                    </div>
                    <div class="card-actions">
                        <button class="btn-edit btn-acao-card btn-nao-compareceu" data-id="${ag.id}" title="Não Compareceu"><i class="fa fa-exclamation-triangle"></i></button>
                        <button class="btn-remove btn-acao-card btn-cancelar" data-id="${ag.id}" title="Cancelar"><i class="fa fa-times"></i></button>
                    </div>
                `;
                listaAgendamentosEl.appendChild(cardContainer);
            });
    }

    // Autenticação e inicialização
    onAuthStateChanged(auth, async (user) => {
        if (!user) return window.location.href = 'login.html';
        empresaIdGlobal = await getEmpresaIdDoDono(user.uid);
        if (!empresaIdGlobal) return document.body.innerHTML = '<h1>Acesso negado.</h1>';
        
        todosProfissionais = await buscarProfissionais(empresaIdGlobal);
        popularFiltroProfissionais();
        
        const hojeString = new Date(new Date().setMinutes(new Date().getMinutes() - new Date().getTimezoneOffset())).toISOString().split("T")[0];
        const primeiroProfissional = todosProfissionais[0];
        if (primeiroProfissional) {
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

    // ==== Função para cancelar agendamento, com confirmação ====
    async function cancelarAgendamento(agendamentoId) {
        if (!confirm("Tem certeza que deseja CANCELAR este agendamento?")) {
            return;
        }
        const agRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
        await updateDoc(agRef, { status: "cancelado_pelo_gestor" });
        atualizarAgenda();
    }
    
    // ==== Função para marcar não comparecimento, com confirmação ====
    async function marcarNaoCompareceu(agendamentoId) {
        if (!confirm("Marcar FALTA para este agendamento? A ação não pode ser desfeita.")) {
            return;
        }
        const agRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
        await updateDoc(agRef, { status: "nao_compareceu" });
        atualizarAgenda();
    }
});
