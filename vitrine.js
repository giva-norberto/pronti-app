// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

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
let menuAtivo = 'informacoes'; // Menu inicial

// Elementos do DOM
const loader = document.getElementById("vitrine-loader");
const content = document.getElementById("vitrine-content");
const nomeNegocioEl = document.getElementById("nome-negocio-publico");
const dataAtualEl = document.getElementById("data-atual");
const logoEl = document.getElementById("logo-publico");
const notificationMessageEl = document.getElementById("notification-message");

// Elementos dos menus
const menuButtons = document.querySelectorAll('.menu-btn');
const menuContents = document.querySelectorAll('.menu-content');

// Elementos do menu de agendamento
const servicosContainer = document.getElementById("lista-servicos");
const dataInput = document.getElementById("data-agendamento");
const horariosContainer = document.getElementById("grade-horarios");
const nomeClienteInput = document.getElementById("nome-cliente");
const telefoneClienteInput = document.getElementById("telefone-cliente");
const pinClienteInput = document.getElementById("pin-cliente");
const btnConfirmar = document.getElementById("btn-confirmar-agendamento");

// Elementos do menu de visualização
const inputTelefoneVisualizacao = document.getElementById("input-telefone-visualizacao");
const btnVisualizarAgendamentos = document.getElementById("btn-visualizar-agendamentos");
const listaAgendamentosVisualizacao = document.getElementById("lista-agendamentos-visualizacao");

// Elementos do menu de cancelamento
const inputTelefoneCancelamento = document.getElementById("input-telefone-cancelamento");
const inputPinCancelamento = document.getElementById("input-pin-cancelamento");
const btnBuscarCancelamento = document.getElementById("btn-buscar-cancelamento");
const listaAgendamentosCancelamento = document.getElementById("lista-agendamentos-cancelamento");

// Elementos do menu de informações
const infoNegocio = document.getElementById("info-negocio");
const infoServicos = document.getElementById("info-servicos");
const infoContato = document.getElementById("info-contato");

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

async function gerarHashSHA256(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

function limparTelefone(telefone) {
    return telefone ? telefone.replace(/\D/g, '') : "";
}

// Função para alternar entre menus
function alternarMenu(novoMenu) {
    // Remove classe ativa de todos os botões
    menuButtons.forEach(btn => btn.classList.remove('ativo'));
    
    // Remove classe ativa de todos os conteúdos
    menuContents.forEach(content => content.classList.remove('ativo'));
    
    // Adiciona classe ativa ao botão e conteúdo selecionados
    document.querySelector(`[data-menu="${novoMenu}"]`).classList.add('ativo');
    document.getElementById(`menu-${novoMenu}`).classList.add('ativo');
    
    menuAtivo = novoMenu;
    
    // Executa ações específicas do menu
    switch(novoMenu) {
        case 'agendamento':
            carregarServicos();
            configurarFormularioAgendamento();
            break;
        case 'visualizacao':
            limparVisualizacao();
            break;
        case 'cancelamento':
            limparCancelamento();
            break;
        case 'informacoes':
            carregarInformacoesCompletas();
            break;
    }
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
            carregarConfiguracoesHorario()
        ]);
        loader.style.display = 'none';
        content.style.display = 'block';
        configurarEventosGerais();
        alternarMenu('informacoes'); // Menu inicial
    } catch (error) {
        console.error("Erro ao inicializar a vitrine:", error);
        loader.innerHTML = `<p style="color:red; text-align:center;">Não foi possível carregar a página deste profissional.</p>`;
    }
}

function configurarEventosGerais() {
    // Configurar eventos dos botões de menu
    menuButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const menu = e.target.dataset.menu;
            alternarMenu(menu);
        });
    });
    
    // Configurar eventos do menu de visualização
    btnVisualizarAgendamentos.addEventListener('click', visualizarAgendamentosSemPIN);
    
    // Configurar eventos do menu de cancelamento
    btnBuscarCancelamento.addEventListener('click', buscarAgendamentosParaCancelamento);
}

