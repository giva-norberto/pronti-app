/**
 * vitrine.js (com Gestão de Agendamentos)
 * Versão completa que permite ao cliente ver e cancelar os seus
 * próprios agendamentos, além de agendar novos.
 */

import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let profissionalUid = null;
let servicoSelecionado = null;
let horarioSelecionado = null;
let horariosConfig = {};

// --- ELEMENTOS DO DOM ---
const loader = document.getElementById('vitrine-loader');
const content = document.getElementById('vitrine-content');
const nomeNegocioEl = document.getElementById('nome-negocio-publico');
const dataAtualEl = document.getElementById('data-atual');
const logoEl = document.getElementById('logo-publico');
const servicosContainer = document.getElementById('lista-servicos');
const dataInput = document.getElementById('data-agendamento');
const horariosContainer = document.getElementById('grade-horarios');
const nomeClienteInput = document.getElementById('nome-cliente');
const telefoneClienteInput = document.getElementById('telefone-cliente');
const btnConfirmar = document.getElementById('btn-confirmar-agendamento');
const meusAgendamentosContainer = document.getElementById('meus-agendamentos');
const listaMeusAgendamentos = document.getElementById('lista-meus-agendamentos');

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', inicializarVitrine);

async function inicializarVitrine() {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');

  if (!slug) {
    loader.innerHTML = `<p style="color:red; text-align:center;">Link inválido.</p>`;
    return;
  }

  try {
    profissionalUid = await encontrarProfissionalPeloSlug(slug);
    if (!profissionalUid) {
        loader.innerHTML = `<p style="color:red; text-align:center;">Profissional não encontrado.</p>`;
        return;
    }

    await Promise.all([
        carregarPerfilPublico(),
        carregarConfiguracoesHorario(),
        carregarServicos(),
        carregarMeusAgendamentos() // Carrega os agendamentos do cliente
    ]);

    loader.style.display = 'none';
    content.style.display = 'block';
    configurarEventos();

  } catch (error) {
    console.error("Erro ao inicializar a vitrine:", error);
    loader.innerHTML = `<p style="color:red; text-align:center;">Não foi possível carregar a página.</p>`;
  }
}

function configurarEventos() {
    dataInput.value = new Date().toISOString().split('T')[0];
    dataInput.min = new Date().toISOString().split('T')[0];
    dataInput.addEventListener('change', gerarHorariosDisponiveis);
    nomeClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    telefoneClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    btnConfirmar.addEventListener('click', salvarAgendamento);
    gerarHorariosDisponiveis();
}

// --- FUNÇÕES DE CARREGAMENTO DE DADOS ---

async function encontrarProfissionalPeloSlug(slug) {
    const publicProfilesRef = collection(db, "publicProfiles");
    const q = query(publicProfilesRef, where("slug", "==", slug), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].data().ownerId;
}

