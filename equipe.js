// Variáveis globais
let db, auth, storage;
let empresaId = null;
let profissionalAtual = null;
let servicosDisponiveis = [];
let horariosBase = {
    segunda: { ativo: false, inicio: '09:00', fim: '18:00' },
    terca: { ativo: false, inicio: '09:00', fim: '18:00' },
    quarta: { ativo: false, inicio: '09:00', fim: '18:00' },
    quinta: { ativo: false, inicio: '09:00', fim: '18:00' },
    sexta: { ativo: false, inicio: '09:00', fim: '18:00' },
    sabado: { ativo: false, inicio: '09:00', fim: '18:00' },
    domingo: { ativo: false, inicio: '09:00', fim: '18:00' }
};
let editandoProfissionalId = null;

// Elementos DOM
const elementos = {
    btnAddProfissional: document.getElementById('btn-add-profissional'),
    modalAddProfissional: document.getElementById('modal-add-profissional'),
    formAddProfissional: document.getElementById('form-add-profissional'),
    btnCancelarProfissional: document.getElementById('btn-cancelar-profissional'),
    listaProfissionaisPainel: document.getElementById('lista-profissionais-painel'),
    nomeProfissional: document.getElementById('nome-profissional'),
    fotoProfissional: document.getElementById('foto-profissional'),
    tituloModalProfissional: document.getElementById('titulo-modal-profissional'),

    // Modal de perfil
    modalPerfilProfissional: document.getElementById('modal-perfil-profissional'),
    perfilNomeProfissional: document.getElementById('perfil-nome-profissional'),
    servicosLista: document.getElementById('servicos-lista'),
    horariosLista: document.getElementById('horarios-lista'),
    btnCancelarPerfil: document.getElementById('btn-cancelar-perfil'),
    btnSalvarPerfil: document.getElementById('btn-salvar-perfil')
};

// Inicialização
async function inicializar() {
    try {
        // Importar Firebase
        const firebaseConfig = await import('./firebase-config.js');
        db = firebaseConfig.db;
        auth = firebaseConfig.auth;
        storage = firebaseConfig.storage;

        // Importar funções do Firestore
        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

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

// Buscar ou criar empresa
async function getEmpresaIdDoDono(uid) {
    const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

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
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

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
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
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

// Renderizar equipe
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
                <button class="btn btn-danger" onclick="excluirProfissional('${profissional.id}')" ${profissional.ehDono ? "style='display:none'" : ""}>
                    🗑️ Excluir
                </button>
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
    renderizarHorarios(horariosBase);
    await carregarDadosProfissional(profissionalId);
    elementos.modalPerfilProfissional.classList.add('show');
}

// Carregar dados do profissional
async function carregarDadosProfissional(profissionalId) {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        const profissionalDoc = await getDoc(profissionalRef);

        if (profissionalDoc.exists()) {
            const dados = profissionalDoc.data();

            // Atualizar serviços selecionados
            if (dados.servicos) {
                dados.servicos.forEach(servicoId => {
                    const elemento = elementos.servicosLista.querySelector(`[data-servico-id="${servicoId}"]`);
                    if (elemento) {
                        elemento.classList.add('selected');
                    }
                });
            }

            // Atualizar horários
            if (dados.horarios) {
                Object.keys(dados.horarios).forEach(dia => {
                    const horario = dados.horarios[dia];
                    const diaDiv = elementos.horariosLista.querySelector(`[data-dia="${dia}"]`);
                    if (diaDiv) {
                        const checkbox = diaDiv.querySelector('input[type="checkbox"]');
                        const inicio = diaDiv.querySelector('input[name="inicio"]');
                        const fim = diaDiv.querySelector('input[name="fim"]');
                        if (checkbox) checkbox.checked = horario.ativo;
                        if (inicio) inicio.value = horario.inicio;
                        if (fim) fim.value = horario.fim;
                    }
                });
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
    }
}

// Renderizar serviços
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

// Renderizar horários
function renderizarHorarios(horarios = horariosBase) {
    elementos.horariosLista.innerHTML = "";

    const diasSemana = [
        { key: 'segunda', nome: 'Segunda-feira' },
        { key: 'terca', nome: 'Terça-feira' },
        { key: 'quarta', nome: 'Quarta-feira' },
        { key: 'quinta', nome: 'Quinta-feira' },
        { key: 'sexta', nome: 'Sexta-feira' },
        { key: 'sabado', nome: 'Sábado' },
        { key: 'domingo', nome: 'Domingo' }
    ];

    diasSemana.forEach(dia => {
        const div = document.createElement("div");
        div.className = "dia-horario";
        div.setAttribute('data-dia', dia.key);
        div.innerHTML = `
            <div class="dia-nome">
                <label>
                    <input type="checkbox" ${horarios[dia.key].ativo ? 'checked' : ''}>
                    ${dia.nome}
                </label>
            </div>
            <div class="horario-inputs">
                <input type="time" name="inicio" value="${horarios[dia.key].inicio}">
                <span>até</span>
                <input type="time" name="fim" value="${horarios[dia.key].fim}">
            </div>
        `;
        elementos.horariosLista.appendChild(div);
    });
}

// Salvar perfil do profissional
async function salvarPerfilProfissional() {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    try {
        // Coletar serviços selecionados
        const servicosSelecionados = [];
        elementos.servicosLista.querySelectorAll('.servico-item.selected').forEach(item => {
            servicosSelecionados.push(item.getAttribute('data-servico-id'));
        });

        // Coletar horários
        const horarios = {};
        elementos.horariosLista.querySelectorAll('.dia-horario').forEach(diaElement => {
            const dia = diaElement.getAttribute('data-dia');
            const checkbox = diaElement.querySelector('input[type="checkbox"]');
            const inicio = diaElement.querySelector('input[name="inicio"]');
            const fim = diaElement.querySelector('input[name="fim"]');

            horarios[dia] = {
                ativo: checkbox.checked,
                inicio: inicio.value,
                fim: fim.value
            };
        });

        // Atualizar no Firebase
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual);
        await updateDoc(profissionalRef, {
            servicos: servicosSelecionados,
            horarios: horarios
        });

        // Fechar modal
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
async function adicionarProfissional() {
    const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");

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

    const novoProfissional = {
        nome,
        fotoUrl: fotoURL,
        ehDono: false,
        servicos: [],
        horarios: horariosBase,
        criadoEm: serverTimestamp()
    };

    try {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        await addDoc(profissionaisRef, novoProfissional);

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
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
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
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
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
    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
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
