// ==========================================================================
//  SETUP INICIAL E IMPORTAÇÕES DO FIREBASE
// ==========================================================================

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

const app = initializeApp(firebaseConfig );
const db = getFirestore(app);

// ==========================================================================
//  VARIÁVEIS GLOBAIS E SELEÇÃO DE ELEMENTOS DO DOM
// ==========================================================================

let profissionalUid = null;
let servicoSelecionado = null;
let horarioSelecionado = null;
let horariosConfig = {};
let menuAtivo = 'informacoes'; // Menu inicial (para o conteúdo principal)

// --- Elementos Globais ---
const loader = document.getElementById("vitrine-loader");
const content = document.getElementById("vitrine-content");
const nomeNegocioEl = document.getElementById("nome-negocio-publico");
const dataAtualEl = document.getElementById("data-atual");
const logoEl = document.getElementById("logo-publico");
const notificationMessageEl = document.getElementById("notification-message");

// --- Elementos do Menu de Conteúdo (Abas) ---
const menuButtons = document.querySelectorAll('.menu-btn');
const menuContents = document.querySelectorAll('.menu-content');

// --- Elementos do Formulário de Agendamento ---
const servicosContainer = document.getElementById("lista-servicos");
const dataInput = document.getElementById("data-agendamento");
const horariosContainer = document.getElementById("grade-horarios");
const nomeClienteInput = document.getElementById("nome-cliente");
const telefoneClienteInput = document.getElementById("telefone-cliente");
const pinClienteInput = document.getElementById("pin-cliente");
const btnConfirmar = document.getElementById("btn-confirmar-agendamento");

// --- Elementos da Aba de Visualização ---
const inputTelefoneVisualizacao = document.getElementById("input-telefone-visualizacao");
const btnVisualizarAgendamentos = document.getElementById("btn-visualizar-agendamentos");
const listaAgendamentosVisualizacao = document.getElementById("lista-agendamentos-visualizacao");

// --- Elementos da Aba de Cancelamento ---
const inputTelefoneCancelamento = document.getElementById("input-telefone-cancelamento");
const inputPinCancelamento = document.getElementById("input-pin-cancelamento");
const btnBuscarCancelamento = document.getElementById("btn-buscar-cancelamento");
const listaAgendamentosCancelamento = document.getElementById("lista-agendamentos-cancelamento");

// --- Elementos da Aba de Informações ---
const infoNegocio = document.getElementById("info-negocio");
const infoServicos = document.getElementById("info-servicos");
const infoContato = document.getElementById("info-contato");


// ==========================================================================
//  FUNÇÕES UTILITÁRIAS (Notificação, Hash, Validação, etc.)
// ==========================================================================

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

// ==========================================================================
//  LÓGICA PRINCIPAL DA APLICAÇÃO
// ==========================================================================

// --- Função para alternar entre as ABAS de conteúdo ---
function alternarMenu(novoMenu) {
    menuButtons.forEach(btn => btn.classList.remove('ativo'));
    menuContents.forEach(content => content.classList.remove('ativo'));
    
    const newActiveButton = document.querySelector(`[data-menu="${novoMenu}"]`);
    const newActiveContent = document.getElementById(`menu-${novoMenu}`);

    if (newActiveButton) newActiveButton.
            horaAtual += Math.floor(minutoAtual / 60);
            minutoAtual = minutoAtual % 60;
        }
    }
    return horarios;
}

function exibirHorarios(horarios) {
    if (!horariosContainer) return;
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
    if (!btnConfirmar) return;
    const nomePreenchido = nomeClienteInput && nomeClienteInput.value.trim().length > 0;
    const telefonePreenchido = telefoneClienteInput && limparTelefone(telefoneClienteInput.value).length >= 10;
    const pinPreenchido = pinClienteInput && pinClienteInput.value.trim().length >= 4;
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
        
        showNotification(`Agendamento confirmado! Seu PIN para cancelamento é: ${pin}. Anote este número!`);
        
        resetarFormulario();
        gerarHorariosDisponiveis();
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        showNotification("Erro ao salvar agendamento. Tente novamente.", true);
    } finally {
        if(btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Confirmar Agendamento';
        }
    }
}

