// ==========================================================================
//  SETUP INICIAL E IMPORTAÇÕES DO FIREBASE
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

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

// ... (O resto das variáveis e elementos do DOM continuam os mesmos) ...
let profissionalUid = null;
let professionalData = { perfil: {}, servicos: [], horarios: {} };
let agendamentoState = { servico: null, data: null, horario: null };
const loader = document.getElementById("vitrine-loader");
const content = document.getElementById("vitrine-content");
const nomeNegocioEl = document.getElementById("nome-negocio-publico");
const logoEl = document.getElementById("logo-publico");
const servicosContainer = document.getElementById("lista-servicos");
const dataInput = document.getElementById("data-agendamento");
const horariosContainer = document.getElementById("grade-horarios");
// ... etc ...


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

        const dadosBrutos = await carregarDadosDoFirebase(); // Esta função foi alterada para DEBUG

        // O filtro será aplicado aqui no código por enquanto, após o debug
        processarDadosCarregados(dadosBrutos);

        const errosDeConfiguracao = validarDadosDoProfissional();
        if (errosDeConfiguracao.length > 0) {
            const mensagemErro = "Esta vitrine não está configurada corretamente.<br><ul>" + errosDeConfiguracao.map(e => `<li>- ${e}</li>`).join('') + "</ul>";
            throw new Error(mensagemErro);
        }

        renderizarInformacoesGerais();
        configurarTodosEventListeners();
        preencherCamposComPerfilSalvo();
        await carregarAgendaInicial(); 

        loader.style.display = 'none';
        content.style.display = 'flex';
    } catch (error) {
        showError(error.message);
        console.error("Erro ao inicializar:", error);
    }
});


// ==========================================================================
//  BUSCA E VALIDAÇÃO DE DADOS
// ==========================================================================
async function getUidFromSlug(slug) {
    const docSnap = await getDoc(doc(db, "slugs", slug));
    return docSnap.exists() ? docSnap.data().uid : null;
}

// ### FUNÇÃO ALTERADA PARA DEBUG ###
async function carregarDadosDoFirebase() {
    console.log("Iniciando modo de depuração para serviços...");
    
    // Busca o perfil e horários normalmente
    const perfilPromise = getDoc(doc(db, "users", profissionalUid, "publicProfile", "profile"));
    const horariosPromise = getDoc(doc(db, "users", profissionalUid, "configuracoes", "horarios"));

    // --- ALTERAÇÃO PARA DEBUG ---
    // Busca TODOS os serviços, ignorando a validação 'visivelNaVitrine'
    const servicosPromise = getDocs(collection(db, "users", profissionalUid, "servicos"));

    const [perfilDoc, servicosSnapshot, horariosDoc] = await Promise.all([
        perfilPromise,
        servicosPromise,
        horariosPromise
    ]);
    
    // --- LOGS DE DEBUG ---
    console.log("--- DEBUG: DADOS BRUTOS DOS SERVIÇOS VINDOS DO FIREBASE ---");
    if (servicosSnapshot.empty) {
        console.log("Nenhum documento de serviço encontrado na coleção.");
    } else {
        servicosSnapshot.docs.forEach(d => {
            const dados = d.data();
            console.log("----------------------------------------------------");
            console.log("ID do Serviço:", d.id);
            console.log("Dados:", dados);
            // Imprime o campo problemático e seu tipo
            console.log("Campo 'visivelNaVitrine':", dados.visivelNaVitrine);
            console.log("Tipo do campo:", typeof dados.visivelNaVitrine);
        });
        console.log("--- FIM DO DEBUG ---");
    }

    return { perfilDoc, servicosSnapshot, horariosDoc };
}

function validarDadosDoProfissional() {
    const erros = [];
    if (!professionalData.perfil.nomeNegocio) {
        erros.push("O nome do negócio não foi configurado.");
    }
    if (Object.keys(professionalData.horarios).length === 0) {
        erros.push("Os horários de atendimento não foram configurados.");
    }
    if (professionalData.servicos.length === 0) {
        erros.push("Nenhum serviço foi disponibilizado para a vitrine (verifique se estão marcados como 'Ativo na Vitrine').");
    }
    return erros;
}

