   // ==========================================================================
//  SETUP INICIAL E IMPORTAÇÕES DO FIREBASE
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

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

// ==========================================================================
//  VARIÁVEIS GLOBAIS E SELEÇÃO DE ELEMENTOS DO DOM
// ==========================================================================
let profissionalUid = null;
let professionalData = { perfil: {}, servicos: [], horarios: {} };
let agendamentoState = { servico: null, data: null, horario: null };

// --- Elementos Globais ---
const loader = document.getElementById("vitrine-loader");
const content = document.getElementById("vitrine-content");
const nomeNegocioEl = document.getElementById("nome-negocio-publico");
const logoEl = document.getElementById("logo-publico");
const servicosContainer = document.getElementById("lista-servicos");
const dataInput = document.getElementById("data-agendamento");
const horariosContainer = document.getElementById("grade-horarios");
const nomeClienteInput = document.getElementById("nome-cliente");
const telefoneClienteInput = document.getElementById("telefone-cliente");
const pinClienteInput = document.getElementById("pin-cliente");
const btnConfirmar = document.getElementById("btn-confirmar-agendamento");
const notificationMessageEl = document.getElementById("notification-message");

// ==========================================================================
//  LÓGICA PRINCIPAL - INICIALIZAÇÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        showError("Link inválido. O profissional não foi especificado.");
        return;
    }

    try {
        profissionalUid = await getUidFromSlug(slug);
        if (!profissionalUid) {
            showError("Profissional não encontrado. Verifique o link.");
            return;
        }

        await carregarDadosDoFirebase();
        renderizarInformacoesGerais();
        configurarTodosEventListeners();
        preencherCamposComPerfilSalvo();
        
        // <<< ALTERAÇÃO SOLICITADA: Carrega a agenda inicial aqui >>>
        await carregarAgendaInicial(); 

        loader.style.display = 'none';
        content.style.display = 'flex';
    } catch (error) {
        console.error("Erro fatal ao inicializar a vitrine:", error);
        showError("Não foi possível carregar a página deste profissional.");
    }
});

function showError(message) {
    loader.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">${message}</p>`;
}

// ==========================================================================
//  BUSCA DE DADOS NO FIREBASE
// ==========================================================================
async function getUidFromSlug(slug) {
    const slugRef = doc(db, "slugs", slug);
    const docSnap = await getDoc(slugRef);
    return docSnap.exists() ? docSnap.data().uid : null;
}

