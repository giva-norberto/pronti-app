/**
 * vitrine.js (Vitrine Interativa do Cliente)
 * VERSÃO ATUALIZADA com fluxo de "Primeiro Acesso"
 */

import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, limit, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
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

// --- CÓDIGO NOVO: Elementos para o fluxo de identificação ---
const btnPrimeiroAcesso = document.getElementById('btn-primeiro-acesso');
const saudacaoClienteEl = document.getElementById('saudacao-cliente');
const modalAcesso = document.getElementById('modal-primeiro-acesso');
const btnSalvarDadosModal = document.getElementById('btn-salvar-dados-cliente');
const btnFecharModal = modalAcesso.querySelector('.fechar-modal');
const inputNomeModal = document.getElementById('input-nome-modal');
const inputTelefoneModal = document.getElementById('input-telefone-modal');
const agendamentosClienteContainer = document.getElementById('agendamentos-cliente');
const listaMeusAgendamentosEl = document.getElementById('lista-meus-agendamentos');


// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', inicializarVitrine);

async function inicializarVitrine() {
  const urlParams = new URLSearchParams(window.location.search);
  // O seu código original usava 'slug', vamos manter essa lógica
  const slug = urlParams.get('slug') || urlParams.get('profissional'); // Compatibilidade

  if (!slug) {
    loader.innerHTML = `<p style="color:red; text-align:center;">Link inválido. O profissional não foi especificado.</p>`;
    return;
  }

  try {
    // A sua função 'encontrarProfissionalPeloSlug' não estava no código, então usei uma genérica
    profissionalUid = await encontrarUidPeloSlug(slug);
    if (!profissionalUid) {
        loader.innerHTML = `<p style="color:red; text-align:center;">Profissional não encontrado. Verifique o link.</p>`;
        return;
    }

    await Promise.all([
        carregarPerfilPublico(),
        carregarConfiguracoesHorario(),
        carregarServicos()
    ]);

    loader.style.display = 'none';
    content.style.display = 'block';
    configurarEventosGerais();
    
    // --- CÓDIGO NOVO: Inicia o fluxo de identificação do cliente ---
    gerenciarSessaoDoCliente();

  } catch (error) {
    console.error("Erro ao inicializar a vitrine:", error);
    loader.innerHTML = `<p style="color:red; text-align:center;">Não foi possível carregar a página deste profissional.</p>`;
  }
}

function configurarEventosGerais() {
    dataInput.value = new Date().toISOString().split('T')[0];
    dataInput.min = new Date().toISOString().split('T')[0];
    dataInput.addEventListener('change', gerarHorariosDisponiveis);
    nomeClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    telefoneClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    btnConfirmar.addEventListener('click', salvarAgendamento);
    gerarHorariosDisponiveis();
}

// --- CÓDIGO NOVO: Funções do Fluxo de Identificação ---

function limparTelefone(telefone) {
    return telefone ? telefone.replace(/\D/g, '') : "";
}

function gerenciarSessaoDoCliente() {
    const dadosCliente = JSON.parse(localStorage.getItem('dadosClientePronti'));
    if (dadosCliente && dadosCliente.telefone) {
        iniciarSessaoIdentificada(dadosCliente);
    } else {
        configurarPrimeiroAcesso();
    }
}

function iniciarSessaoIdentificada(dadosCliente) {
    btnPrimeiroAcesso.style.display = 'none';
    saudacaoClienteEl.innerHTML = `Olá, <strong>${dadosCliente.nome}</strong>! Bem-vindo(a) de volta.`;
    saudacaoClienteEl.style.display = 'block';
    
    nomeClienteInput.value = dadosCliente.nome;
    telefoneClienteInput.value = dadosCliente.telefone;

    verificarEstadoBotaoConfirmar();
    carregarAgendamentosCliente(dadosCliente.telefone);
}

function configurarPrimeiroAcesso() {
    btnPrimeiroAcesso.style.display = 'block';
    btnPrimeiroAcesso.addEventListener('click', () => modalAcesso.style.display = 'flex');
    btnFecharModal.addEventListener('click', () => modalAcesso.style.display = 'none');

    btnSalvarDadosModal.addEventListener('click', () => {
        const nome = inputNomeModal.value.trim();
        const telefone = inputTelefoneModal.value;
        const telefoneLimpo = limparTelefone(telefone);

        if (nome && telefoneLimpo.length >= 10) {
            const dadosCliente = { nome, telefone: telefoneLimpo };
            localStorage.setItem('dadosClientePronti', JSON.stringify(dadosCliente));
            modalAcesso.style.display = 'none';
            iniciarSessaoIdentificada(dadosCliente);
        } else {
            alert("Por favor, preencha seu nome e um telefone válido.");
        }
    });
}