function configurarFormularioAgendamento() {
    dataInput.value = new Date().toISOString().split('T')[0];
    dataInput.min = new Date().toISOString().split('T')[0];
    dataInput.addEventListener('change', gerarHorariosDisponiveis);
    nomeClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    telefoneClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    pinClienteInput.addEventListener('input', verificarEstadoBotaoConfirmar);
    btnConfirmar.addEventListener('click', salvarAgendamentoComPIN);
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
    const configPadrao = {
        intervalo: 30,
        dom: { ativo: false, inicio: "09:00", fim: "12:00" },
        seg: { ativo: true, inicio: "09:00", fim: "18:00" },
        ter: { ativo: true, inicio: "09:00", fim: "18:00" },
        qua: { ativo: true, inicio: "09:00", fim: "18:00" },
        qui: { ativo: true, inicio: "09:00", fim: "18:00" },
        sex: { ativo: true, inicio: "09:00", fim: "18:00" },
        sab: { ativo: false, inicio: "09:00", fim: "12:00" }
    };
    if (docSnap.exists()) {
        const dadosDoFirebase = docSnap.data();
        horariosConfig = { ...configPadrao, ...dadosDoFirebase };
        for (const dia of Object.keys(configPadrao)) {
            if (dia !== 'intervalo') {
                horariosConfig[dia] = { ...configPadrao[dia], ...dadosDoFirebase[dia] };
            }
        }
    } else {
        horariosConfig = configPadrao;
    }
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

async function carregarInformacoesCompletas() {
    // Carregar informações do negócio
    const perfilRef = doc(db, "users", profissionalUid, "publicProfile", "profile");
    const perfilSnap = await getDoc(perfilRef);
    
    if (perfilSnap.exists()) {
        const perfil = perfilSnap.data();
        infoNegocio.innerHTML = `
            <h3>${perfil.nomeNegocio || 'Nome não definido'}</h3>
            <p><strong>Descrição:</strong> ${perfil.descricao || 'Não informada'}</p>
            <p><strong>Endereço:</strong> ${perfil.endereco || 'Não informado'}</p>
        `;
        
        if (perfil.telefone || perfil.email || perfil.instagram) {
            infoContato.innerHTML = `
                <h4>Contato</h4>
                ${perfil.telefone ? `<p><strong>Telefone:</strong> ${perfil.telefone}</p>` : ''}
                ${perfil.email ? `<p><strong>Email:</strong> ${perfil.email}</p>` : ''}
                ${perfil.instagram ? `<p><strong>Instagram:</strong> @${perfil.instagram}</p>` : ''}
            `;
        }
    }
    
    // Carregar lista de serviços para informações
    const servicosRef = collection(db, "users", profissionalUid, "servicos");
    const servicosSnap = await getDocs(servicosRef);
    
    let servicosInfo = '<h4>Serviços Oferecidos</h4>';
    servicosSnap.docs.forEach(docSnapshot => {
        const servico = docSnapshot.data();
        if (servico.visivelNaVitrine !== false) {
            servicosInfo += `
                <div class="servico-info">
                    <p><strong>${servico.nome}</strong> - R$ ${parseFloat(servico.preco).toFixed(2)}</p>
                    <p>${servico.descricao || 'Sem descrição'}</p>
                    <p><em>Duração: ${servico.duracao || 'Não informada'} minutos</em></p>
                </div>
            `;
        }
    });
    infoServicos.innerHTML = servicosInfo;
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
        horariosContainer.innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data para ver os horários.</p>';
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
        const inicioDoDia = new Date(data + 'T00:00:00.000Z');
        const fimDoDia = new Date(data + 'T23:59:59.999Z');
        const q = query(
            agendamentosRef,
            where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
            where("horario", "<=", Timestamp.fromDate(fimDoDia))
        );
        const snapshot = await getDocs(q);
        const horariosOcupados = snapshot.docs.map(docSnapshot => {
            const agendamento = docSnapshot.data();
            const dataUtc = agendamento.horario.toDate();
            return `${String(dataUtc.getUTCHours()).padStart(2, '0')}:${String(dataUtc.getUTCMinutes()).padStart(2, '0')}`;
        });
        return horariosOcupados;
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        return [];
    }
}

