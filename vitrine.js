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

// ==========================================================================
//  VARIÁVEIS GLOBAIS E ESTADO DA APLICAÇÃO
// ==========================================================================
let profissionalUid = null;
let professionalData = { perfil: {}, servicos: [], horarios: {} };
let agendamentoState = { servico: null, data: null, horario: null };

// --- Cache de Elementos do DOM ---
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
const inputTelefoneVisualizacao = document.getElementById("input-telefone-visualizacao");
const btnVisualizarAgendamentos = document.getElementById("btn-visualizar-agendamentos");
const btnVerHistorico = document.getElementById("btn-ver-historico");
const listaAgendamentosVisualizacao = document.getElementById("lista-agendamentos-visualizacao");
const btnBuscarCancelamento = document.getElementById("btn-buscar-cancelamento");
const containerBuscaManual = document.getElementById("container-busca-manual-view"); 
const containerFiltros = document.getElementById("botoes-agendamento");


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

        const dadosBrutos = await carregarDadosDoFirebase();
        processarDadosCarregados(dadosBrutos);

        const errosDeConfiguracao = validarDadosDoProfissional();
        if (errosDeConfiguracao.length > 0) {
            const msgErro = "Esta vitrine não está configurada corretamente.<br><ul>" + errosDeConfiguracao.map(e => `<li>- ${e}</li>`).join('') + "</ul>";
            throw new Error(msgErro);
        }

        renderizarInformacoesGerais();
        configurarTodosEventListeners();
        preencherCamposComPerfilSalvo();
        await carregarAgendaInicial(); 

        loader.style.display = 'none';
        content.style.display = 'flex';
    } catch (error) {
        console.error("Erro ao inicializar:", error);
        showError(error.message);
    }
});


// ==========================================================================
//  LÓGICA DE "MEUS AGENDAMENTOS"
// ==========================================================================
function iniciarAbaMeusAgendamentos() {
    const telefoneSalvo = localStorage.getItem('clienteTelefone');
    
    // Assegura que os elementos corretos são mostrados/escondidos
    const buscaManualContainer = document.getElementById('container-busca-manual-view'); 
    const filtrosContainer = document.getElementById('botoes-agendamento'); 
    
    if (telefoneSalvo) {
        if(buscaManualContainer) buscaManualContainer.style.display = 'none';
        if(filtrosContainer) filtrosContainer.style.display = 'flex';
        inputTelefoneVisualizacao.value = telefoneSalvo;
        buscarEExibirAgendamentos('ativos');
    } else {
        if(buscaManualContainer) buscaManualContainer.style.display = 'block';
        if(filtrosContainer) filtrosContainer.style.display = 'flex'; // Mantém botões visíveis
        listaAgendamentosVisualizacao.innerHTML = '<p>Salve seu telefone na aba "Perfil" para carregar seus agendamentos automaticamente.</p>';
    }
}

async function buscarEExibirAgendamentos(modo = 'ativos') {
    const telefone = inputTelefoneVisualizacao.value.replace(/\D/g, '');
    if (!telefone) {
        showNotification("Seu telefone não está preenchido. Salve-o na aba 'Perfil'.", true);
        return;
    }
    
    listaAgendamentosVisualizacao.innerHTML = '<p>Buscando seus agendamentos...</p>';
    if (containerBuscaManual && containerFiltros) {
        containerBuscaManual.style.display = 'none';
        containerFiltros.style.display = 'flex';
    }

    try {
        const q = query(collection(db, "users", profissionalUid, "agendamentos"), where("clienteTelefone", "==", telefone));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listaAgendamentosVisualizacao.innerHTML = '<p>Nenhum agendamento encontrado para este telefone.</p>';
            return;
        }

        const agora = new Date();
        const todosAgendamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const agendamentosFiltrados = (modo === 'ativos')
            ? todosAgendamentos
                .filter(ag => ag.horario && typeof ag.horario.toDate === 'function' && ag.horario.toDate() >= agora && ag.status === 'agendado')
                .sort((a, b) => a.horario.toMillis() - b.horario.toMillis())
            : todosAgendamentos
                .filter(ag => ag.horario && typeof ag.horario.toDate === 'function' && ag.horario.toDate() < agora)
                .sort((a, b) => b.horario.toMillis() - a.horario.toMillis());
        
        renderizarAgendamentosComoCards(agendamentosFiltrados, modo);

    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        listaAgendamentosVisualizacao.innerHTML = '<p>Ocorreu um erro ao buscar os agendamentos.</p>';
    }
}

