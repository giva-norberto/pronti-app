// Versão revisada para comunicação correta com Firebase 10.12.2
// Alterações SELADAS: versão dos imports, inicialização garantida

// Variáveis globais
let db, auth, storage;
let empresaId = null;
let profissionalAtual = null;
let servicosDisponiveis = [];
let editandoProfissionalId = null;

// Novo: Horários base com múltiplos intervalos por dia (default: um intervalo por dia)
let horariosBase = {
    segunda: [{ inicio: '09:00', fim: '18:00' }],
    terca: [{ inicio: '09:00', fim: '18:00' }],
    quarta: [{ inicio: '09:00', fim: '18:00' }],
    quinta: [{ inicio: '09:00', fim: '18:00' }],
    sexta: [{ inicio: '09:00', fim: '18:00' }],
    sabado: [{ inicio: '09:00', fim: '18:00' }],
    domingo: [{ inicio: '09:00', fim: '18:00' }]
};
let agendaEspecial = []; // [{tipo, mes, inicio, fim}]

// Novo: intervalo padrão em minutos
let intervaloBase = 30;

// Elementos DOM
const elementos = {
    btnAddProfissional: document.getElementById('btn-add-profissional'),
    btnCancelarEquipe: document.getElementById('btn-cancelar-equipe'),
    modalAddProfissional: document.getElementById('modal-add-profissional'),
    formAddProfissional: document.getElementById('form-add-profissional'),
    btnCancelarProfissional: document.getElementById('btn-cancelar-profissional'),
    listaProfissionaisPainel: document.getElementById('lista-profissionais-painel'),
    nomeProfissional: document.getElementById('nome-profissional'),
    fotoProfissional: document.getElementById('foto-profissional'),
    tituloModalProfissional: document.getElementById('titulo-modal-profissional'),
    modalPerfilProfissional: document.getElementById('modal-perfil-profissional'),
    perfilNomeProfissional: document.getElementById('perfil-nome-profissional'),
    servicosLista: document.getElementById('servicos-lista'),
    horariosLista: document.getElementById('horarios-lista'),
    btnCancelarPerfil: document.getElementById('btn-cancelar-perfil'),
    btnSalvarPerfil: document.getElementById('btn-salvar-perfil'),
    // Agenda especial
    tabAgendaEspecial: document.getElementById('tab-agenda-especial'),
    tabContentAgendaEspecial: document.getElementById('tab-content-agenda-especial'),
    agendaTipo: document.getElementById('agenda-tipo'),
    agendaMesArea: document.getElementById('agenda-mes-area'),
    agendaIntervaloArea: document.getElementById('agenda-intervalo-area'),
    agendaMes: document.getElementById('agenda-mes'),
    agendaInicio: document.getElementById('agenda-inicio'),
    agendaFim: document.getElementById('agenda-fim'),
    btnAgendaEspecial: document.getElementById('btn-agenda-especial'),
    agendaEspecialLista: document.getElementById('agenda-especial-lista'),
    // Novo: campo intervalo de atendimento
    inputIntervalo: document.getElementById('intervalo-atendimento')
};

// TABS do perfil
function setupPerfilTabs() {
    const tabServicos = document.getElementById('tab-servicos');
    const tabHorarios = document.getElementById('tab-horarios');
    const tabAgendaEspecial = document.getElementById('tab-agenda-especial');
    const contentServicos = document.getElementById('tab-content-servicos');
    const contentHorarios = document.getElementById('tab-content-horarios');
    const contentAgendaEspecial = document.getElementById('tab-content-agenda-especial');

    if (!tabServicos || !tabHorarios || !tabAgendaEspecial) return;

    tabServicos.onclick = () => {
        tabServicos.classList.add('active');
        tabHorarios.classList.remove('active');
        tabAgendaEspecial.classList.remove('active');
        contentServicos.classList.add('active');
        contentHorarios.classList.remove('active');
        contentAgendaEspecial.classList.remove('active');
    };
    tabHorarios.onclick = () => {
        tabHorarios.classList.add('active');
        tabServicos.classList.remove('active');
        tabAgendaEspecial.classList.remove('active');
        contentHorarios.classList.add('active');
        contentServicos.classList.remove('active');
        contentAgendaEspecial.classList.remove('active');
    };
    tabAgendaEspecial.onclick = () => {
        tabAgendaEspecial.classList.add('active');
        tabServicos.classList.remove('active');
        tabHorarios.classList.remove('active');
        contentAgendaEspecial.classList.add('active');
        contentServicos.classList.remove('active');
        contentHorarios.classList.remove('active');
    };

    // Agenda especial - alternância entre mês/intervalo
    elementos.agendaTipo.onchange = function () {
        if (this.value === "mes") {
            elementos.agendaMesArea.style.display = "block";
            elementos.agendaIntervaloArea.style.display = "none";
        } else {
            elementos.agendaMesArea.style.display = "none";
            elementos.agendaIntervaloArea.style.display = "block";
        }
    };
}
window.addEventListener('DOMContentLoaded', setupPerfilTabs);

