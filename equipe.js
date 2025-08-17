// ======================================================================
//                         EQUIPE.JS
//                         VERSÃO CORRETA
//         Apenas a lógica de convite por link foi acrescentada.
// ======================================================================

// Variáveis globais
let db, auth, storage;
let empresaId = null;
let profissionalAtual = null;
let servicosDisponiveis = [];
let editandoProfissionalId = null;

// Horários base com dias INATIVOS por padrão, para novos funcionários
let horariosBase = {
    segunda: { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] },
    terca:   { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] },
    quarta:  { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] },
    quinta:  { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] },
    sexta:   { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] },
    sabado:  { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] },
    domingo: { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] }
};
let intervaloBase = 30;
let agendaEspecial = [];

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
    inputIntervalo: document.getElementById('intervalo-atendimento'),
    // --- NOVO ELEMENTO ACRESCENTADO ---
    btnGerarConvite: document.getElementById('btn-gerar-convite')
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
        tabServicos.classList.add('active'); tabHorarios.classList.remove('active'); tabAgendaEspecial.classList.remove('active');
        contentServicos.classList.add('active'); contentHorarios.classList.remove('active'); contentAgendaEspecial.classList.remove('active');
    };
    tabHorarios.onclick = () => {
        tabHorarios.classList.add('active'); tabServicos.classList.remove('active'); tabAgendaEspecial.classList.remove('active');
        contentHorarios.classList.add('active'); contentServicos.classList.remove('active'); contentAgendaEspecial.classList.remove('active');
    };
    tabAgendaEspecial.onclick = () => {
        tabAgendaEspecial.classList.add('active'); tabServicos.classList.remove('active'); tabHorarios.classList.remove('active');
        contentAgendaEspecial.classList.add('active'); contentServicos.classList.remove('active'); contentHorarios.classList.remove('active');
    };
    elementos.agendaTipo.onchange = function () {
        elementos.agendaMesArea.style.display = this.value === "mes" ? "block" : "none";
        elementos.agendaIntervaloArea.style.display = this.value === "intervalo" ? "block" : "none";
    };
}
window.addEventListener('DOMContentLoaded', setupPerfilTabs);

// Inicialização
async function inicializar() {
    try {
        const firebaseConfig = await import('./firebase-config.js');
        db = firebaseConfig.db; auth = firebaseConfig.auth; storage = firebaseConfig.storage;

        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                empresaId = await getEmpresaIdDoDono(user.uid);
                if (empresaId) {
                    await carregarServicos();
                    iniciarListenerDaEquipe();
                    adicionarEventListeners();
                } else {
                    mostrarErro("Não foi possível identificar a sua empresa. Verifique se seu usuário é o dono de uma empresa no banco de dados.");
                }
            } else {
                window.location.href = "login.html";
            }
        });
    } catch (error) {
        console.error("Erro na inicialização:", error);
        mostrarErro("Erro ao inicializar o sistema.");
    }
}

function voltarMenuLateral() { window.location.href = "index.html"; }

async function getEmpresaIdDoDono(uid) {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const empresariosRef = collection(db, "empresarios");
    const q = query(empresariosRef, where("donoId", "==", uid));
    try {
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : snapshot.docs[0].id;
    } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        return null;
    }
}

async function carregarServicos() {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    try {
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const snapshot = await getDocs(servicosRef);
        servicosDisponiveis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        servicosDisponiveis = [];
    }
}

function iniciarListenerDaEquipe() {
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    .then(({ collection, onSnapshot, query }) => {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        onSnapshot(query(profissionaisRef), (snapshot) => {
            const equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarEquipe(equipe);
        }, (error) => console.error("Erro no listener da equipe:", error));
    });
}