async function carregarDadosDoFirebase() {
    const [perfilDoc, servicosSnapshot, horariosDoc] = await Promise.all([
        getDoc(doc(db, "users", profissionalUid, "publicProfile", "profile")),
        getDocs(query(collection(db, "users", profissionalUid, "servicos"), where("visivelNaVitrine", "==", true))),
        getDoc(doc(db, "users", profissionalUid, "configuracoes", "horarios"))
    ]);

    if (perfilDoc.exists()) professionalData.perfil = perfilDoc.data();
    if (horariosDoc.exists()) professionalData.horarios = horariosDoc.data();
    professionalData.servicos = servicosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ==========================================================================
//  RENDERIZAÇÃO E MANIPULAÇÃO DO DOM
// ==========================================================================
function renderizarInformacoesGerais() {
    const { perfil, servicos } = professionalData;
    
    nomeNegocioEl.textContent = perfil.nomeNegocio || "Nome não definido";
    if (perfil.logoUrl) logoEl.src = perfil.logoUrl;
    
    document.getElementById('info-negocio').innerHTML = `<p>${perfil.descricao || 'Nenhuma descrição fornecida.'}</p>`;
    document.getElementById('info-contato').innerHTML = `
        ${perfil.telefone ? `<p><strong>Telefone:</strong> ${perfil.telefone}</p>` : ''}
        ${perfil.endereco ? `<p><strong>Endereço:</strong> ${perfil.endereco}</p>` : ''}
    `;
    document.getElementById('info-servicos').innerHTML = servicos.length > 0
        ? servicos.map(s => `<div><strong>${s.nome}</strong> (${s.duracao} min) - R$ ${parseFloat(s.preco || 0).toFixed(2)}</div>`).join('')
        : '<p>Nenhum serviço disponível no momento.</p>';
    
    servicosContainer.innerHTML = servicos.length > 0
        ? servicos.map(s => `<button class="service-item" data-id="${s.id}">${s.nome} - R$ ${parseFloat(s.preco || 0).toFixed(2)}</button>`).join('')
        : '<p>Nenhum serviço para agendamento no momento.</p>';
}

// ==========================================================================
//  LÓGICA DE AGENDAMENTO
// ==========================================================================

// --- FUNÇÃO ADICIONADA PARA CARREGAR A AGENDA INICIALMENTE ---
async function carregarAgendaInicial() {
    const hoje = new Date();
    const offset = hoje.getTimezoneOffset();
    const hojeLocal = new Date(hoje.getTime() - (offset*60*1000));
    dataInput.value = hojeLocal.toISOString().split('T')[0];
    dataInput.min = hojeLocal.toISOString().split('T')[0];
    agendamentoState.data = dataInput.value;

    if (professionalData.servicos.length > 0) {
        const primeiroServico = professionalData.servicos[0];
        agendamentoState.servico = primeiroServico;

        const primeiroBotaoServico = servicosContainer.querySelector('.service-item');
        if (primeiroBotaoServico) {
            primeiroBotaoServico.classList.add('selecionado');
        }
        
        await gerarHorariosDisponiveis();
    }
}

async function gerarHorariosDisponiveis() {
    if (!agendamentoState.data || !agendamentoState.servico) {
        horariosContainer.innerHTML = '<p class="aviso-horarios">Selecione um serviço e uma data.</p>';
        return;
    }
    horariosContainer.innerHTML = '<p class="aviso-horarios">Verificando horários...</p>';
    
    try {
        const agendamentosDoDia = await buscarAgendamentosDoDia(agendamentoState.data);
        const horariosDisponiveis = calcularSlotsDisponiveis(agendamentoState.data, agendamentosDoDia);
        
        horariosContainer.innerHTML = horariosDisponiveis.length > 0
            ? horariosDisponiveis.map(h => `<button class="btn-horario">${h}</button>`).join('')
            : '<p class="aviso-horarios">Nenhum horário disponível para este dia.</p>';

    } catch (error) {
        console.error('Erro ao gerar horários:', error);
        horariosContainer.innerHTML = '<p class="aviso-horarios">Erro ao carregar horários.</p>';
    }
}

async function buscarAgendamentosDoDia(dataString) {
    const inicioDoDia = new Date(dataString + 'T00:00:00');
    const fimDoDia = new Date(dataString + 'T23:59:59');
    
    const q = query(
        collection(db, "users", profissionalUid, "agendamentos"),
        where("horario", ">=", Timestamp.fromDate(inicioDoDia)),
        where("horario", "<=", Timestamp.fromDate(fimDoDia))
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const agendamento = doc.data();
        const inicio = agendamento.horario.toDate();
        const duracao = agendamento.servicoDuracao || 30;
        const fim = new Date(inicio.getTime() + duracao * 60000);
        return { inicio, fim };
    });
}

function calcularSlotsDisponiveis(data, agendamentosOcupados) {
    const dataObj = new Date(data + 'T00:00:00');
    const diaSemana = dataObj.getDay();
    const nomesDias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const nomeDia = nomesDias[diaSemana];
    const configDia = professionalData.horarios[nomeDia];

    if (!configDia || !configDia.ativo) return [];

    const horarios = [];
    const intervalo = professionalData.horarios.intervalo || 30;
    const duracaoServicoAtual = agendamentoState.servico.duracao;
    const blocosDeTrabalho = configDia.blocos || [];

    blocosDeTrabalho.forEach(bloco => {
        if (!bloco.inicio || !bloco.fim) return;
        let horarioAtual = new Date(`${data}T${bloco.inicio}`);
        const fimDoBloco = new Date(`${data}T${bloco.fim}`);
        
        while (horarioAtual < fimDoBloco) {
            const fimDoSlotProposto = new Date(horarioAtual.getTime() + duracaoServicoAtual * 60000);
            if (fimDoSlotProposto > fimDoBloco) break;

            const temColisao = agendamentosOcupados.some(ag => (horarioAtual < ag.fim && fimDoSlotProposto > ag.inicio));

            if (!temColisao) {
                horarios.push(horarioAtual.toTimeString().substring(0, 5));
            }
            horarioAtual = new Date(horarioAtual.getTime() + intervalo * 60000);
        }
    });
    return horarios;
}
    