// Inicialização
async function inicializar() {
    try {
        // Importar Firebase
        const firebaseConfig = await import('./firebase-config.js');
        db = firebaseConfig.db;
        auth = firebaseConfig.auth;
        storage = firebaseConfig.storage;

        // Importar funções do Firestore (VERSÃO ATUALIZADA: 10.12.2)
        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

        // Monitorar autenticação
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                empresaId = await getEmpresaIdDoDono(user.uid);
                if (empresaId) {
                    await carregarServicos();
                    iniciarListenerDaEquipe();
                    adicionarEventListeners();
                } else {
                    mostrarErro("Não foi possível identificar a sua empresa.");
                }
            } else {
                // Para teste, não redirecionar
                // window.location.href = "login.html";
            }
        });

    } catch (error) {
        console.error("Erro na inicialização:", error);
        mostrarErro("Erro ao inicializar o sistema.");
    }
}

// Botão para cancelar e voltar ao menu lateral
function voltarMenuLateral() {
    // Adapte para sua lógica (ex: window.location.href = "index.html";)
    window.location.href = "index.html";
}

// Buscar ou criar empresa
async function getEmpresaIdDoDono(uid) {
    const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const empresariosRef = collection(db, "empresarios");
    const q = query(empresariosRef, where("donoId", "==", uid));

    try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        // Criar nova empresa
        const novaEmpresa = {
            donoId: uid,
            nome: "Minha Empresa",
            criadaEm: serverTimestamp(),
        };

        const docRef = await addDoc(empresariosRef, novaEmpresa);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        return null;
    }
}

// Carregar serviços da empresa
async function carregarServicos() {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    try {
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const snapshot = await getDocs(servicosRef);

        servicosDisponiveis = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        servicosDisponiveis = [];
    }
}

// Iniciar listener da equipe
function iniciarListenerDaEquipe() {
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    .then(({ collection, onSnapshot, query }) => {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const q = query(profissionaisRef);

        onSnapshot(q, (snapshot) => {
            const equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarEquipe(equipe);
        }, (error) => {
            console.error("Erro no listener da equipe:", error);
        });
    });
}

// Renderizar equipe (card com botão excluir alinhado)
function renderizarEquipe(equipe) {
    elementos.listaProfissionaisPainel.innerHTML = "";

    if (equipe.length === 0) {
        elementos.listaProfissionaisPainel.innerHTML = `
            <div class="empty-state">
                <h3>👥 Equipe Vazia</h3>
                <p>Nenhum profissional na equipe ainda.<br>Clique em "Adicionar Profissional" para começar.</p>
            </div>
        `;
        return;
    }

    equipe.forEach(profissional => {
        const div = document.createElement("div");
        div.className = "profissional-card";
        div.innerHTML = `
            <div class="profissional-foto">
                <img src="${profissional.fotoUrl || "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop"}"
                     alt="Foto de ${profissional.nome}"
                     onerror="this.src='https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'">
            </div>
            <div class="profissional-info">
                <span class="profissional-nome">${profissional.nome}</span>
                <span class="profissional-status">${profissional.ehDono ? 'Dono' : 'Funcionário'}</span>
            </div>
            <div class="profissional-actions">
                <button class="btn btn-profile" onclick="abrirPerfilProfissional('${profissional.id}', '${profissional.nome}')">
                    👤 Perfil
                </button>
                <button class="btn btn-edit" onclick="editarProfissional('${profissional.id}')">
                    ✏️ Editar
                </button>
                ${!profissional.ehDono ? `
                <button class="btn btn-danger" onclick="excluirProfissional('${profissional.id}')">
                    🗑️ Excluir
                </button>
                ` : ""}
            </div>
        `;
        elementos.listaProfissionaisPainel.appendChild(div);
    });
}