function renderizarAgendamentosComoCards(agendamentos, modo) {
    if (agendamentos.length === 0) {
        const mensagem = modo === 'ativos' ? 'Nenhum agendamento ativo encontrado.' : 'Nenhum histórico de agendamentos encontrado.';
        listaAgendamentosVisualizacao.innerHTML = `<p>${mensagem}</p>`;
        return;
    }
    listaAgendamentosVisualizacao.innerHTML = agendamentos.map(ag => {
        if (!ag.horario || typeof ag.horario.toDate !== 'function') return '';

        const data = ag.horario.toDate();
        const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const cardClass = modo === 'historico' ? 'agendamento-card passado' : 'agendamento-card';
        let statusExibido = ag.status;
        if (modo === 'historico' && ag.status === 'agendado') {
            statusExibido = 'Concluído';
        }
        return `
            <div class="${cardClass}">
                <h4>${ag.servicoNome || 'Serviço não informado'}</h4>
                <p><strong>Data:</strong> ${dataFormatada}</p>
                <p><strong>Horário:</strong> ${horaFormatada}</p>
                <p><strong>Status:</strong> ${statusExibido}</p>
            </div>
        `;
    }).join('');
}


// ==========================================================================
//  EVENT LISTENERS E FUNÇÕES DE INTERAÇÃO
// ==========================================================================
function configurarTodosEventListeners() {
    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            const menu = button.dataset.menu;
            document.querySelectorAll('.menu-content, .menu-btn').forEach(el => el.classList.remove('ativo'));
            document.getElementById(`menu-${menu}`).classList.add('ativo');
            button.classList.add('ativo');

            if (menu === 'visualizacao') {
                iniciarAbaMeusAgendamentos();
            }
        });
    });

    if(btnVisualizarAgendamentos) btnVisualizarAgendamentos.addEventListener('click', () => buscarEExibirAgendamentos('ativos'));
    if(btnVerHistorico) btnVerHistorico.addEventListener('click', () => buscarEExibirAgendamentos('historico'));

    const dropdownToggle = document.getElementById('btn-primeiro-acesso');
    const dropdownMenu = document.getElementById('primeiro-acesso-menu');
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', (event) => { event.stopPropagation(); dropdownMenu.classList.toggle('ativo'); });
        document.addEventListener('click', () => { if (dropdownMenu.classList.contains('ativo')) { dropdownMenu.classList.remove('ativo'); }});
    }
    dataInput.addEventListener('change', (e) => { agendamentoState.data = e.target.value; gerarHorariosDisponiveis(); });
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
    btnBuscarCancelamento.addEventListener('click', buscarAgendamentosParaCancelar);
}

// ==========================================================================
//  DEMAIS FUNÇÕES
// ==========================================================================

}

async function getUidFromSlug(slug) {
    const docSnap = await getDoc(doc(db, "slugs", slug));
    return docSnap.exists() ? docSnap.data().uid : null;
}

async function carregarDadosDoFirebase() {
    const [perfilDoc, servicosSnapshot, horariosDoc] = await Promise.all([
        getDoc(doc(db, "users", profissionalUid, "publicProfile", "profile")),
        getDocs(collection(db, "users", profissionalUid, "servicos")),
        getDoc(doc(db, "users", profissionalUid, "configuracoes", "horarios"))
    ]);
    return { perfilDoc, servicosSnapshot, horariosDoc };
}

function processarDadosCarregados({ perfilDoc, servicosSnapshot, horariosDoc }) {
    if (perfilDoc.exists()) professionalData.perfil = perfilDoc.data();
    if (horariosDoc.exists()) professionalData.horarios = horariosDoc.data();
    professionalData.servicos = servicosSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(servico => servico.visivelNaVitrine !== false);
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
        erros.push("Nenhum serviço foi disponibilizado para a vitrine.");
    }
    return erros;
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
    const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaSemana];
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
    document.getElementById('info-servicos').innerHTML = servicos.length > 0 ? servicos.map(s => `<div class="servico-info-card"><h4>${s.nome}</h4><p class="servico-detalhe">${s.duracao} min</p><p class="servico-preco">R$ ${parseFloat(s.preco || 0).toFixed(2)}</p></div>`).join('') : '<p>Nenhum serviço disponível.</p>';
    servicosContainer.innerHTML = servicos.length > 0 ? servicos.map(s => `<button class="service-item" data-id="${s.id}">${s.nome} - R$ ${parseFloat(s.preco || 0).toFixed(2)}</button>`).join('') : '<p>Nenhum serviço para agendamento.</p>';
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
    inputTelefoneVisualizacao.value = telefone;
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
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Salvando...';
    try {
        const pin = pinClienteInput.value;
        if (pin.length < 4) {
            showNotification("O PIN precisa ter entre 4 e 6 dígitos.", true);
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Confirmar Agendamento';
            return;
        }
        const [hora, minuto] = agendamentoState.horario.split(':').map(Number);
        const dataAgendamento = new Date(agendamentoState.data + "T00:00:00");
        dataAgendamento.setHours(hora, minuto);
        const dadosAgendamento = {
            clienteNome: nomeClienteInput.value.trim(),
            clienteTelefone: telefoneClienteInput.value.replace(/\D/g, ''),
            pinHash: await gerarHashSHA256(pin),
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

async function gerarHashSHA256(texto) {
    const data = new TextEncoder().encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