// ==========================================================================
//  EVENT LISTENERS E FUNÇÕES DE INTERAÇÃO
// ==========================================================================
function configurarTodosEventListeners() {
    // Navegação do menu lateral
    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.menu-content').forEach(c => c.classList.remove('ativo'));
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('ativo'));
            document.getElementById(`menu-${button.dataset.menu}`).classList.add('ativo');
            button.classList.add('ativo');
        });
    });

    // Dropdown "Primeiro Acesso"
    const dropdownToggle = document.getElementById('btn-primeiro-acesso');
    const dropdownMenu = document.getElementById('primeiro-acesso-menu');
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu.classList.toggle('ativo');
        });
        document.addEventListener('click', () => {
            if (dropdownMenu.classList.contains('ativo')) {
                dropdownMenu.classList.remove('ativo');
            }
        });
    }

    // Ações do formulário de agendamento
    dataInput.addEventListener('change', (e) => {
        agendamentoState.data = e.target.value;
        gerarHorariosDisponiveis();
    });
    servicosContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('service-item')) {
            const servicoId = e.target.dataset.id;
            agendamentoState.servico = professionalData.servicos.find(s => s.id === servicoId);
            document.querySelectorAll('.service-item.selecionado').forEach(el => el.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            gerarHorariosDisponiveis();
        }
    });
    horariosContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            agendamentoState.horario = e.target.textContent;
            document.querySelectorAll('.btn-horario.selecionado').forEach(el => el.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
        }
    });
    
    // Listener para habilitar/desabilitar botão de confirmar
    document.getElementById('menu-agendamento').addEventListener('input', verificarEstadoBotaoConfirmar);
    
    btnConfirmar.addEventListener('click', salvarAgendamento);
    document.getElementById('btn-salvar-perfil').addEventListener('click', salvarPerfilCliente);
    
    // Listeners das abas de visualização e cancelamento
    document.getElementById('btn-visualizar-agendamentos').addEventListener('click', visualizarAgendamentos);
    document.getElementById('btn-buscar-cancelamento').addEventListener('click', buscarAgendamentosParaCancelar);
}

function verificarEstadoBotaoConfirmar() {
    const { servico, data, horario } = agendamentoState;
    const nomeOK = nomeClienteInput.value.trim() !== '';
    const telOK = telefoneClienteInput.value.replace(/\D/g, '').length >= 10;
    const pinOK = pinClienteInput.value.length >= 4;
    btnConfirmar.disabled = !(servico && data && horario && nomeOK && telOK && pinOK);
}

function preencherCamposComPerfilSalvo() {
    const nome = localStorage.getItem('clienteNome') || '';
    const telefone = localStorage.getItem('clienteTelefone') || '';
    document.getElementById('perfil-nome').value = nome;
    document.getElementById('perfil-telefone').value = telefone;
    if (!nomeClienteInput.value) nomeClienteInput.value = nome;
    if (!telefoneClienteInput.value) telefoneClienteInput.value = telefone;
    if (!document.getElementById('input-telefone-visualizacao').value) document.getElementById('input-telefone-visualizacao').value = telefone;
    if (!document.getElementById('input-telefone-cancelamento').value) document.getElementById('input-telefone-cancelamento').value = telefone;
}

function salvarPerfilCliente() {
    const nome = document.getElementById('perfil-nome').value;
    const telefone = document.getElementById('perfil-telefone').value;
    localStorage.setItem('clienteNome', nome);
    localStorage.setItem('clienteTelefone', telefone);
    showNotification("Perfil salvo com sucesso!");
    preencherCamposComPerfilSalvo(); // Atualiza os outros campos
}