function renderizarEquipe(equipe) {
    elementos.listaProfissionaisPainel.innerHTML = "";
    if (equipe.length === 0) {
        elementos.listaProfissionaisPainel.innerHTML = `<div class="empty-state"><h3>👥 Equipe Vazia</h3><p>Nenhum profissional na equipe ainda.<br>Clique em "Adicionar Profissional" para começar.</p></div>`;
        return;
    }
    equipe.forEach(profissional => {
        const div = document.createElement("div");
        div.className = "profissional-card";
        div.innerHTML = `
            <div class="profissional-foto"><img src="${profissional.fotoUrl || "https://placehold.co/150x150/eef2ff/4f46e5?text=P"}" alt="Foto de ${profissional.nome}" onerror="this.src='https://placehold.co/150x150/eef2ff/4f46e5?text=P'"></div>
            <div class="profissional-info"><span class="profissional-nome">${profissional.nome}</span><span class="profissional-status">${profissional.ehDono ? 'Dono' : 'Funcionário'}</span></div>
            <div class="profissional-actions">
                <button class="btn btn-profile" onclick="abrirPerfilProfissional('${profissional.id}')">👤 Perfil</button>
                <button class="btn btn-edit" onclick="editarProfissional('${profissional.id}')">✏️ Editar</button>
                ${!profissional.ehDono ? `<button class="btn btn-danger" onclick="excluirProfissional('${profissional.id}')">🗑️ Excluir</button>` : ""}
            </div>`;
        elementos.listaProfissionaisPainel.appendChild(div);
    });
}

async function abrirPerfilProfissional(profissionalId) {
    const profissional = await carregarDadosProfissional(profissionalId);
    if (!profissional) {
        mostrarErro("Não foi possível carregar os dados deste profissional.");
        return;
    }
    profissionalAtual = profissionalId;
    elementos.perfilNomeProfissional.textContent = `👤 Perfil de ${profissional.nome}`;
    renderizarServicos(profissional.servicos || []);
    agendaEspecial = profissional.agendaEspecial || [];
    renderizarAgendaEspecial();
    elementos.modalPerfilProfissional.classList.add('show');
}

async function carregarDadosProfissional(profissionalId) {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        const profissionalDoc = await getDoc(profissionalRef);
        if (!profissionalDoc.exists()) return null;
        
        const dados = profissionalDoc.data();
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId, "configuracoes", "horarios");
        const horariosDoc = await getDoc(horariosRef);

        if (horariosDoc.exists()) {
            renderizarHorarios(horariosDoc.data());
        } else {
            renderizarHorarios({ ...horariosBase, intervalo: intervaloBase });
        }
        return dados;
    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        return null;
    }
}

function renderizarServicos(servicosSelecionados = []) {
    elementos.servicosLista.innerHTML = "";
    if (servicosDisponiveis.length === 0) {
        elementos.servicosLista.innerHTML = `<div class="servicos-empty-state"><p>Nenhum serviço cadastrado ainda.</p><p>Vá para a página de serviços para adicioná-los.</p></div>`;
        return;
    }
    servicosDisponiveis.forEach(servico => {
        const div = document.createElement("div");
        div.className = "servico-item";
        div.setAttribute('data-servico-id', servico.id);
        div.innerHTML = `<div class="servico-nome">${servico.nome}</div><div class="servico-preco">R$ ${servico.preco.toFixed(2)}</div>`;
        if (servicosSelecionados.includes(servico.id)) div.classList.add('selected');
        div.addEventListener('click', () => div.classList.toggle('selected'));
        elementos.servicosLista.appendChild(div);
    });
}