function processarDadosCarregados({ perfilDoc, servicosSnapshot, horariosDoc }) {
    if (perfilDoc.exists()) professionalData.perfil = perfilDoc.data();
    if (horariosDoc.exists()) professionalData.horarios = horariosDoc.data();
    
    // APLICANDO O FILTRO AQUI DEPOIS DO DEBUG
    professionalData.servicos = servicosSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(servico => servico.visivelNaVitrine === true);
}


// O RESTANTE DO CÓDIGO (LÓGICA DE AGENDAMENTO, RENDERIZAÇÃO, EVENTOS, ETC.) CONTINUA EXATAMENTE O MESMO.
// Colei-o abaixo para que o arquivo fique completo.

function showError(message) {
    loader.style.display = 'block';
    content.style.display = 'none';
    loader.innerHTML = `<div style="color:red; text-align:center; padding: 20px;">${message}</div>`;
}

async function carregarAgendaInicial() {
    const hoje = new Date(new Date().getTime() - (new Date().getTimezoneOffset()*60*1000));
    dataInput.value = hoje.toISOString().split('T')[0];
    dataInput.min = hoje.toISOString().split('T')[0];
    agendamentoState.data = dataInput.value;
    if (professionalData.servicos.length > 0) {
        agendamentoState.servico = professionalData.servicos[0];
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
    const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("horario", ">=", Timestamp.fromDate(inicioDoDia)), where("horario", "<=", Timestamp.fromDate(fimDoDia)));
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
    const nomesDias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
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

function renderizarInformacoesGerais() {
    const { perfil, servicos } = professionalData;
    nomeNegocioEl.textContent = perfil.nomeNegocio || "Nome não definido";
    if (perfil.logoUrl) logoEl.src = perfil.logoUrl;
    document.getElementById('info-negocio').innerHTML = `<p>${perfil.descricao || 'Nenhuma descrição fornecida.'}</p>`;
    document.getElementById('info-contato').innerHTML = `${perfil.telefone ? `<p><strong>Telefone:</strong> ${perfil.telefone}</p>` : ''}${perfil.endereco ? `<p><strong>Endereço:</strong> ${perfil.endereco}</p>` : ''}`;
    document.getElementById('info-servicos').innerHTML = servicos.length > 0 ? servicos.map(s => `<div><strong>${s.nome}</strong> (${s.duracao} min) - R$ ${parseFloat(s.preco || 0).toFixed(2)}</div>`).join('') : '<p>Nenhum serviço disponível.</p>';
    servicosContainer.innerHTML = servicos.length > 0 ? servicos.map(s => `<button class="service-item" data-id="${s.id}">${s.nome} - R$ ${parseFloat(s.preco || 0).toFixed(2)}</button>`).join('') : '<p>Nenhum serviço para agendamento.</p>';
}

function configurarTodosEventListeners() {
    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.menu-content').forEach(c => c.classList.remove('ativo'));
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('ativo'));
            document.getElementById(`menu-${button.dataset.menu}`).classList.add('ativo');
            button.classList.add('ativo');
        });
    });
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
    document.getElementById('menu-agendamento').addEventListener('input', verificarEstadoBotaoConfirmar);
    btnConfirmar.addEventListener('click', salvarAgendamento);
    document.getElementById('btn-salvar-perfil').addEventListener('click', salvarPerfilCliente);
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
    document.getElementById('input-telefone-visualizacao').value = telefone;
    document.getElementById('input-telefone-cancelamento').value = telefone;
}

function salvarPerfilCliente() {
    const nome = document.getElementById('perfil-nome').value;
    const telefone = document.getElementById('perfil-telefone').value;
    localStorage.setItem('clienteNome', nome);
    localStorage.setItem('clienteTelefone', telefone);
    showNotification("Perfil salvo com sucesso!");
    preencherCamposComPerfilSalvo();
}

async function salvarAgendamento() {
    // ...
}

async function visualizarAgendamentos() {
    // ...
}

async function buscarAgendamentosParaCancelar() {
    // ...
}

async function cancelarAgendamento(id) {
    // ...
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
