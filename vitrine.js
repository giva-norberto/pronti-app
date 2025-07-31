// ==========================================================================
//  SETUP E IMPORTAÇÕES DO FIREBASE (COM AUTH)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
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
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ==========================================================================
//  VARIÁVEIS GLOBAIS
// ==========================================================================
let profissionalUid = null;
let professionalData = { perfil: {}, servicos: [], horarios: {} };
let agendamentoState = { servico: null, data: null, horario: null };
let currentUser = null;

// ==========================================================================
//  LÓGICA DE AUTENTICAÇÃO
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    atualizarUIparaUsuario(user);
});

async function fazerLogin() {
    try {
        await signInWithPopup(auth, provider);
        showNotification("Login realizado com sucesso!");
    } catch (error) {
        console.error("Erro no login:", error);
        showNotification("Erro ao fazer login.", true);
    }
}

async function fazerLogout() {
    try {
        await signOut(auth);
        showNotification("Você saiu da sua conta.");
    } catch (error) {
        console.error("Erro no logout:", error);
    }
}

function atualizarUIparaUsuario(user) {
    const userInfo = document.getElementById('user-info');
    const btnLogin = document.getElementById('btn-login');
    const agendamentoForm = document.getElementById('agendamento-form-container');
    const agendamentoPrompt = document.getElementById('agendamento-login-prompt');
    const agendamentosPrompt = document.getElementById('agendamentos-login-prompt');
    const agendamentosBotoes = document.getElementById('botoes-agendamento');
    const agendamentosLista = document.getElementById('lista-agendamentos-visualizacao');

    if (user) { // Usuário está LOGADO
        if(userInfo) userInfo.style.display = 'flex';
        if(btnLogin) btnLogin.style.display = 'none';
        if(document.getElementById('user-name')) document.getElementById('user-name').textContent = user.displayName;
        if(document.getElementById('user-photo')) document.getElementById('user-photo').src = user.photoURL;

        if(agendamentoForm) agendamentoForm.style.display = 'block';
        if(agendamentoPrompt) agendamentoPrompt.style.display = 'none';
        if(agendamentosPrompt) agendamentosPrompt.style.display = 'none';
        if(agendamentosBotoes) agendamentosBotoes.style.display = 'flex';
        
        const menuAtivo = document.querySelector('.menu-btn.ativo');
        if (menuAtivo && menuAtivo.dataset.menu === 'visualizacao') {
             buscarEExibirAgendamentos('ativos');
        }
    } else { // Usuário está DESLOGADO
        if(userInfo) userInfo.style.display = 'none';
        if(btnLogin) btnLogin.style.display = 'block';
        if(agendamentoForm) agendamentoForm.style.display = 'none';
        if(agendamentoPrompt) agendamentoPrompt.style.display = 'block';
        if(agendamentosPrompt) agendamentosPrompt.style.display = 'block';
        if(agendamentosBotoes) agendamentosBotoes.style.display = 'none';
        if(agendamentosLista) agendamentosLista.innerHTML = '';
    }
}

// ==========================================================================
//  LÓGICA PRINCIPAL - INICIALIZAÇÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');
        if (!slug) throw new Error("Link inválido.");

        profissionalUid = await getUidFromSlug(slug);
        if (!profissionalUid) throw new Error("Profissional não encontrado.");

        await carregarDadosDoFirebase();
        renderizarInformacoesGerais();
        configurarTodosEventListeners();
        await carregarAgendaInicial(); 

        document.getElementById("vitrine-loader").style.display = 'none';
        document.getElementById("vitrine-content").style.display = 'flex';
    } catch (error) {
        console.error("Erro ao inicializar:", error);
        const loader = document.getElementById("vitrine-loader");
        if(loader) loader.innerHTML = `<p style="color:red">${error.message}</p>`;
    }
});