async function salvarAgendamento() {
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Salvando...';
    
    try {
        const [hora, minuto] = agendamentoState.horario.split(':').map(Number);
        const dataAgendamento = new Date(agendamentoState.data + "T00:00:00");
        dataAgendamento.setHours(hora, minuto);

        const dadosAgendamento = {
            clienteNome: nomeClienteInput.value.trim(),
            clienteTelefone: telefoneClienteInput.value.replace(/\D/g, ''),
            pinHash: await gerarHashSHA256(pinClienteInput.value),
            servicoId: agendamentoState.servico.id,
            servicoNome: agendamentoState.servico.nome,
            servicoDuracao: agendamentoState.servico.duracao,
            servicoPreco: agendamentoState.servico.preco,
            horario: Timestamp.fromDate(dataAgendamento),
            status: 'agendado'
        };

        await addDoc(collection(db, "users", profissionalUid, "agendamentos"), dadosAgendamento);
        showNotification("Agendamento realizado com sucesso!");
        
        setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
        showNotification("Falha ao agendar. Tente novamente.", true);
        console.error("Erro ao salvar agendamento:", error);
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Agendamento';
    }
}

// ... (Funções de visualização e cancelamento podem ser adicionadas aqui, se necessário) ...
async function visualizarAgendamentos() {
    const telefone = document.getElementById('input-telefone-visualizacao').value.replace(/\D/g, '');
    const output = document.getElementById('lista-agendamentos-visualizacao');
    if (!telefone) { showNotification("Digite um telefone.", true); return; }
    
    output.innerHTML = '<p>Buscando...</p>';
    const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("clienteTelefone", "==", telefone), where("status", "==", "agendado"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        output.innerHTML = '<p>Nenhum agendamento ativo encontrado.</p>';
    } else {
        output.innerHTML = snapshot.docs.map(doc => {
            const ag = doc.data();
            return `<div><h4>${ag.servicoNome}</h4><p>Data: ${ag.horario.toDate().toLocaleString('pt-BR')}</p></div>`;
        }).join('');
    }
}

async function buscarAgendamentosParaCancelar() {
     const telefone = document.getElementById('input-telefone-cancelamento').value.replace(/\D/g, '');
     const pin = document.getElementById('input-pin-cancelamento').value;
     const output = document.getElementById('lista-agendamentos-cancelamento');
     if (!telefone || !pin) { showNotification("Preencha telefone e PIN.", true); return; }

     output.innerHTML = '<p>Buscando...</p>';
     const pinHash = await gerarHashSHA256(pin);
     const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("clienteTelefone", "==", telefone), where("pinHash", "==", pinHash), where("status", "==", "agendado"));
     const snapshot = await getDocs(q);

    if (snapshot.empty) {
        output.innerHTML = '<p>Nenhum agendamento encontrado com estes dados.</p>';
    } else {
        output.innerHTML = snapshot.docs.map(doc => `
            <div>
                <h4>${doc.data().servicoNome}</h4>
                <p>Data: ${doc.data().horario.toDate().toLocaleString('pt-BR')}</p>
                <button class="btn-cancelar" data-id="${doc.id}">Cancelar Agendamento</button>
            </div>
        `).join('');
        
        output.querySelectorAll('.btn-cancelar').forEach(btn => {
            btn.addEventListener('click', (e) => cancelarAgendamento(e.target.dataset.id));
        });
    }
}

async function cancelarAgendamento(id) {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    try {
        const agendamentoRef = doc(db, "users", profissionalUid, "agendamentos", id);
        await updateDoc(agendamentoRef, { status: 'cancelado_pelo_cliente' });
        showNotification("Agendamento cancelado com sucesso!");
        buscarAgendamentosParaCancelar();
    } catch(error) {
        showNotification("Erro ao cancelar.", true);
        console.error(error);
    }
}


function showNotification(message, isError = false) {
    if (!notificationMessageEl) return;
    notificationMessageEl.textContent = message;
    notificationMessageEl.className = `notification-message ${isError ? 'error' : ''}`;
    notificationMessageEl.style.display = "block";
    notificationMessageEl.style.opacity = "1";
    setTimeout(() => {
        notificationMessageEl.style.opacity = "0";
        setTimeout(() => { notificationMessageEl.style.display = "none"; }, 500);
    }, 3500);
}