function gerarListaHorarios(data, agendamentosOcupados) {
    const dataObj = new Date(data + 'T00:00:00Z');
    const diaSemana = dataObj.getUTCDay();
    const nomesDias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const nomeDia = nomesDias[diaSemana];
    const configDia = horariosConfig[nomeDia];
    if (!configDia || !configDia.ativo || !configDia.inicio || !configDia.fim) {
        console.warn(`Configuração de horário para '${nomeDia}' está incompleta ou inativa.`);
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
        const dataAgendamento = new Date(dataInput.value + 'T00:00:00.000Z');
        dataAgendamento.setUTCHours(hora, minuto, 0, 0);
        const agendamento = {
            clienteNome: nomeClienteInput.value.trim(),
            clienteTelefone: telefoneLimpo,
            servicoId: servicoSelecionado.id,
            servicoNome: servicoSelecionado.nome,
            servicoPreco: servicoSelecionado.preco,
            horario: Timestamp.fromDate(dataAgendamento),
            pinHash: pinHash,
            status: 'agendado'
        };
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        await addDoc(agendamentosRef, agendamento);
        
        // Exibir PIN na tela para o cliente
        showNotification(`Agendamento confirmado! Seu PIN para cancelamento é: ${pin}. Anote este número!`);
        
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

// NOVA FUNÇÃO: Visualizar agendamentos SEM PIN
async function visualizarAgendamentosSemPIN() {
    const telefone = limparTelefone(inputTelefoneVisualizacao.value);
    if (!telefone || telefone.length < 10) {
        showNotification("Digite um telefone válido.", true);
        return;
    }
    
    try {
        const agendamentosRef = collection(db, "users", profissionalUid, "agendamentos");
        const q = query(agendamentosRef, where("clienteTelefone", "==", telefone));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            listaAgendamentosVisualizacao.innerHTML = '<p>Nenhum agendamento encontrado para este telefone.</p>';
            return;
        }
        
        const agendamentos = [];
        snapshot.forEach(docSnapshot => {
            const agendamento = { id: docSnapshot.id, ...docSnapshot.data() };
            agendamentos.push(agendamento);
        });
        
        exibirAgendamentosVisualizacao(agendamentos);
        
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        showNotification("Erro ao buscar agendamentos. Tente novamente.", true);
    }
}

function exibirAgendamentosVisualizacao(agendamentos) {
    listaAgendamentosVisualizacao.innerHTML = '';
    
    agendamentos.forEach(agendamento => {
        let dataFormatada = "Data inválida";
        if(agendamento.horario && typeof agendamento.horario.toDate === 'function') {
            const data = agendamento.horario.toDate();
            dataFormatada = data.toLocaleDateString('pt-BR', {timeZone: 'UTC'}) + ', ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        }
        
        const statusTexto = agendamento.status === 'agendado' ? 'Confirmado' : 
                           agendamento.status === 'cancelamento_solicitado' ? 'Cancelamento Solicitado' : 
                           agendamento.status;
        
        const agendamentoDiv = document.createElement('div');
        agendamentoDiv.className = 'agendamento-item-visualizacao';
        agendamentoDiv.innerHTML = `
            <div class="agendamento-info">
                <h4>${agendamento.servicoNome}</h4>
                <p><strong>Data e Hora:</strong> ${dataFormatada}</p>
                <p><strong>Cliente:</strong> ${agendamento.clienteNome}</p>
                <p><strong>Preço:</strong> R$ ${parseFloat(agendamento.servicoPreco).toFixed(2)}</p>
                <p><strong>Status:</strong> ${statusTexto}</p>
            </div>
        `;
        listaAgendamentosVisualizacao.appendChild(agendamentoDiv);
    });
}

// NOVA FUNÇÃO: Buscar agendamentos para cancelamento (COM PIN)
async function buscarAgendamentosParaCancelamento() {
    const telefone = limparTelefone(inputTelefoneCancelamento.value);
    const pin = inputPinCancelamento.value.trim();
    
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
            if (agendamento.pinHash === pinHash && agendamento.status === 'agendado') {
                agendamentosEncontrados.push(agendamento);
            }
        });
        
        if (agendamentosEncontrados.length === 0) {
            showNotification("Nenhum agendamento encontrado com esses dados ou PIN incorreto.", true);
            listaAgendamentosCancelamento.innerHTML = '';
            return;
        }
        
        exibirAgendamentosCancelamento(agendamentosEncontrados);
        
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        showNotification("Erro ao buscar agendamentos. Tente novamente.", true);
    }
}