// --- Funções da Aba de Visualização ---

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
            if(listaAgendamentosVisualizacao) listaAgendamentosVisualizacao.innerHTML = '<p>Nenhum agendamento encontrado para este telefone.</p>';
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
    if (!listaAgendamentosVisualizacao) return;
    listaAgendamentosVisualizacao.innerHTML = '';
    
    agendamentos.sort((a, b) => a.horario.toMillis() - b.horario.toMillis()).forEach(agendamento => {
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

// --- Funções da Aba de Cancelamento ---

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
            if(listaAgendamentosCancelamento) listaAgendamentosCancelamento.innerHTML = '';
            return;
        }
        
        exibirAgendamentosCancelamento(agendamentosEncontrados);
        
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        showNotification("Erro ao buscar agendamentos. Tente novamente.", true);
    }
}

function exibirAgendamentosCancelamento(agendamentos) {
    if (!listaAgendamentosCancelamento) return;
    listaAgendamentosCancelamento.innerHTML = '';
    
    agendamentos.sort((a, b) => a.horario.toMillis() - b.horario.toMillis()).forEach(agendamento => {
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
    
    const cancelButtons = listaAgendamentosCancelamento.querySelectorAll('.btn-cancelar-agendamento');
    cancelButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            const agendamentoId = event.currentTarget.dataset.agendamentoId;
            cancelarAgendamento(agendamentoId);
        });
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
        
        const itemParaRemover = listaAgendamentosCancelamento.querySelector(`button[data-agendamento-id="${agendamentoId}"]`).closest('.agendamento-item-cancelamento');
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

// --- Funções de Limpeza e Reset ---

function limparVisualizacao() {
    if(inputTelefoneVisualizacao) inputTelefoneVisualizacao.value = '';
    if(listaAgendamentosVisualizacao) listaAgendamentosVisualizacao.innerHTML = '';
}

function limparCancelamento() {
    if(inputTelefoneCancelamento) inputTelefoneCancelamento.value = '';
    if(inputPinCancelamento) inputPinCancelamento.value = '';
    if(listaAgendamentosCancelamento) listaAgendamentosCancelamento.innerHTML = '';
}

function resetarFormulario() {
    servicoSelecionado = null;
    horarioSelecionado = null;
    if(nomeClienteInput) nomeClienteInput.value = '';
    if(telefoneClienteInput) telefoneClienteInput.value = '';
    if(pinClienteInput) pinClienteInput.value = '';
    document.querySelectorAll('.btn-servico').forEach(btn => btn.classList.remove('selecionado'));
    document.querySelectorAll('.btn-horario').forEach(btn => btn.classList.remove('selecionado'));
    document.querySelectorAll('.detalhes-servico').forEach(div => div.style.display = 'none');
    verificarEstadoBotaoConfirmar();
}

// ==========================================================================
//  PONTO DE ENTRADA DA APLICAÇÃO E LÓGICA DO MENU DE NAVEGAÇÃO
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DO MENU DE NAVEGAÇÃO SUPERIOR (NAVBAR) ---
    const menuIcon = document.getElementById('mobile-menu-trigger');
    const navMenu = document.getElementById('nav-menu-list');
    const navLinks = document.querySelectorAll('.nav-links');

    if (menuIcon && navMenu) {
        const toggleMobileMenu = () => {
            menuIcon.classList.toggle('is-active');
            navMenu.classList.toggle('active');
        };
        menuIcon.addEventListener('click', toggleMobileMenu);

        const closeMobileMenu = () => {
            if (window.innerWidth <= 960 && menuIcon.classList.contains('is-active')) {
                toggleMobileMenu();
            }
        };
        navLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
    }
    
    // --- INICIALIZAÇÃO DA VITRINE ---
    inicializarVitrine();
});