async function carregarPerfilPublico() {
  const perfilRef = doc(db, "users", profissionalUid, "publicProfile", "profile");
  const docSnap = await getDoc(perfilRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    nomeNegocioEl.textContent = data.nomeNegocio || "Nome não definido";
    if (data.logoUrl) logoEl.src = data.logoUrl;
    dataAtualEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}

async function carregarConfiguracoesHorario() {
    const horariosRef = doc(db, "users", profissionalUid, "configuracoes", "horarios");
    const docSnap = await getDoc(horariosRef);
    horariosConfig = docSnap.exists() ? docSnap.data() : { intervalo: 30 };
}

async function carregarServicos() {
  servicosContainer.innerHTML = '';
  const servicosRef = collection(db, "users", profissionalUid, "servicos");
  const snapshot = await getDocs(servicosRef);
  const servicosVisiveis = [];
  snapshot.forEach(doc => {
    const servico = doc.data();
    if (servico.visivelNaVitrine !== false) {
        servicosVisiveis.push({ id: doc.id, ...servico });
    }
  });

  if (servicosVisiveis.length === 0) {
    servicosContainer.innerHTML = '<p>Nenhum serviço disponível.</p>';
    return;
  }

  servicosVisiveis.forEach(servico => {
    const btn = document.createElement('button');
    btn.className = 'btn-servico';
    btn.textContent = `${servico.nome} (R$ ${parseFloat(servico.preco).toFixed(2)})`;
    btn.dataset.id = servico.id;
    btn.onclick = () => {
        servicoSelecionado = { id: servico.id, nome: servico.nome };
        document.querySelectorAll('.btn-servico').forEach(b => b.classList.remove('selecionado'));
        btn.classList.add('selecionado');
        verificarEstadoBotaoConfirmar();
    };
    servicosContainer.appendChild(btn);
  });
}

// --- LÓGICA DE HORÁRIOS ---

async function gerarHorariosDisponiveis() {
    // (A lógica desta função permanece a mesma da versão anterior)
    horariosContainer.innerHTML = '<p class="aviso-horarios">A verificar...</p>';
    horarioSelecionado = null;
    verificarEstadoBotaoConfirmar();

    const diaSelecionado = new Date(dataInput.value + "T12:00:00");
    const diaDaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSelecionado.getDay()];
    
    const configDia = horariosConfig[diaDaSemana];
    if (!configDia || !configDia.ativo || !configDia.blocos || configDia.blocos.length === 0) {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Não há atendimento neste dia.</p>';
        return;
    }

    const inicioDoDia = new Date(dataInput.value + "T00:00:00").toISOString();
    const fimDoDia = new Date(dataInput.value + "T23:59:59").toISOString();
    const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
    const q = query(agendamentosRef, where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const snapshot = await getDocs(q);
    const horariosOcupados = snapshot.docs.map(doc => new Date(doc.data().horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    horariosContainer.innerHTML = '';
    let encontrouHorario = false;
    const intervalo = horariosConfig.intervalo || 30;

    configDia.blocos.forEach(bloco => {
        const [horaInicio, minInicio] = bloco.inicio.split(':').map(Number);
        const [horaFim, minFim] = bloco.fim.split(':').map(Number);
        
        for (let h = horaInicio; h <= horaFim; h++) {
            for (let m = (h === horaInicio ? minInicio : 0); m < (h === horaFim ? minFim : 60); m += intervalo) {
                const horario = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (!horariosOcupados.includes(horario)) {
                    encontrouHorario = true;
                    const btn = document.createElement('button');
                    btn.className = 'btn-horario';
                    btn.textContent = horario;
                    btn.onclick = () => {
                        horarioSelecionado = horario;
                        document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                        btn.classList.add('selecionado');
                        verificarEstadoBotaoConfirmar();
                    };
                    horariosContainer.appendChild(btn);
                }
            }
        }
    });

    if (!encontrouHorario) {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Todos os horários para esta data foram preenchidos.</p>';
    }
}

// --- LÓGICA DE GESTÃO DE AGENDAMENTOS DO CLIENTE ---

async function carregarMeusAgendamentos() {
    const meusAgendamentosIds = JSON.parse(localStorage.getItem(`pronti-agendamentos-${profissionalUid}`) || '[]');
    if (meusAgendamentosIds.length === 0) return;

    meusAgendamentosContainer.style.display = 'block';
    listaMeusAgendamentos.innerHTML = '<p>A carregar os seus agendamentos...</p>';

    const agendamentosPromises = meusAgendamentosIds.map(id => getDoc(doc(db, "users", profissionalUid, "agendamentos", id)));
    const agendamentosDocs = await Promise.all(agendamentosPromises);

    listaMeusAgendamentos.innerHTML = '';
    for (const docSnap of agendamentosDocs) {
        if (docSnap.exists()) {
            const agendamento = docSnap.data();
            const servicoRef = doc(db, "users", profissionalUid, "servicos", agendamento.servicoId);
            const servicoSnap = await getDoc(servicoRef);
            const servicoNome = servicoSnap.exists() ? servicoSnap.data().nome : "Serviço";

            const item = document.createElement('div');
            item.className = 'agendamento-item';
            item.innerHTML = `
                <div>
                    <h3>${servicoNome}</h3>
                    <p><strong>Horário:</strong> ${new Date(agendamento.horario).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</p>
                </div>
                <div class="item-acoes">
                    <button class="btn-excluir" data-id="${docSnap.id}">Cancelar</button>
                </div>
            `;
            listaMeusAgendamentos.appendChild(item);
        }
    }
    
    // Adiciona listener para os botões de cancelar
    listaMeusAgendamentos.querySelectorAll('.btn-excluir').forEach(btn => {
        btn.addEventListener('click', (e) => cancelarAgendamento(e.target.dataset.id));
    });
}

async function cancelarAgendamento(id) {
    if (!confirm("Tem a certeza de que deseja cancelar este agendamento?")) return;
    
    try {
        await deleteDoc(doc(db, "users", profissionalUid, "agendamentos", id));
        
        let meusAgendamentosIds = JSON.parse(localStorage.getItem(`pronti-agendamentos-${profissionalUid}`) || '[]');
        meusAgendamentosIds = meusAgendamentosIds.filter(agId => agId !== id);
        localStorage.setItem(`pronti-agendamentos-${profissionalUid}`, JSON.stringify(meusAgendamentosIds));
        
        alert("Agendamento cancelado com sucesso!");
        window.location.reload(); // Recarrega a página para atualizar tudo
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        alert("Não foi possível cancelar o agendamento.");
    }
}

// --- LÓGICA DE CONFIRMAÇÃO ---

function verificarEstadoBotaoConfirmar() {
    const nomeOk = nomeClienteInput.value.trim() !== '';
    const telefoneOk = telefoneClienteInput.value.trim() !== '';
    if (servicoSelecionado && horarioSelecionado && nomeOk && telefoneOk) {
        btnConfirmar.disabled = false;
    } else {
        btnConfirmar.disabled = true;
    }
}

async function salvarAgendamento(event) {
    event.preventDefault();
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'A agendar...';

    const horarioFinalISO = new Date(`${dataInput.value}T${horarioSelecionado}:00`).toISOString();
    const novoAgendamento = {
        cliente: nomeClienteInput.value.trim(),
        telefone: telefoneClienteInput.value.trim(),
        servicoId: servicoSelecionado.id,
        horario: horarioFinalISO,
        criadoEm: Timestamp.now()
    };

    try {
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        const docRef = await addDoc(agendamentosRef, novoAgendamento);

        // Salva o ID do novo agendamento no localStorage
        const meusAgendamentosIds = JSON.parse(localStorage.getItem(`pronti-agendamentos-${profissionalUid}`) || '[]');
        meusAgendamentosIds.push(docRef.id);
        localStorage.setItem(`pronti-agendamentos-${profissionalUid}`, JSON.stringify(meusAgendamentosIds));

        content.innerHTML = `
            <div class="info-card" style="text-align:center;">
                <h3>✅ Agendamento Confirmado!</h3>
                <p>O seu horário para <strong>${horarioSelecionado}</strong> do dia <strong>${new Date(dataInput.value+'T12:00:00').toLocaleDateString()}</strong> foi confirmado com sucesso.</p>
                <p>Obrigado por agendar connosco!</p>
                <button class="btn-new" style="margin-top: 20px;" onclick="window.location.reload()">Agendar Novo Horário</button>
            </div>
        `;
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        alert("Ocorreu um erro ao salvar o seu agendamento. Tente novamente.");
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Agendamento';
    }
}
