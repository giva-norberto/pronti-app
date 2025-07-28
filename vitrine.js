// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e5df3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let profissionalUid = null;
let servicoSelecionado = null;
let horarioSelecionado = null;
let horariosConfig = {};

const loader = document.getElementById("vitrine-loader");
const content = document.getElementById("vitrine-content");
const nomeNegocioEl = document.getElementById("nome-negocio-publico");
const dataAtualEl = document.getElementById("data-atual");
const logoEl = document.getElementById("logo-publico");
const servicosContainer = document.getElementById("lista-servicos");
const dataInput = document.getElementById("data-agendamento");
const horariosContainer = document.getElementById("grade-horarios");
const nomeClienteInput = document.getElementById("nome-cliente");
const telefoneClienteInput = document.getElementById("telefone-cliente");
const pinClienteInput = document.getElementById("pin-cliente");
const btnConfirmar = document.getElementById("btn-confirmar-agendamento");
const btnPrimeiroAcesso = document.getElementById("btn-primeiro-acesso");
const saudacaoClienteEl = document.getElementById("saudacao-cliente");
const modalAcesso = document.getElementById("modal-primeiro-acesso");
const btnSalvarDadosModal = document.getElementById("btn-salvar-dados-cliente");
const agendamentosClienteContainer = document.getElementById("agendamentos-cliente");
const listaMeusAgendamentosEl = document.getElementById("lista-meus-agendamentos");
const notificationMessageEl = document.getElementById("notification-message");
const btnVerificarAgendamentos = document.getElementById("btn-verificar-agendamentos");
const modalVerificarAgendamentos = document.getElementById("modal-verificar-agendamentos");
const btnVerificarAgendamentosModal = document.getElementById("btn-verificar-agendamentos-modal");
const inputTelefoneVerificar = document.getElementById("input-telefone-verificar");
const inputPinVerificar = document.getElementById("input-pin-verificar");

// Função para exibir mensagens de notificação
function showNotification(message, isError = false) {
    notificationMessageEl.textContent = message;
    notificationMessageEl.className = "notification-message";
    if (isError) {
        notificationMessageEl.classList.add("error");
    }
    notificationMessageEl.style.display = "block";
    notificationMessageEl.style.opacity = "1";

    setTimeout(() => {
        notificationMessageEl.style.opacity = "0";
        setTimeout(() => {
            notificationMessageEl.style.display = "none";
        }, 500);
    }, 3000);
}

// *** FUNÇÕES DE SEGURANÇA COM PIN/SENHA (FRONTEND ONLY) ***

// Função para gerar hash SHA-256 no frontend
async function gerarHashSHA256(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Função para validar PIN
function validarPIN(pin) {
  if (!/^\d{4,6}$/.test(pin)) {
    return { valido: false, erro: 'PIN deve conter entre 4 e 6 dígitos.' };
  }
  
  const pinsProibidos = ['1234', '4321', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
  if (pinsProibidos.includes(pin)) {
    return { valido: false, erro: 'PIN muito simples. Escolha uma combinação mais segura.' };
  }
  
  return { valido: true };
}

async function inicializarVitrine() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        loader.innerHTML = `<p style="color:red; text-align:center;">Link inválido. O profissional não foi especificado.</p>`;
        return;
    }

    try {
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
    pinClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    btnConfirmar.addEventListener('click', salvarAgendamentoComPIN);
    
    // Eventos para verificar agendamentos
    btnVerificarAgendamentos.addEventListener('click', () => {
        modalVerificarAgendamentos.style.display = 'flex';
    });
    
    btnVerificarAgendamentosModal.addEventListener('click', verificarAgendamentosComPIN);
    
    // Fechar modais
    document.querySelectorAll('.fechar-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    gerarHorariosDisponiveis();
}

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
}

function configurarPrimeiroAcesso() {
    btnPrimeiroAcesso.style.display = 'block';
    btnPrimeiroAcesso.addEventListener('click', () => modalAcesso.style.display = 'flex');
    modalAcesso.querySelector('.fechar-modal').addEventListener('click', () => modalAcesso.style.display = 'none');

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
            showNotification("Por favor, preencha seu nome e um telefone válido.", true);
        }
    });
}