// ==========================================================================
//  LÓGICA DE "MEUS AGENDAMENTOS"
// ==========================================================================
async function buscarEExibirAgendamentos(modo = 'ativos') {
    if (!currentUser) {
        const agendamentosPrompt = document.getElementById('agendamentos-login-prompt');
        const agendamentosLista = document.getElementById('lista-agendamentos-visualizacao');
        if(agendamentosPrompt) agendamentosPrompt.style.display = 'block';
        if(agendamentosLista) agendamentosLista.innerHTML = '';
        return;
    }

    const listaAgendamentosVisualizacao = document.getElementById('lista-agendamentos-visualizacao');
    listaAgendamentosVisualizacao.innerHTML = '<p>Buscando seus agendamentos...</p>';
    
    try {
        const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("clienteUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listaAgendamentosVisualizacao.innerHTML = '<p>Você ainda não tem agendamentos.</p>';
            return;
        }

        const agora = new Date();
        const todosAgendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const agendamentosFiltrados = (modo === 'ativos')
            ? todosAgendamentos.filter(ag => ag.horario.toDate() >= agora).sort((a, b) => a.horario.toMillis() - b.horario.toMillis())
            : todosAgendamentos.filter(ag => ag.horario.toDate() < agora).sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
        
        renderizarAgendamentosComoCards(agendamentosFiltrados, modo);

    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        listaAgendamentosVisualizacao.innerHTML = '<p>Ocorreu um erro ao buscar os agendamentos.</p>';
    }
}

function renderizarAgendamentosComoCards(agendamentos, modo) {
    const listaAgendamentosVisualizacao = document.getElementById('lista-agendamentos-visualizacao');
    if (agendamentos.length === 0) {
        listaAgendamentosVisualizacao.innerHTML = `<p>${modo === 'ativos' ? 'Nenhum agendamento ativo.' : 'Nenhum histórico.'}</p>`;
        return;
    }
    listaAgendamentosVisualizacao.innerHTML = agendamentos.map(ag => {
        let statusExibido = ag.status;
        if (modo === 'historico' && ag.status === 'agendado') statusExibido = 'Concluído';
        
        return `
            <div class="agendamento-card ${ag.status !== 'agendado' ? 'passado' : ''}">
                <h4>${ag.servicoNome}</h4>
                <p><strong>Data:</strong> ${ag.horario.toDate().toLocaleDateString('pt-BR')}</p>
                <p><strong>Horário:</strong> ${ag.horario.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
                <p><strong>Status:</strong> ${statusExibido}</p>
                ${(ag.status === 'agendado' && modo === 'ativos') ? `<button class="btn-cancelar" data-id="${ag.id}">Cancelar</button>` : ''}
            </div>
        `;
    }).join('');
}


// ==========================================================================
//  SALVAR E CANCELAR AGENDAMENTO
// ==========================================================================
async function salvarAgendamento() {
    if (!currentUser) {
        showNotification("Você precisa estar logado para agendar.", true);
        return;
    }
    const btnConfirmar = document.getElementById('btn-confirmar-agendamento');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Salvando...';

    const [hora, minuto] = agendamentoState.horario.split(':').map(Number);
    const dataAgendamento = new Date(agendamentoState.data + "T00:00:00");
    dataAgendamento.setHours(hora, minuto);

    const dadosAgendamento = {
        clienteUid: currentUser.uid,
        clienteNome: currentUser.displayName,
        clienteEmail: currentUser.email,
        clienteTelefone: document.getElementById('telefone-cliente').value,
        servicoId: agendamentoState.servico.id,
        servicoNome: agendamentoState.servico.nome,
        servicoDuracao: agendamentoState.servico.duracao,
        servicoPreco: agendamentoState.servico.preco,
        horario: Timestamp.fromDate(dataAgendamento),
        status: 'agendado'
    };
    
    try {
        await addDoc(collection(db, "users", profissionalUid, "agendamentos"), dadosAgendamento);
        showNotification("Agendamento realizado com sucesso!");
        setTimeout(() => {
            const btnMenu = document.querySelector('.menu-btn[data-menu="visualizacao"]');
            if (btnMenu) btnMenu.click();
        }, 1500);
    } catch (error) {
        showNotification("Falha ao agendar.", true);
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Agendamento';
    }
}

async function cancelarAgendamento(id) {
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
        try {
            await updateDoc(doc(db, "users", profissionalUid, "agendamentos", id), {
                status: 'cancelado_pelo_cliente'
            });
            showNotification("Agendamento cancelado.");
            buscarEExibirAgendamentos('ativos');
        } catch (error) {
            showNotification("Erro ao cancelar.", true);
        }
    }
}


