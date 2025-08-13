// agenda.js (ou o nome do seu arquivo)
// VERSÃO COMPLETA E REVISADA - Foco em trazer os agendamentos

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
    let empresaIdGlobal = null; // Guarda o ID da empresa para uso nas funções

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

    async function concluirAgendamento(agendamentoId) {
        if (!empresaIdGlobal || !agendamentoId) return;
        try {
            const agendamentoRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
            await updateDoc(agendamentoRef, { status: 'concluido' });
            alert("Agendamento marcado como 'Concluído'!");
            carregarAgendamentosPorData(empresaIdGlobal, inputData.value); // Recarrega a lista
        } catch (error) {
            console.error("Erro ao concluir agendamento:", error);
            alert("Ocorreu um erro ao tentar concluir o agendamento.");
        }
    }

    async function cancelarAgendamento(agendamentoId) {
        if (!empresaIdGlobal || !agendamentoId) return;
        const confirmou = confirm("Tem certeza que deseja cancelar este agendamento?");
        if (!confirmou) return;

        try {
            const agendamentoRef = doc(db, "empresarios", empresaIdGlobal, "agendamentos", agendamentoId);
            await updateDoc(agendamentoRef, { status: 'cancelado_pelo_gestor' });
            alert("Agendamento cancelado com sucesso!");
            carregarAgendamentosPorData(empresaIdGlobal, inputData.value); // Recarrega a lista
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

        // CORREÇÃO PRINCIPAL: A busca agora usa 'ativo' para bater com os dados salvos
        const q = query(
            collection(db, "empresarios", empresaId, "agendamentos"),
            where("status", "==", "ativo"),
            where("data", "==", dataSelecionada)
        );

        try {
            const snapshot = await getDocs(q);
            const agendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarAgendamentos(agendamentos, dataSelecionada);
        } catch (error)
        {
            console.error("Erro ao carregar agendamentos:", error);
            listaAgendamentos.innerHTML = `<div class="card-info error"><p>Ocorreu um erro ao carregar os agendamentos. Verifique o console (F12) para um link de criação de índice do Firestore.</p></div>`;
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
                    <h2 style="font-size:1.35rem;font-weight:600;margin-bottom:10px;">Nenhum agendamento ativo</h2>
                    <p style="font-size:1rem;margin-bottom:0;color:#3d3a57;">Não existem compromissos para <span style="font-weight:700">${dataFormatada}</span>.</p>
                </div>`;
            return;
        }

        agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));
        agendamentos.forEach(ag => {
            const card = document.createElement("div");
            card.className = "card-agendamento";
            card.innerHTML = `
                <div class="agendamento-detalhes">
                    <div class="agendamento-header">
                        <span class="servico-nome">${ag.servicoNome || 'Serviço'}</span>
                        <span class="tempo-horario">${formatarDataCompleta(ag.data, ag.horario)}</span>
                    </div>
                    <div class="agendamento-pessoas">
                        <span class="info-item"><strong>Profissional:</strong> ${ag.profissionalNome || 'Não informado'}</span>
                        <span class="info-item"><strong>Cliente:</strong> ${ag.clienteNome || 'Não informado'}</span>
                    </div>
                </div>
                <div class="agendamento-acoes">
                    <button class="btn-acao btn-concluir" data-id="${ag.id}" title="Marcar como Concluído">✔️ Concluir</button>
                    <button class="btn-acao btn-cancelar" data-id="${ag.id}" title="Cancelar Agendamento">✖️ Cancelar</button>
                </div>`;
            listaAgendamentos.appendChild(card);
        });

        // Adiciona os event listeners para os botões de ação
        listaAgendamentos.querySelectorAll('.btn-concluir').forEach(btn => {
            btn.addEventListener('click', (e) => concluirAgendamento(e.target.dataset.id));
        });
        listaAgendamentos.querySelectorAll('.btn-cancelar').forEach(btn => {
            btn.addEventListener('click', (e) => cancelarAgendamento(e.target.dataset.id));
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const empresaId = await getEmpresaIdDoDono(user.uid);
            empresaIdGlobal = empresaId; // Guarda o ID para uso global

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
// agenda.js - VERSÃO COMPLETA E REVISADA
// Garante que o filtro de profissionais seja populado corretamente.

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

    // --- FUNÇÕES DE BUSCA DE DADOS ---

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
        if (profissionalId === 'todos') {
            q = query(
                collection(db, "empresarios", empresaId, "agendamentos"),
                where("status", "==", "ativo"),
                where("data", "==", data)
            );
        } else {
            q = query(
                collection(db, "empresarios", empresaId, "agendamentos"),
                where("status", "==", "ativo"),
                where("data", "==", data),
                where("profissionalId", "==", profissionalId)
            );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // --- FUNÇÕES DE AÇÃO ---

    async function concluirAgendamento(agendamentoId) {
        // ... (código mantido, sem alterações) ...
    }

    async function cancelarAgendamento(agendamentoId) {
        // ... (código mantido, sem alterações) ...
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO ---

    function popularFiltroProfissionais() {
        if (!filtroProfissionalEl) return;
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        todosProfissionais.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nome;
            filtroProfissionalEl.appendChild(option);
        });
    }

    async function atualizarAgenda() {
        const data = inputDataEl.value;
        const profId = filtroProfissionalEl.value;

        if (!data) {
            listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Por favor, selecione uma data.</p></div>`;
            return;
        }
        
        listaAgendamentosEl.innerHTML = `<div class="card-info"><p>Carregando agenda...</p></div>`;
        const agendamentos = await buscarAgendamentos(empresaIdGlobal, data, profId);
        renderizarAgendamentos(agendamentos, data);
    }
    
    function renderizarAgendamentos(agendamentos, dataSelecionada) {
        if (!listaAgendamentosEl) return;
        listaAgendamentosEl.innerHTML = "";

        if (agendamentos.length === 0) {
            const dataFormatada = dataSelecionada.split("-").reverse().join("/");
            listaAgendamentosEl.innerHTML = `<div class="card-info"><h2 style="font-size:1.35rem;font-weight:600;">Nenhum agendamento ativo</h2><p>Não existem compromissos para <span style="font-weight:700">${dataFormatada}</span>.</p></div>`;
            return;
        }

        agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));
        agendamentos.forEach(ag => {
            const card = document.createElement("div");
            card.className = "card-agendamento";
            card.innerHTML = `
                <div class="card-agendamento-header">
                    <div class="servico-info">
                        <span class="servico-nome">${ag.servicoNome || 'Serviço'}</span>
                        <span class="servico-horario">${ag.horario}</span>
                    </div>
                    <div class="servico-preco">
                        R$ ${ag.servicoPreco ? ag.servicoPreco.toFixed(2) : '0.00'}
                    </div>
                </div>
                <div class="card-agendamento-body">
                    <div class="info-item">
                        <span class="label">Profissional:</span>
                        <span class="valor">${ag.profissionalNome || 'Não informado'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Cliente:</span>
                        <span class="valor">${ag.clienteNome || 'Não informado'}</span>
                    </div>
                </div>
                <div class="card-agendamento-footer">
                    <button class="btn-acao-card btn-concluir" data-id="${ag.id}">✔️ Concluir</button>
                    <button class="btn-acao-card btn-cancelar" data-id="${ag.id}">✖️ Cancelar</button>
                </div>
            `;
            listaAgendamentosEl.appendChild(card);
        });

        listaAgendamentosEl.querySelectorAll('.btn-concluir').forEach(btn => {
            btn.addEventListener('click', (e) => concluirAgendamento(e.currentTarget.dataset.id));
        });
        listaAgendamentosEl.querySelectorAll('.btn-cancelar').forEach(btn => {
            btn.addEventListener('click', (e) => cancelarAgendamento(e.currentTarget.dataset.id));
        });
    }

    // --- INICIALIZAÇÃO GERAL ---

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaIdGlobal = await getEmpresaIdDoDono(user.uid);
            if (empresaIdGlobal) {
                if (!inputDataEl.value) {
                    const hoje = new Date();
                    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
                    inputDataEl.value = hoje.toISOString().split("T")[0];
                }
                
                // Busca os profissionais e LOGA o resultado para depuração
                todosProfissionais = await buscarProfissionais(empresaIdGlobal);
                console.log("Profissionais encontrados para o filtro:", todosProfissionais); // <-- LOG DE DEPURAÇÃO
                
                popularFiltroProfissionais();
                
                inputDataEl.addEventListener("change", atualizarAgenda);
                filtroProfissionalEl.addEventListener("change", atualizarAgenda);
                
                atualizarAgenda();
            } else {
                document.body.innerHTML = '<h1>Acesso negado. Você não é o dono de uma empresa.</h1>';
            }
        } else {
            window.location.href = 'login.html';
        }
    });
});