async function encontrarUidPeloSlug(slug) {
    const slugRef = doc(db, "slugs", slug);
    const docSnap = await getDoc(slugRef);
    return docSnap.exists() ? docSnap.data().uid : null;
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
    
    if (docSnap.exists()) {
        horariosConfig = docSnap.data();
    } else {
        // Configuração padrão caso não exista
        horariosConfig = {
            intervalo: 30,
            segunda: { ativo: true, inicio: "09:00", fim: "18:00" },
            terca: { ativo: true, inicio: "09:00", fim: "18:00" },
            quarta: { ativo: true, inicio: "09:00", fim: "18:00" },
            quinta: { ativo: true, inicio: "09:00", fim: "18:00" },
            sexta: { ativo: true, inicio: "09:00", fim: "18:00" },
            sabado: { ativo: false, inicio: "09:00", fim: "12:00" },
            domingo: { ativo: false, inicio: "09:00", fim: "12:00" }
        };
        console.warn('Configurações de horário não encontradas. Usando configuração padrão.');
    }
    
    console.log('Configurações de horário carregadas:', horariosConfig);
}

async function carregarServicos() {
    servicosContainer.innerHTML = '';
    const servicosRef = collection(db, "users", profissionalUid, "servicos");
    const snapshot = await getDocs(servicosRef);

    let servicosVisiveisEncontrados = 0;
    snapshot.docs.forEach(docSnapshot => {
        const servico = { id: docSnapshot.id, ...docSnapshot.data() };
        if (servico.visivelNaVitrine !== false) {
            servicosVisiveisEncontrados++;
            const card = document.createElement('div');
            card.className = 'servico-card';
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
            const btnServico = card.querySelector('.btn-servico');
            btnServico.addEventListener('click', () => selecionarServico(servico, btnServico));
        }
    });

    if (servicosVisiveisEncontrados === 0) {
        servicosContainer.innerHTML = '<p>Nenhum serviço disponível no momento.</p>';
    }
}

function selecionarServico(servico, btnElement) {
    document.querySelectorAll('.btn-servico').forEach(btn => btn.classList.remove('selecionado'));
    btnElement.classList.add('selecionado');
    servicoSelecionado = servico;

    document.querySelectorAll('.detalhes-servico').forEach(div => div.style.display = 'none');
    document.getElementById(`detalhes-${servico.id}`).style.display = 'block';

    verificarEstadoBotaoConfirmar();
    gerarHorariosDisponiveis();
}

async function gerarHorariosDisponiveis() {
    if (!dataInput.value || !servicoSelecionado) {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data.</p>';
        return;
    }
    horariosContainer.innerHTML = '<p class="aviso-horarios">Carregando horários...</p>';
    try {
        const agendamentosOcupados = await buscarAgendamentosData(dataInput.value);
        const horariosDisponiveis = gerarListaHorarios(dataInput.value, agendamentosOcupados);
        exibirHorarios(horariosDisponiveis);
    } catch (error) {
        console.error('Erro ao gerar horários:', error);
        horariosContainer.innerHTML = '<p class="aviso-horarios">Erro ao carregar horários. Tente novamente.</p>';
    }
}

async function buscarAgendamentosData(data) {
    try {
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        const inicioDoDia = new Date(data + 'T00:00:00');
        const fimDoDia = new Date(data + 'T23:59:59');
        const q = query(
            agendamentosRef,
            where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
            where("horario", "<=", Timestamp.fromDate(fimDoDia))
        );
        const snapshot = await getDocs(q);
        const horariosOcupados = snapshot.docs.map(docSnapshot => {
            const agendamento = docSnapshot.data();
            return agendamento.horario.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        });
        return horariosOcupados;
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        return [];
    }
}