// ==========================================================================
//  EVENT LISTENERS E FUNÇÕES DE APOIO
// ==========================================================================
function configurarTodosEventListeners() {
    const btnLogin = document.getElementById('btn-login');
    if(btnLogin) btnLogin.addEventListener('click', fazerLogin);
    
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) btnLogout.addEventListener('click', fazerLogout);

    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.menu-content, .menu-btn').forEach(el => el.classList.remove('ativo'));
            const menuContent = document.getElementById(`menu-${button.dataset.menu}`);
            if (menuContent) menuContent.classList.add('ativo');
            button.classList.add('ativo');
            if(button.dataset.menu === 'visualizacao') buscarEExibirAgendamentos('ativos');
        });
    });
    
    const btnVerAtivos = document.getElementById('btn-ver-ativos');
    if(btnVerAtivos) btnVerAtivos.addEventListener('click', () => buscarEExibirAgendamentos('ativos'));
    
    const btnVerHistorico = document.getElementById('btn-ver-historico');
    if(btnVerHistorico) btnVerHistorico.addEventListener('click', () => buscarEExibirAgendamentos('historico'));
    
    const listaAgendamentos = document.getElementById('lista-agendamentos-visualizacao');
    if(listaAgendamentos) listaAgendamentos.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-cancelar')) {
            cancelarAgendamento(e.target.dataset.id);
        }
    });

    const dataInput = document.getElementById('data-agendamento');
    const servicosContainer = document.getElementById('lista-servicos');
    const horariosContainer = document.getElementById('grade-horarios');
    
    if(dataInput) dataInput.addEventListener('change', (e) => { agendamentoState.data = e.target.value; gerarHorariosDisponiveis(); });
    
    if(servicosContainer) servicosContainer.addEventListener('click', (e) => {
        if (e.target.closest('.service-item')) {
            const target = e.target.closest('.service-item');
            agendamentoState.servico = professionalData.servicos.find(s => s.id === target.dataset.id);
            document.querySelectorAll('.service-item.selecionado').forEach(el => el.classList.remove('selecionado'));
            target.classList.add('selecionado');
            gerarHorariosDisponiveis();
        }
    });

    if(horariosContainer) horariosContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-horario')) {
            agendamentoState.horario = e.target.textContent;
            document.querySelectorAll('.btn-horario.selecionado').forEach(el => el.classList.remove('selecionado'));
            e.target.classList.add('selecionado');
            verificarEstadoBotaoConfirmar();
        }
    });

    const formAgendamento = document.getElementById('agendamento-form-container');
    if(formAgendamento) formAgendamento.addEventListener('input', verificarEstadoBotaoConfirmar);
}

async function getUidFromSlug(slug) {
    const docSnap = await getDoc(doc(db, "slugs", slug));
    return docSnap.exists() ? docSnap.data().uid : null;
}