// Abrir modal de perfil
async function abrirPerfilProfissional(profissionalId, nomeProfissional) {
    profissionalAtual = profissionalId;
    elementos.perfilNomeProfissional.textContent = `👤 Perfil de ${nomeProfissional}`;
    renderizarServicos([]);
    renderizarHorarios(horariosBase, intervaloBase); // inclui intervaloBase
    agendaEspecial = [];
    await carregarDadosProfissional(profissionalId);
    elementos.modalPerfilProfissional.classList.add('show');
    renderizarAgendaEspecial();
}

// Carregar dados do profissional
async function carregarDadosProfissional(profissionalId) {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        const profissionalDoc = await getDoc(profissionalRef);

        if (profissionalDoc.exists()) {
            const dados = profissionalDoc.data();

            // Serviços
            if (dados.servicos) renderizarServicos(dados.servicos);
            else renderizarServicos([]);

            // Horários: múltiplos intervalos/dia + intervalo
            let intervaloMin = dados.horarios?.intervalo ?? intervaloBase;
            let horariosData = { ...dados.horarios };
            delete horariosData.intervalo;
            renderizarHorarios(horariosData, intervaloMin);

            // Set campo intervalo
            if (elementos.inputIntervalo) {
                elementos.inputIntervalo.value = intervaloMin;
            }

            // Agenda especial
            agendaEspecial = dados.agendaEspecial || [];
            renderizarAgendaEspecial();
        }
    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
    }
}