function renderizarHorarios(horariosDataCompleta = {}) {
    const horariosLista = elementos.horariosLista;
    horariosLista.innerHTML = '';
    const diasSemana = [
        { key: 'segunda', nome: 'Segunda-feira' }, { key: 'terca', nome: 'Terça-feira' },
        { key: 'quarta', nome: 'Quarta-feira' }, { key: 'quinta', nome: 'Quinta-feira' },
        { key: 'sexta', nome: 'Sexta-feira' }, { key: 'sabado', nome: 'Sábado' },
        { key: 'domingo', nome: 'Domingo' }
    ];

    elementos.inputIntervalo.value = horariosDataCompleta.intervalo || intervaloBase;

    diasSemana.forEach(dia => {
        const diaData = horariosDataCompleta[dia.key] || { ativo: false, blocos: [{ inicio: '09:00', fim: '18:00' }] };
        const estaAtivo = diaData.ativo;
        const blocos = diaData.blocos && diaData.blocos.length > 0 ? diaData.blocos : [{ inicio: '09:00', fim: '18:00' }];
        
        const div = document.createElement('div');
        div.className = 'dia-horario';
        if (!estaAtivo) div.classList.add('inativo');
        div.setAttribute('data-dia', dia.key);

        div.innerHTML = `
            <div class="dia-header">
                <label class="dia-nome">${dia.nome}</label>
                <label class="switch">
                    <input type="checkbox" class="toggle-dia" ${estaAtivo ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="horario-conteudo">
                <div class="horario-intervalos">
                    ${blocos.map(bloco => `
                        <div class="horario-inputs">
                            <input type="time" name="inicio" value="${bloco.inicio}">
                            <span>até</span>
                            <input type="time" name="fim" value="${bloco.fim}">
                            <button type="button" class="btn-remover-intervalo" title="Remover intervalo">✖</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-incluir-intervalo">+ Incluir horário</button>
            </div>`;
        horariosLista.appendChild(div);
    });

    horariosLista.querySelectorAll('.toggle-dia').forEach(toggle => {
        toggle.addEventListener('change', function() {
            this.closest('.dia-horario').classList.toggle('inativo', !this.checked);
        });
    });
    horariosLista.querySelectorAll('.btn-incluir-intervalo').forEach(btn => {
        btn.onclick = function () {
            const container = this.previousElementSibling;
            const novoBloco = document.createElement('div');
            novoBloco.className = 'horario-inputs';
            novoBloco.innerHTML = `<input type="time" name="inicio" value="09:00"><span>até</span><input type="time" name="fim" value="18:00"><button type="button" class="btn-remover-intervalo" title="Remover intervalo">✖</button>`;
            container.appendChild(novoBloco);
            setupRemoverIntervalo();
        };
    });
    setupRemoverIntervalo();
}

function setupRemoverIntervalo() {
    elementos.horariosLista.querySelectorAll('.btn-remover-intervalo').forEach(btn => {
        btn.onclick = function () {
            const container = this.closest('.horario-intervalos');
            if (container.children.length > 1) {
                this.closest('.horario-inputs').remove();
            } else {
                alert("Para desativar o dia, use o botão ao lado do nome do dia.");
            }
        };
    });
}

function coletarHorarios() {
    const horarios = {};
    document.querySelectorAll('.dia-horario').forEach(diaDiv => {
        const dia = diaDiv.getAttribute('data-dia');
        const estaAtivo = diaDiv.querySelector('.toggle-dia').checked;
        const blocos = [];

        if (estaAtivo) {
            diaDiv.querySelectorAll('.horario-inputs').forEach(inputDiv => {
                const inicio = inputDiv.querySelector('input[name="inicio"]').value;
                const fim = inputDiv.querySelector('input[name="fim"]').value;
                if (inicio && fim) blocos.push({ inicio, fim });
            });
        }
        
        horarios[dia] = { ativo: estaAtivo, blocos: blocos.length > 0 ? blocos : [{ inicio: '09:00', fim: '18:00' }] };
    });
    horarios.intervalo = parseInt(elementos.inputIntervalo.value, 10) || intervaloBase;
    return horarios;
}

function renderizarAgendaEspecial() {
    const lista = elementos.agendaEspecialLista;
    lista.innerHTML = '';
    if (!agendaEspecial || agendaEspecial.length === 0) {
        lista.innerHTML = '<div class="empty-state-agenda-especial">Nenhuma agenda especial cadastrada.</div>';
        return;
    }
    agendaEspecial.forEach((item, idx) => {
        let desc = (item.tipo === 'mes') ? `Mês: <b>${item.mes}</b>` : `De <b>${item.inicio}</b> até <b>${item.fim}</b>`;
        const div = document.createElement('div');
        div.className = 'agenda-especial-item';
        div.innerHTML = `<span>${desc}</span><button type="button" class="btn btn-danger" data-agenda-idx="${idx}">Excluir</button>`;
        lista.appendChild(div);
    });
    lista.querySelectorAll('.btn-danger').forEach(btn => {
        btn.onclick = function () {
            const idx = parseInt(this.getAttribute('data-agenda-idx'), 10);
            agendaEspecial.splice(idx, 1);
            renderizarAgendaEspecial();
        };
    });
}

function adicionarAgendaEspecial() {
    const tipo = elementos.agendaTipo.value;
    if (tipo === 'mes') {
        if (!elementos.agendaMes.value) return alert('Selecione o mês.');
        agendaEspecial.push({ tipo: 'mes', mes: elementos.agendaMes.value });
    } else {
        if (!elementos.agendaInicio.value || !elementos.agendaFim.value) return alert('Informe o intervalo.');
        agendaEspecial.push({ tipo: 'intervalo', inicio: elementos.agendaInicio.value, fim: elementos.agendaFim.value });
    }
    renderizarAgendaEspecial();
}

async function salvarPerfilProfissional() {
    const { doc, updateDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    try {
        const servicosSelecionados = Array.from(document.querySelectorAll('.servico-item.selected')).map(item => item.getAttribute('data-servico-id'));
        const horarios = coletarHorarios();

        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual);
        await updateDoc(profissionalRef, { servicos: servicosSelecionados, agendaEspecial: agendaEspecial });

        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual, "configuracoes", "horarios");
        await setDoc(horariosRef, horarios, { merge: true });

        elementos.modalPerfilProfissional.classList.remove('show');
        alert("✅ Perfil atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("❌ Erro ao salvar perfil: " + error.message);
    }
}

function adicionarEventListeners() {
    elementos.btnAddProfissional.addEventListener("click", () => {
        elementos.formAddProfissional.reset();
        editandoProfissionalId = null;
        elementos.tituloModalProfissional.textContent = "➕ Adicionar Novo Profissional";
        elementos.modalAddProfissional.classList.add('show');
        elementos.formAddProfissional.onsubmit = async (e) => {
            e.preventDefault();
            await adicionarProfissional();
        };
    });

    if (elementos.btnCancelarEquipe) elementos.btnCancelarEquipe.addEventListener("click", voltarMenuLateral);
    elementos.btnCancelarProfissional.addEventListener("click", () => elementos.modalAddProfissional.classList.remove('show'));
    elementos.btnCancelarPerfil.addEventListener("click", () => elementos.modalPerfilProfissional.classList.remove('show'));
    elementos.btnSalvarPerfil.addEventListener("click", salvarPerfilProfissional);
    if (elementos.btnAgendaEspecial) elementos.btnAgendaEspecial.addEventListener('click', adicionarAgendaEspecial);

    // --- NOVO EVENT LISTENER ACRESCENTADO ---
    if (elementos.btnGerarConvite) {
        elementos.btnGerarConvite.addEventListener('click', gerarLinkDeConvite);
    }

    [elementos.modalAddProfissional, elementos.modalPerfilProfissional].forEach(modal => {
        modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove('show'); });
    });
}

async function adicionarProfissional() {
    const { collection, addDoc, serverTimestamp, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");

    const btnSubmit = elementos.formAddProfissional.querySelector('.btn-submit');
    btnSubmit.disabled = true; btnSubmit.textContent = "Salvando...";

    const nome = elementos.nomeProfissional.value.trim();
    if (!nome) {
        alert("O nome do profissional é obrigatório.");
        btnSubmit.disabled = false; btnSubmit.textContent = "💾 Salvar Profissional";
        return;
    }

    let fotoURL = "";
    const fotoFile = elementos.fotoProfissional.files[0];
    if (fotoFile) {
        try {
            const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
            await uploadBytes(storageRef, fotoFile);
            fotoURL = await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Erro no upload da foto:", error);
        }
    }

    const novoProfissional = {
        nome, fotoUrl: fotoURL, ehDono: false, servicos: [],
        criadoEm: serverTimestamp(), agendaEspecial: []
    };

    try {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const docRef = await addDoc(profissionaisRef, novoProfissional);

        // Usa o horariosBase (com dias inativos) para o novo profissional
        const horariosPadrao = { ...horariosBase, intervalo: intervaloBase };
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", docRef.id, "configuracoes", "horarios");
        await setDoc(horariosRef, horariosPadrao);

        elementos.modalAddProfissional.classList.remove('show');
        alert("✅ Profissional adicionado com sucesso!");
    } catch (error) {
        console.error("Erro ao adicionar profissional:", error);
        alert("Erro ao adicionar profissional: " + error.message);
    } finally {
        btnSubmit.disabled = false; btnSubmit.textContent = "💾 Salvar Profissional";
    }
}

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
            elementos.formAddProfissional.onsubmit = async (e) => {
                e.preventDefault();
                await salvarEdicaoProfissional(profissionalId);
            };
        }
    } catch (error) {
        alert("Erro ao buscar profissional: " + error.message);
    }
}

async function salvarEdicaoProfissional(profissionalId) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
    const nome = elementos.nomeProfissional.value.trim();
    if (!nome) return alert("O nome do profissional é obrigatório.");

    let fotoURL = "";
    const fotoFile = elementos.fotoProfissional.files[0];
    if (fotoFile) {
        try {
            const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
            await uploadBytes(storageRef, fotoFile);
            fotoURL = await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Erro no upload da foto:", error);
        }
    }

    const updateData = { nome };
    if (fotoURL) updateData.fotoUrl = fotoURL;

    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await updateDoc(profissionalRef, updateData);
        elementos.modalAddProfissional.classList.remove('show');
        alert("✅ Profissional editado com sucesso!");
    } catch (error) {
        alert("Erro ao editar profissional: " + error.message);
    }
}

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

function mostrarErro(mensagem) {
    if(elementos.listaProfissionaisPainel) {
        elementos.listaProfissionaisPainel.innerHTML = `<div class="error-message"><h4>❌ Erro</h4><p>${mensagem}</p></div>`;
    }
}

// --- NOVA FUNÇÃO ACRESCENTADA ---
/**
 * Gera e copia o link de convite para a área de transferência.
 */
async function gerarLinkDeConvite() {
    // Reutilizamos a variável global 'empresaId' que já foi carregada na inicialização.
    if (!empresaId) {
        alert("Não foi possível identificar sua empresa para gerar o convite.");
        return;
    }

    try {
        // Cria o link de convite completo
        const inviteLink = `https://pronti-app.vercel.app/convite.html?empresaId=${empresaId}`;

        // Copia o link para a área de transferência do navegador
        await navigator.clipboard.writeText(inviteLink);
        alert("Link de convite copiado para a área de transferência!\n\nEnvie para seu funcionário.");

    } catch (error) {
        console.error('Erro ao gerar o link de convite: ', error);
        alert("Ocorreu um erro ao gerar o link.");
    }
}


// Tornar funções globais para uso no HTML (onclick)
window.abrirPerfilProfissional = abrirPerfilProfissional;
window.editarProfissional = editarProfissional;
window.excluirProfissional = excluirProfissional;

window.addEventListener("DOMContentLoaded", inicializar);