function exibirAgendamentosCancelamento(agendamentos) {
    listaAgendamentosCancelamento.innerHTML = '';
    
    agendamentos.forEach(agendamento => {
        let dataFormatada = "Data inválida";
        if(agendamento.horario && typeof agendamento.horario.toDate === 'function') {
            const data = agendamento.horario.toDate();
            dataFormatada = data.toLocaleDateString('pt-BR', {timeZone: 'UTC'}) + ', ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        }
        
        const agendamentoDiv = document.createElement('div');
        agendamentoDiv.className = 'agendamento-item-cancelamento';
        agendamentoDiv.innerHTML = `
            <div class="agendamento-info">
                <h4>${agendamento.servicoNome}</h4>
                <p><strong>Data e Hora:</strong> ${dataFormatada}</p>
                <p><strong>Cliente:</strong> ${agendamento.clienteNome}</p>
                <p><strong>Preço:</strong> R$ ${parseFloat(agendamento.servicoPreco).toFixed(2)}</p>
            </div>
            <button class="btn-cancelar-agendamento" data-agendamento-id="${agendamento.id}">
                Cancelar Agendamento
            </button>
        `;
        listaAgendamentosCancelamento.appendChild(agendamentoDiv);
    });
    
    // Adicionar eventos aos botões de cancelamento
    listaAgendamentosCancelamento.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('btn-cancelar-agendamento')) {
            const agendamentoId = event.target.dataset.agendamentoId;
            cancelarAgendamento(agendamentoId);
        }
    });
}

async function cancelarAgendamento(agendamentoId) {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) {
        return;
    }
    
    try {
        const agendamentoRef = doc(db, "users", profissionalUid, "agendamentos", agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelamento_solicitado',
            canceladoEm: Timestamp.now(),
            canceladoPor: 'Cliente'
        });

        showNotification("Solicitação de cancelamento enviada com sucesso!");
        
        // Remover o item da lista
        const itemParaRemover = listaAgendamentosCancelamento.querySelector(`[data-agendamento-id="${agendamentoId}"]`).closest('.agendamento-item-cancelamento');
        if (itemParaRemover) {
            itemParaRemover.remove();
        }
        
        if (listaAgendamentosCancelamento.children.length === 0) {
            listaAgendamentosCancelamento.innerHTML = '<p>Nenhum agendamento disponível para cancelamento.</p>';
        }
        
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        showNotification("Erro ao cancelar agendamento. Tente novamente.", true);
    }
}

function limparVisualizacao() {
    inputTelefoneVisualizacao.value = '';
    listaAgendamentosVisualizacao.innerHTML = '';
}

function limparCancelamento() {
    inputTelefoneCancelamento.value = '';
    inputPinCancelamento.value = '';
    listaAgendamentosCancelamento.innerHTML = '';
}

function resetarFormulario() {
    servicoSelecionado = null;
    horarioSelecionado = null;
    nomeClienteInput.value = '';
    telefoneClienteInput.value = '';
    pinClienteInput.value = '';
    document.querySelectorAll('.btn-servico').forEach(btn => btn.classList.remove('selecionado'));
    document.querySelectorAll('.btn-horario').forEach(btn => btn.classList.remove('selecionado'));
    document.querySelectorAll('.detalhes-servico').forEach(div => div.style.display = 'none');
    verificarEstadoBotaoConfirmar();
}

document.addEventListener('DOMContentLoaded', inicializarVitrine);