// Renderizar serviços com seleção didática
function renderizarServicos(servicosSelecionados = []) {
    elementos.servicosLista.innerHTML = "";

    if (servicosDisponiveis.length === 0) {
        elementos.servicosLista.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #6c757d;">
                <p>Nenhum serviço cadastrado ainda.</p>
                <p>Vá para a página de serviços para adicionar serviços.</p>
            </div>
        `;
        return;
    }

    servicosDisponiveis.forEach(servico => {
        const div = document.createElement("div");
        div.className = "servico-item";
        div.setAttribute('data-servico-id', servico.id);
        div.innerHTML = `
            <div class="servico-nome">${servico.nome}</div>
            <div class="servico-preco">R$ ${servico.preco.toFixed(2)}</div>
        `;

        if (servicosSelecionados.includes(servico.id)) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            div.classList.toggle('selected');
        });

        elementos.servicosLista.appendChild(div);
    });
}

// Renderizar horários com inclusão/remover intervalos
function renderizarHorarios(horarios = {}, intervaloMin = intervaloBase) {
    const horariosLista = elementos.horariosLista;
    horariosLista.innerHTML = '';
    const diasSemana = [
        { key: 'segunda', nome: 'Segunda-feira' },
        { key: 'terca', nome: 'Terça-feira' },
        { key: 'quarta', nome: 'Quarta-feira' },
        { key: 'quinta', nome: 'Quinta-feira' },
        { key: 'sexta', nome: 'Sexta-feira' },
        { key: 'sabado', nome: 'Sábado' },
        { key: 'domingo', nome: 'Domingo' }
    ];

    // Campo intervalo de atendimento (em minutos)
    if (elementos.inputIntervalo) {
        elementos.inputIntervalo.value = intervaloMin;
    }

    diasSemana.forEach(dia => {
        const div = document.createElement('div');
        div.className = 'dia-horario';
        div.setAttribute('data-dia', dia.key);

        // Se não houver horários, inicia com um intervalo padrão
        const intervalos = horarios[dia.key] && Array.isArray(horarios[dia.key])
            ? horarios[dia.key]
            : [{ inicio: '09:00', fim: '18:00' }];

        div.innerHTML = `
            <div class="dia-nome">
                <label>${dia.nome}</label>
            </div>
            <div class="horario-intervalos">
                ${intervalos.map((intervalo, idx) => `
                    <div class="horario-inputs" data-intervalo="${idx}">
                        <input type="time" name="inicio" value="${intervalo.inicio}">
                        <span>até</span>
                        <input type="time" name="fim" value="${intervalo.fim}">
                        <button class="btn-remover-intervalo" title="Remover intervalo" ${intervalos.length === 1 ? 'disabled' : ''}>✖</button>
                    </div>
                `).join('')}
            </div>
            <button class="btn-incluir-intervalo">+ Incluir horário</button>
        `;
        horariosLista.appendChild(div);
    });

    // Botão "Incluir horário"
    document.querySelectorAll('.btn-incluir-intervalo').forEach(btn => {
        btn.onclick = function () {
            const diaDiv = this.closest('.dia-horario');
            const horarioIntervalos = diaDiv.querySelector('.horario-intervalos');
            const novoIdx = horarioIntervalos.children.length;
            const novoDiv = document.createElement('div');
            novoDiv.className = 'horario-inputs';
            novoDiv.setAttribute('data-intervalo', novoIdx);
            novoDiv.innerHTML = `
                <input type="time" name="inicio" value="09:00">
                <span>até</span>
                <input type="time" name="fim" value="18:00">
                <button class="btn-remover-intervalo" title="Remover intervalo">✖</button>
            `;
            horarioIntervalos.appendChild(novoDiv);
            setupRemoverIntervalo();
        };
    });
    setupRemoverIntervalo();
}

// Função para remover intervalos
function setupRemoverIntervalo() {
    document.querySelectorAll('.btn-remover-intervalo').forEach(btn => {
        btn.onclick = function () {
            const horarioInputs = this.closest('.horario-inputs');
            const horarioIntervalos = this.closest('.horario-intervalos');
            if (horarioIntervalos.children.length > 1) {
                horarioInputs.remove();
            }
        };
    });
}

// Coleta e salva os horários/intervalos + campo intervalo atendimento
function coletarHorarios() {
    const horarios = {};
    document.querySelectorAll('.dia-horario').forEach(diaDiv => {
        const dia = diaDiv.getAttribute('data-dia');
        horarios[dia] = [];
        diaDiv.querySelectorAll('.horario-inputs').forEach(inputDiv => {
            const inicio = inputDiv.querySelector('input[name="inicio"]').value;
            const fim = inputDiv.querySelector('input[name="fim"]').value;
            horarios[dia].push({ inicio, fim });
        });
    });
    // Adiciona intervalo de atendimento
    if (elementos.inputIntervalo) {
        horarios.intervalo = parseInt(elementos.inputIntervalo.value, 10) || intervaloBase;
    } else {
        horarios.intervalo = intervaloBase;
    }
    return horarios;
}

// Agenda especial
function renderizarAgendaEspecial() {
    const lista = elementos.agendaEspecialLista;
    lista.innerHTML = '';
    if (!agendaEspecial || agendaEspecial.length === 0) {
        lista.innerHTML = '<div style="color:#888;">Nenhuma agenda especial cadastrada.</div>';
        return;
    }
    agendaEspecial.forEach((item, idx) => {
        let desc = '';
        if (item.tipo === 'mes') {
            desc = `Mês: <b>${item.mes}</b>`;
        } else {
            desc = `De <b>${item.inicio}</b> até <b>${item.fim}</b>`;
        }
        const div = document.createElement('div');
        div.className = 'agenda-especial-item';
        div.innerHTML = `
            <span>${desc}</span>
            <button class="btn btn-danger" data-agenda-idx="${idx}">Excluir</button>
        `;
        lista.appendChild(div);
    });
    // Remover agenda especial
    lista.querySelectorAll('.btn-danger').forEach(btn => {
        btn.onclick = function () {
            const idx = parseInt(btn.getAttribute('data-agenda-idx'), 10);
            agendaEspecial.splice(idx, 1);
            renderizarAgendaEspecial();
        };
    });
}

// Adicionar agenda especial
function adicionarAgendaEspecial() {
    const tipo = elementos.agendaTipo.value;
    if (tipo === 'mes') {
        const mes = elementos.agendaMes.value;
        if (!mes) return alert('Selecione o mês.');
        agendaEspecial.push({ tipo: 'mes', mes });
    } else {
        const inicio = elementos.agendaInicio.value;
        const fim = elementos.agendaFim.value;
        if (!inicio || !fim) return alert('Informe o intervalo.');
        agendaEspecial.push({ tipo: 'intervalo', inicio, fim });
    }
    renderizarAgendaEspecial();
    elementos.formAgendaEspecial.reset();
    elementos.agendaMesArea.style.display = "block";
    elementos.agendaIntervaloArea.style.display = "none";
}

// Salvar perfil do profissional (serviços, horários, agenda especial, intervalo)
// CORRIGIDO: agora salva horários na subcoleção 'configuracoes/horarios'
async function salvarPerfilProfissional() {
    const { doc, updateDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    try {
        // Serviços
        const servicosSelecionados = [];
        document.querySelectorAll('.servico-item.selected').forEach(item => {
            servicosSelecionados.push(item.getAttribute('data-servico-id'));
        });

        // Horários/intervalos + intervalo atendimento
        const horarios = coletarHorarios();

        // Agenda especial
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual);
        await updateDoc(profissionalRef, {
            servicos: servicosSelecionados,
            agendaEspecial: agendaEspecial
        });

        // Salva horários na subcoleção correta
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual, "configuracoes", "horarios");
        await setDoc(horariosRef, horarios, { merge: true });

        elementos.modalPerfilProfissional.classList.remove('show');
        alert("✅ Perfil atualizado com sucesso!");

    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("❌ Erro ao salvar perfil: " + error.message);
    }
}

// Event listeners
function adicionarEventListeners() {
    // Botão adicionar profissional
    elementos.btnAddProfissional.addEventListener("click", () => {
        elementos.formAddProfissional.reset();
        editandoProfissionalId = null;
        elementos.tituloModalProfissional.textContent = "➕ Adicionar Novo Profissional";
        elementos.modalAddProfissional.classList.add('show');
        elementos.formAddProfissional.onsubmit = async function(e) {
            e.preventDefault();
            await adicionarProfissional();
        };
    });

    // Botão cancelar equipe (voltar menu lateral)
    if (elementos.btnCancelarEquipe) {
        elementos.btnCancelarEquipe.addEventListener("click", voltarMenuLateral);
    }

    // Botão cancelar adicionar/editar
    elementos.btnCancelarProfissional.addEventListener("click", () => {
        elementos.modalAddProfissional.classList.remove('show');
        editandoProfissionalId = null;
    });

    // Botão cancelar perfil
    elementos.btnCancelarPerfil.addEventListener("click", () => {
        elementos.modalPerfilProfissional.classList.remove('show');
    });

    // Botão salvar perfil
    elementos.btnSalvarPerfil.addEventListener("click", () => {
        salvarPerfilProfissional();
    });

    // Agenda especial - adicionar
    if (elementos.btnAgendaEspecial) {
        elementos.btnAgendaEspecial.addEventListener('click', adicionarAgendaEspecial);
    }

    // Fechar modais clicando fora
    [elementos.modalAddProfissional, elementos.modalPerfilProfissional].forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                editandoProfissionalId = null;
            }
        });
    });
}

// Adicionar profissional
// CORRIGIDO: agora horários são salvos na subcoleção 'configuracoes/horarios'
async function adicionarProfissional() {
    const { collection, addDoc, serverTimestamp, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");

    const btnSubmit = elementos.formAddProfissional.querySelector('.btn-submit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Salvando...";

    const nome = elementos.nomeProfissional.value.trim();
    const fotoFile = elementos.fotoProfissional.files[0];

    if (!nome) {
        alert("O nome do profissional é obrigatório.");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "💾 Salvar Profissional";
        return;
    }

    let fotoURL = "";
    if (fotoFile) {
        try {
            const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
            await uploadBytes(storageRef, fotoFile);
            fotoURL = await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Erro no upload da foto:", error);
            alert("Erro ao enviar a imagem: " + error.message);
            btnSubmit.disabled = false;
            btnSubmit.textContent = "💾 Salvar Profissional";
            return;
        }
    }

    // Corrigido: sem campo 'horarios' no documento principal
    const novoProfissional = {
        nome,
        fotoUrl: fotoURL,
        ehDono: false,
        servicos: [],
        criadoEm: serverTimestamp(),
        agendaEspecial: []
    };

    try {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const docRef = await addDoc(profissionaisRef, novoProfissional);

        // Cria documento de horários padrão na subcoleção correta
        const horariosPadrao = { ...horariosBase, intervalo: intervaloBase };
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", docRef.id, "configuracoes", "horarios");
        await setDoc(horariosRef, horariosPadrao);

        elementos.modalAddProfissional.classList.remove('show');
        alert("✅ Profissional adicionado com sucesso!");

    } catch (error) {
        console.error("Erro ao adicionar profissional:", error);
        alert("Erro ao adicionar profissional: " + error.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "💾 Salvar Profissional";
    }
}

// Função para editar profissional
async function editarProfissional(profissionalId) {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        const profissionalDoc = await getDoc(profissionalRef);
        if (profissionalDoc.exists()) {
            const dados = profissionalDoc.data();
            elementos.formAddProfissional.reset();
            elementos.nomeProfissional.value = dados.nome || "";
            elementos.tituloModalProfissional.textContent = "✏️ Editar Profissional";
            editandoProfissionalId = profissionalId;
            elementos.modalAddProfissional.classList.add('show');
            elementos.formAddProfissional.onsubmit = async function(e) {
                e.preventDefault();
                await salvarEdicaoProfissional(profissionalId);
            };
        }
    } catch (error) {
        alert("Erro ao buscar profissional: " + error.message);
    }
}

// Função para salvar edição
async function salvarEdicaoProfissional(profissionalId) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
    const nome = elementos.nomeProfissional.value.trim();
    const fotoFile = elementos.fotoProfissional.files[0];

    if (!nome) {
        alert("O nome do profissional é obrigatório.");
        return;
    }

    let fotoURL = "";
    if (fotoFile) {
        try {
            const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
            await uploadBytes(storageRef, fotoFile);
            fotoURL = await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Erro no upload da foto:", error);
            alert("Erro ao enviar a imagem: " + error.message);
        }
    }

    const updateData = { nome };
    if (fotoURL) updateData.fotoUrl = fotoURL;

    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await updateDoc(profissionalRef, updateData);
        elementos.modalAddProfissional.classList.remove('show');
        alert("✅ Profissional editado com sucesso!");
        elementos.formAddProfissional.onsubmit = null;
        editandoProfissionalId = null;
    } catch (error) {
        alert("Erro ao editar profissional: " + error.message);
    }
}

// Função para excluir profissional
async function excluirProfissional(profissionalId) {
    if (!confirm("Tem certeza que deseja excluir este profissional? Essa ação não pode ser desfeita.")) return;
    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await deleteDoc(profissionalRef);
        alert("✅ Profissional excluído!");
    } catch (error) {
        alert("Erro ao excluir profissional: " + error.message);
    }
}

// Mostrar erro
function mostrarErro(mensagem) {
    elementos.listaProfissionaisPainel.innerHTML = `
        <div style="color: red; padding: 20px; border: 1px solid red; border-radius: 5px; grid-column: 1 / -1;">
            <h4>❌ Erro</h4>
            <p>${mensagem}</p>
        </div>
    `;
}

// Tornar funções globais para uso no HTML
window.abrirPerfilProfissional = abrirPerfilProfissional;
window.editarProfissional = editarProfissional;
window.excluirProfissional = excluirProfissional;

// Inicializar quando o DOM estiver carregado
window.addEventListener("DOMContentLoaded", inicializar);