// --- FUNÇÕES DE CARREGAMENTO DE DADOS (Seu código original, mantido) ---

// Esta função não estava no seu código original, mas é necessária. Adaptei do nosso chat.
async function encontrarUidPeloSlug(slug) {
    const q = query(collection(db, "publicProfiles"), where("slug", "==", slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const profileData = snapshot.docs[0].data();
    return profileData.ownerId || snapshot.docs[0].id; // ownerId é mais robusto
}


async function carregarPerfilPublico() {
    const perfilRef = doc(db, "users", profissionalUid, "publicProfile", "profile");
    const docSnap = await getDoc(perfilRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        nomeNegocioEl.textContent = data.nomeNegocio || "Nome não definido";
        if (data.logoUrl) logoEl.src = data.logoUrl;
        else logoEl.src = 'https://placehold.co/100x100/e0e7ff/6366f1?text=Logo'; // Fallback
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
    const snapshot = await getDocs(query(servicosRef, where("visivelNaVitrine", "==", true)));

    if (snapshot.empty) {
        servicosContainer.innerHTML = '<p>Nenhum serviço disponível para agendamento online no momento.</p>';
        return;
    }

    snapshot.docs.forEach(doc => {
        const servico = { id: doc.id, ...doc.data() };
        const card = document.createElement('div');
        card.className = 'servico-card'; // Usei a classe do seu JS

        card.innerHTML = `
            <button class="btn-servico" data-id="${servico.id}">
                <span class="nome">${servico.nome}</span>
                <span class="preco">R$ ${parseFloat(servico.preco).toFixed(2)}</span>
            </button>
            <div class="detalhes-servico" id="detalhes-${servico.id}" style="display: none;">
                <p><strong>Descrição:</strong> ${servico.descricao || 'Não informada.'}</p>
                <p><strong>Duração:</strong> ${servico.duracao || 'Não informada'} minutos</p>
            </div>
        `;
        servicosContainer.appendChild(card);
    });

    // Adiciona os eventos de clique após todos os elementos estarem no DOM
    document.querySelectorAll('.btn-servico').forEach(btnServico => {
        btnServico.onclick = () => {
            const detalhesDiv = btnServico.nextElementSibling;
            const isSelected = btnServico.classList.contains('selecionado');

            document.querySelectorAll('.detalhes-servico').forEach(d => d.style.display = 'none');
            document.querySelectorAll('.btn-servico').forEach(b => b.classList.remove('selecionado'));

            if (!isSelected) {
                servicoSelecionado = { id: btnServico.dataset.id, nome: btnServico.querySelector('.nome').textContent };
                btnServico.classList.add('selecionado');
                detalhesDiv.style.display = 'block';
            } else {
                servicoSelecionado = null;
            }
            verificarEstadoBotaoConfirmar();
        };
    });
}


// --- LÓGICA DE HORÁRIOS (Seu código original, mantido) ---
async function gerarHorariosDisponiveis() {
    // Seu código original aqui... (Mantido sem alterações)
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

    const inicioDoDia = new Date(dataInput.value + "T00:00:00");
    const fimDoDia = new Date(dataInput.value + "T23:59:59");

    const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
    const q = query(agendamentosRef, where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const snapshot = await getDocs(q);
    const horariosOcupados = snapshot.docs.map(doc => {
        const dataAg = doc.data().horario.toDate(); // Firestore v9 retorna Timestamps
        return dataAg.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    });


    horariosContainer.innerHTML = '';
    let encontrouHorario = false;
    const intervalo = parseInt(horariosConfig.intervalo, 10) || 30;

    configDia.blocos.forEach(bloco => {
        const [horaInicio, minInicio] = bloco.inicio.split(':').map(Number);
        const [horaFim, minFim] = bloco.fim.split(':').map(Number);
        
        for (let h = horaInicio; h <= horaFim; h++) {
            for (let m = (h === horaInicio ? minInicio : 0); m < (h === horaFim ? minFim : 60); m += intervalo) {
                const horario = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (!horariosOcupados.includes(horario)) {
                    encontrouHorario = true;
                    const btn = document.createElement('button');
                    btn.className = 'btn-horario'; // Use a classe do seu CSS
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
    const telOk = limparTelefone(telefoneClienteInput.value).length >= 10;
    btnConfirmar.disabled = !(servicoSelecionado && horarioSelecionado && nomeOk && telOk);
}

async function salvarAgendamento() {
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Agendando...';

    try {
        const [h, m] = horarioSelecionado.split(':');
        const dataHora = new Date(dataInput.value);
        dataHora.setHours(h, m, 0, 0);

        const nomeCliente = nomeClienteInput.value.trim();
        const telefoneCliente = limparTelefone(telefoneClienteInput.value);
        
        const agendamento = {
            clienteNome: nomeCliente,
            clienteTelefone: telefoneCliente,
            servicoId: servicoSelecionado.id,
            servicoNome: servicoSelecionado.nome,
            horario: Timestamp.fromDate(dataHora), // Salva como Timestamp
            criadoEm: Timestamp.now(),
            profissionalUid: profissionalUid,
            status: 'agendado'
        };

        await addDoc(collection(db, "users", profissionalUid, "agendamentos"), agendamento);
        
        // --- CÓDIGO NOVO: Garante que os dados do cliente sejam salvos no localStorage ---
        localStorage.setItem('dadosClientePronti', JSON.stringify({ nome: nomeCliente, telefone: telefoneCliente }));

        alert("Agendamento realizado com sucesso!");

        // Reseta formulário, mas mantém os dados do cliente
        servicoSelecionado = null;
        horarioSelecionado = null;
        document.querySelectorAll('.btn-servico.selecionado').forEach(b => b.classList.remove('selecionado'));
        document.querySelectorAll('.detalhes-servico').forEach(d => d.style.display = 'none');
        
        dataInput.value = new Date().toISOString().split('T')[0];
        gerarHorariosDisponiveis();
        carregarAgendamentosCliente(telefoneCliente);

    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        alert("Não foi possível realizar o agendamento. Tente novamente.");
    } finally {
        btnConfirmar.textContent = 'Confirmar Agendamento';
        verificarEstadoBotaoConfirmar();
    }
}


// --- LISTAGEM DE AGENDAMENTOS DO CLIENTE ---

async function carregarAgendamentosCliente(telefone) {
    const telefoneLimpo = limparTelefone(telefone);
    if (!telefoneLimpo) {
        agendamentosClienteContainer.style.display = 'none';
        return;
    }

    agendamentosClienteContainer.style.display = 'block';
    listaMeusAgendamentosEl.innerHTML = '<p>Carregando seus agendamentos...</p>';
    
    try {
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        const q = query(
            agendamentosRef,
            where("clienteTelefone", "==", telefoneLimpo),
            orderBy("horario", "desc"), // Ordena do mais recente para o mais antigo
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listaMeusAgendamentosEl.innerHTML = '<p>Nenhum agendamento encontrado para este telefone.</p>';
            return;
        }

        listaMeusAgendamentosEl.innerHTML = '';
        snapshot.forEach(doc => {
            const ag = doc.data();
            const id = doc.id;
            // Converte Timestamp do Firestore para objeto Date do JS
            const horarioFormatado = ag.horario.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            
            const card = document.createElement('div');
            // Usei a classe do seu HTML
            card.className = 'agendamento-item'; 
            card.innerHTML = `
                <div>
                  <strong>${ag.servicoNome}</strong><br>
                  <span>${horarioFormatado}</span>
                </div>
                <button class="btn-cancelar" data-id="${id}">Cancelar</button>
            `;

            card.querySelector('.btn-cancelar').onclick = async () => {
                const confirmar = confirm('Deseja realmente cancelar este agendamento?');
                if (!confirmar) return;
                
                try {
                    await deleteDoc(doc(db, "users", profissionalUid, "agendamentos", id));
                    alert('Agendamento cancelado com sucesso.');
                    carregarAgendamentosCliente(telefoneLimpo);
                    gerarHorariosDisponiveis();
                } catch (err) {
                    console.error('Erro ao cancelar:', err);
                    alert('Não foi possível cancelar o agendamento.');
                }
            };
            listaMeusAgendamentosEl.appendChild(card);
        });
    } catch(error) {
        console.error("Erro ao carregar agendamentos do cliente:", error);
        listaMeusAgendamentosEl.innerHTML = '<p style="color:red;">Ocorreu um erro ao buscar seus agendamentos.</p>';
    }
}