function gerarListaHorarios(data, agendamentosOcupados) {
    const dataObj = new Date(data + 'T00:00:00');
    const diaSemana = dataObj.getDay();
    const nomesDias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const nomeDia = nomesDias[diaSemana];
    const configDia = horariosConfig[nomeDia];
    if (!configDia || !configDia.ativo) {
        return [];
    }
    const horarios = [];
    const intervalo = horariosConfig.intervalo || 30;
    const [horaInicio, minutoInicio] = configDia.inicio.split(':').map(Number);
    const [horaFim, minutoFim] = configDia.fim.split(':').map(Number);
    let horaAtual = horaInicio;
    let minutoAtual = minutoInicio;
    while (horaAtual < horaFim || (horaAtual === horaFim && minutoAtual < minutoFim)) {
        const horarioFormatado = `${horaAtual.toString().padStart(2, '0')}:${minutoAtual.toString().padStart(2, '0')}`;
        if (!agendamentosOcupados.includes(horarioFormatado)) {
            horarios.push(horarioFormatado);
        }
        minutoAtual += intervalo;
        if (minutoAtual >= 60) {
            horaAtual += Math.floor(minutoAtual / 60);
            minutoAtual = minutoAtual % 60;
        }
    }
    return horarios;
}

function exibirHorarios(horarios) {
    if (horarios.length === 0) {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Nenhum horário disponível para esta data.</p>';
        return;
    }
    horariosContainer.innerHTML = '';
    horarios.forEach(horario => {
        const btnHorario = document.createElement('button');
        btnHorario.className = 'btn-horario';
        btnHorario.textContent = horario;
        btnHorario.addEventListener('click', () => selecionarHorario(horario, btnHorario));
        horariosContainer.appendChild(btnHorario);
    });
}

function selecionarHorario(horario, btnElement) {
    document.querySelectorAll('.btn-horario').forEach(btn => btn.classList.remove('selecionado'));
    btnElement.classList.add('selecionado');
    horarioSelecionado = horario;
    verificarEstadoBotaoConfirmar();
}

function verificarEstadoBotaoConfirmar() {
    const nomePreenchido = nomeClienteInput.value.trim().length > 0;
    const telefonePreenchido = limparTelefone(telefoneClienteInput.value).length >= 10;
    const pinPreenchido = pinClienteInput.value.trim().length >= 4;
    const servicoEscolhido = servicoSelecionado !== null;
    const horarioEscolhido = horarioSelecionado !== null;
    btnConfirmar.disabled = !(nomePreenchido && telefonePreenchido && pinPreenchido && servicoEscolhido && horarioEscolhido);
}

async function salvarAgendamentoComPIN() {
    const pin = pinClienteInput.value.trim();
    const validacao = validarPIN(pin);
    if (!validacao.valido) {
        showNotification(validacao.erro, true);
        return;
    }
    try {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Salvando...';
        const pinHash = await gerarHashSHA256(pin);
        const telefoneLimpo = limparTelefone(telefoneClienteInput.value);
        const [hora, minuto] = horarioSelecionado.split(':').map(Number);
        const dataAgendamento = new Date(dataInput.value + 'T00:00:00');
        dataAgendamento.setHours(hora, minuto, 0, 0);
        const agendamento = {
            nomeCliente: nomeClienteInput.value.trim(),
            clienteTelefone: telefoneLimpo,
            servicoId: servicoSelecionado.id,
            servicoNome: servicoSelecionado.nome,
            servicoPreco: servicoSelecionado.preco,
            horario: Timestamp.fromDate(dataAgendamento),
            pinHash: pinHash
        };
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        await addDoc(agendamentosRef, agendamento);
        showNotification(`Agendamento confirmado!`);
        const dadosCliente = { 
            nome: nomeClienteInput.value.trim(), 
            telefone: telefoneLimpo 
        };
        localStorage.setItem('dadosClientePronti', JSON.stringify(dadosCliente));
        resetarFormulario();
        gerarHorariosDisponiveis();
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        showNotification("Erro ao salvar agendamento. Tente novamente.", true);
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Agendamento';
    }
}