async function carregarDadosDoFirebase() {
    const [perfilDoc, servicosSnapshot, horariosDoc] = await Promise.all([
        getDoc(doc(db, "users", profissionalUid, "publicProfile", "profile")),
        getDocs(query(collection(db, "users", profissionalUid, "servicos"), where("visivelNaVitrine", "==", true))),
        getDoc(doc(db, "users", profissionalUid, "configuracoes", "horarios"))
    ]);
    professionalData.perfil = perfilDoc.exists() ? perfilDoc.data() : {};
    professionalData.horarios = horariosDoc.exists() ? horariosDoc.data() : {};
    professionalData.servicos = servicosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderizarInformacoesGerais() {
    const { perfil, servicos } = professionalData;
    document.getElementById('nome-negocio-publico').textContent = perfil.nomeNegocio || "Nome do Negócio";
    if (perfil.logoUrl) document.getElementById('logo-publico').src = perfil.logoUrl;
    document.getElementById('info-negocio').innerHTML = `<p>${perfil.descricao || ''}</p>`;
    document.getElementById('info-contato').innerHTML = `${perfil.telefone ? `<p><strong>Telefone:</strong> ${perfil.telefone}</p>` : ''}${perfil.endereco ? `<p><strong>Endereço:</strong> ${perfil.endereco}</p>` : ''}`;
    document.getElementById('info-servicos').innerHTML = servicos.map(s => `<div class="servico-info-card"><h4>${s.nome}</h4><p>${s.duracao} min</p><p>R$ ${s.preco}</p></div>`).join('');
    document.getElementById('lista-servicos').innerHTML = servicos.map(s => `<button class="service-item" data-id="${s.id}">${s.nome} - R$ ${s.preco}</button>`).join('');
}

async function carregarAgendaInicial() {
    const dataInput = document.getElementById('data-agendamento');
    const hoje = new Date(new Date().getTime() - (new Date().getTimezoneOffset()*60*1000));
    dataInput.value = hoje.toISOString().split('T')[0];
    dataInput.min = hoje.toISOString().split('T')[0];
    agendamentoState.data = dataInput.value;
    if (professionalData.servicos.length > 0) {
        document.querySelector('.service-item').click();
    }
}

function verificarEstadoBotaoConfirmar() {
    const btnConfirmar = document.getElementById('btn-confirmar-agendamento');
    const { servico, data, horario } = agendamentoState;
    const telefoneCliente = document.getElementById('telefone-cliente');
    const telefoneOK = telefoneCliente && telefoneCliente.value.length > 9;
    if(btnConfirmar) btnConfirmar.disabled = !(servico && data && horario && currentUser && telefoneOK);
}

async function gerarHorariosDisponiveis() { 
    if (!agendamentoState.data || !agendamentoState.servico) return;
    const horariosContainer = document.getElementById('grade-horarios');
    horariosContainer.innerHTML = '<p>Verificando...</p>';
    const agendamentosDoDia = await buscarAgendamentosDoDia(agendamentoState.data);
    const horariosDisponiveis = calcularSlotsDisponiveis(agendamentoState.data, agendamentosDoDia);
    horariosContainer.innerHTML = horariosDisponiveis.length > 0 ? horariosDisponiveis.map(h => `<button class="btn-horario">${h}</button>`).join('') : '<p>Nenhum horário disponível.</p>';
}

async function buscarAgendamentosDoDia(dataString) {
    const inicioDoDia = Timestamp.fromDate(new Date(dataString + 'T00:00:00'));
    const fimDoDia = Timestamp.fromDate(new Date(dataString + 'T23:59:59'));
    const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("horario", ">=", inicioDoDia), where("horario", "<=", fimDoDia));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const ag = doc.data();
        const inicio = ag.horario.toDate();
        const fim = new Date(inicio.getTime() + (ag.servicoDuracao || 30) * 60000);
        return { inicio, fim };
    });
}

function calcularSlotsDisponiveis(data, agendamentosOcupados) {
    const diaSemana = new Date(data + 'T00:00:00').getDay();
    const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
    const configDia = professionalData.horarios[nomeDia];
    if (!configDia || !configDia.ativo) return [];
    const horarios = [];
    const { intervalo = 30 } = professionalData.horarios;
    const duracaoServicoAtual = agendamentoState.servico.duracao;
    (configDia.blocos || []).forEach(bloco => {
        let horarioAtual = new Date(`${data}T${bloco.inicio}`);
        const fimDoBloco = new Date(`${data}T${bloco.fim}`);
        while (horarioAtual < fimDoBloco) {
            const fimDoSlotProposto = new Date(horarioAtual.getTime() + duracaoServicoAtual * 60000);
            if (fimDoSlotProposto > fimDoBloco) break;
            if (!agendamentosOcupados.some(ag => horarioAtual < ag.fim && fimDoSlotProposto > ag.inicio)) {
                horarios.push(horarioAtual.toTimeString().substring(0, 5));
            }
            horarioAtual = new Date(horarioAtual.getTime() + intervalo * 60000);
        }
    });
    return horarios;
}

function showNotification(message, isError = false) {
    const el = document.getElementById("notification-message");
    if (!el) return;
    el.textContent = message;
    el.className = `notification-message ${isError ? 'error' : ''}`;
    el.style.display = "block";
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}
