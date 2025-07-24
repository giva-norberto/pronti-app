/**
 * vitrine.js (Vitrine Interativa do Cliente)
 * Gere todo o fluxo de agendamento, desde a seleção de serviço
 * e horário até à confirmação final.
 */

import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let profissionalUid = null;
let servicoSelecionado = null;
let horarioSelecionado = null;
let horariosConfig = {}; // Guarda as configurações de horário do profissional

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

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', inicializarVitrine);

async function inicializarVitrine() {
  const urlParams = new URLSearchParams(window.location.search);
  // CORREÇÃO: Procura por 'slug' na URL, que é o formato correto gerado pelo perfil.
  const slug = urlParams.get('slug');

  if (!slug) {
    loader.innerHTML = `<p style="color:red; text-align:center;">Link inválido. O profissional não foi especificado.</p>`;
    return;
  }

  try {
    // Encontra o UID do profissional a partir do slug.
    profissionalUid = await encontrarProfissionalPeloSlug(slug);

    if (!profissionalUid) {
        loader.innerHTML = `<p style="color:red; text-align:center;">Profissional não encontrado. Verifique o link.</p>`;
        return;
    }

    // Carrega tudo em paralelo
    await Promise.all([
        carregarPerfilPublico(),
        carregarConfiguracoesHorario(),
        carregarServicos()
    ]);

    // Mostra o conteúdo e esconde o loader
    loader.style.display = 'none';
    content.style.display = 'block';

    // Configura os eventos
    configurarEventos();

  } catch (error) {
    console.error("Erro ao inicializar a vitrine:", error);
    loader.innerHTML = `<p style="color:red; text-align:center;">Não foi possível carregar a página deste profissional.</p>`;
  }
}

function configurarEventos() {
    // Define a data atual e o listener
    dataInput.value = new Date().toISOString().split('T')[0];
    dataInput.min = new Date().toISOString().split('T')[0]; // Impede de selecionar datas passadas
    dataInput.addEventListener('change', gerarHorariosDisponiveis);
    
    // Listeners para os campos do cliente para verificar o estado do botão
    nomeClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    telefoneClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);

    // Listener do botão de confirmação
    btnConfirmar.addEventListener('click', salvarAgendamento);

    // Gera os horários para a data de hoje
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
    // Define a data atual formatada
    dataAtualEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}

async function carregarConfiguracoesHorario() {
    const horariosRef = doc(db, "users", profissionalUid, "configuracoes", "horarios");
    const docSnap = await getDoc(horariosRef);
    if (docSnap.exists()) {
        horariosConfig = docSnap.data();
    } else {
        // Configuração padrão se o empresário não definir
        horariosConfig = { intervalo: 30 };
    }
}

async function carregarServicos() {
  servicosContainer.innerHTML = '';
  const servicosRef = collection(db, "users", profissionalUid, "servicos");
  // ALTERAÇÃO: Mostra todos os serviços que NÃO estão marcados como "não visíveis".
  // Isto faz com que os serviços antigos (sem a marcação) apareçam por defeito.
  const q = query(servicosRef, where("visivelNaVitrine", "!=", false));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    servicosContainer.innerHTML = '<p>Nenhum serviço disponível.</p>';
    return;
  }

  snapshot.forEach(doc => {
    const servico = doc.data();
    const btn = document.createElement('button');
    btn.className = 'btn-servico';
    btn.textContent = `${servico.nome} (R$ ${parseFloat(servico.preco).toFixed(2)})`;
    btn.dataset.id = doc.id;
    btn.onclick = () => {
        servicoSelecionado = { id: doc.id, nome: servico.nome };
        document.querySelectorAll('.btn-servico').forEach(b => b.classList.remove('selecionado'));
        btn.classList.add('selecionado');
        verificarEstadoBotaoConfirmar();
    };
    servicosContainer.appendChild(btn);
  });
}

// --- LÓGICA DE HORÁRIOS ---

async function gerarHorariosDisponiveis() {
    horariosContainer.innerHTML = '<p class="aviso-horarios">A verificar...</p>';
    horarioSelecionado = null; // Reseta o horário ao mudar a data
    verificarEstadoBotaoConfirmar();

    const diaSelecionado = new Date(dataInput.value + "T12:00:00");
    const diaDaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSelecionado.getDay()];
    
    const configDia = horariosConfig[diaDaSemana];
    if (!configDia || !configDia.ativo || !configDia.blocos || configDia.blocos.length === 0) {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Não há atendimento neste dia.</p>';
        return;
    }

    // Busca agendamentos existentes para o dia
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
        await addDoc(agendamentosRef, novoAgendamento);
        content.innerHTML = `
            <div class="info-card" style="text-align:center;">
                <h3>✅ Agendamento Confirmado!</h3>
                <p>O seu horário para <strong>${horarioSelecionado}</strong> do dia <strong>${new Date(dataInput.value+'T12:00:00').toLocaleDateString()}</strong> foi confirmado com sucesso.</p>
                <p>Obrigado por agendar connosco!</p>
            </div>
        `;
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        alert("Ocorreu um erro ao salvar o seu agendamento. Tente novamente.");
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Agendamento';
    }
}