async function verificarAgendamentosComPIN() {
    const telefone = limparTelefone(inputTelefoneVerificar.value);
    const pin = inputPinVerificar.value.trim();
    if (!telefone || telefone.length < 10) {
        showNotification("Digite um telefone válido.", true);
        return;
    }
    if (!pin || pin.length < 4) {
        showNotification("Digite um PIN válido.", true);
        return;
    }
    try {
        const pinHash = await gerarHashSHA256(pin);
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        const q = query(agendamentosRef, where("clienteTelefone", "==", telefone));
        const snapshot = await getDocs(q);
        const agendamentosEncontrados = [];
        snapshot.forEach(docSnapshot => {
            const agendamento = { id: docSnapshot.id, ...docSnapshot.data() };
            if (agendamento.pinHash === pinHash) {
                agendamentosEncontrados.push(agendamento);
            }
        });
        if (agendamentosEncontrados.length === 0) {
            showNotification("Nenhum agendamento encontrado com esses dados.", true);
            return;
        }
        exibirAgendamentosFrontend(agendamentosEncontrados);
        modalVerificarAgendamentos.style.display = 'none';
        inputTelefoneVerificar.value = '';
        inputPinVerificar.value = '';
    } catch (error) {
        console.error("Erro ao verificar agendamentos:", error);
        showNotification("Erro ao verificar agendamentos. Tente novamente.", true);
    }
}

function exibirAgendamentosFrontend(agendamentos) {
    listaMeusAgendamentosEl.innerHTML = '';
    agendamentos.forEach(agendamento => {
        const dataFormatada = agendamento.horario.toDate().toLocaleDateString('pt-BR');
        const horarioFormatado = agendamento.horario.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const agendamentoDiv = document.createElement('div');
        agendamentoDiv.className = 'agendamento-item';
        agendamentoDiv.innerHTML = `
            <div>
                <strong>${agendamento.servicoNome}</strong><br>
                ${dataFormatada}, ${horarioFormatado}
            </div>
            <button class="btn-cancelar" data-agendamento-id="${agendamento.id}" data-pin-hash="${agendamento.pinHash}">
                Cancelar
            </button>
        `;
        listaMeusAgendamentosEl.appendChild(agendamentoDiv);
    });
    listaMeusAgendamentosEl.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('btn-cancelar')) {
            const agendamentoId = event.target.dataset.agendamentoId;
            const pinHashOriginal = event.target.dataset.pinHash;
            cancelarAgendamentoFrontend(agendamentoId, pinHashOriginal);
        }
    });
    agendamentosClienteContainer.style.display = 'block';
}

async function cancelarAgendamentoFrontend(agendamentoId, pinHashOriginal) {
    const pin = prompt("Digite seu PIN para confirmar o cancelamento:");
    if (!pin) return;
    try {
        const pinHash = await gerarHashSHA256(pin);
        if (pinHash !== pinHashOriginal) {
            showNotification("PIN incorreto.", true);
            return;
        }
        const agendamentoRef = doc(db, "users", profissionalUid, "agendamentos", agendamentoId);
        await deleteDoc(agendamentoRef);
        showNotification("Agendamento cancelado com sucesso!");
        const itemParaRemover = listaMeusAgendamentosEl.querySelector(`[data-agendamento-id="${agendamentoId}"]`).closest('.agendamento-item');
        if (itemParaRemover) {
            itemParaRemover.remove();
        }
        if (listaMeusAgendamentosEl.children.length === 0) {
             listaMeusAgendamentosEl.innerHTML = '<p>Nenhum agendamento restante.</p>';
        }
        gerarHorariosDisponiveis();
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        showNotification("Erro ao cancelar agendamento. Tente novamente.", true);
    }
}

function resetarFormulario() {
    servicoSelecionado = null;
    horarioSelecionado = null;
    pinClienteInput.value = '';
    document.querySelectorAll('.btn-servico').forEach(btn => btn.classList.remove('selecionado'));
    document.querySelectorAll('.btn-horario').forEach(btn => btn.classList.remove('selecionado'));
    document.querySelectorAll('.detalhes-servico').forEach(div => div.style.display = 'none');
    verificarEstadoBotaoConfirmar();
}

// Inicializar a vitrine quando a página carregar
document.addEventListener('DOMContentLoaded', inicializarVitrine);
