// ======================================================================
//                              EQUIPE.JS
//        VERSÃO FINAL, COMPLETA E COM CORREÇÃO DE EVENTO E ALERTAS
// ======================================================================

import { db, auth, storage } from "./firebase-config.js";
import { collection, onSnapshot, query, where, doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- VARIÁVEIS DE ESTADO ---
let isDono = false;
let empresaId = null;
let profissionalAtual = null;
let servicosDisponiveis = [];
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

// --- MAPEAMENTO DE ELEMENTOS DO DOM ---
const elementos = {
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
    btnConvite: document.getElementById('btn-convite'),
    permitirAgendamentoMultiplo: document.getElementById('permitir-agendamento-multiplo')
};

async function garantirPerfilDoDono() {
    const user = auth.currentUser;
    if (!user || !empresaId) return;
    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);
        if (!empresaSnap.exists() || empresaSnap.data().donoId !== user.uid) return;
        
        const donoId = user.uid;
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", donoId);
        const profissionalSnap = await getDoc(profissionalRef);
        
        if (!profissionalSnap.exists()) {
            const usuarioRef = doc(db, "usuarios", donoId);
            const usuarioSnap = await getDoc(usuarioRef);
            const nomeDono = usuarioSnap.exists() && usuarioSnap.data().nome ? usuarioSnap.data().nome : "Dono";
            await setDoc(profissionalRef, {
                nome: nomeDono, ehDono: true, status: 'ativo', 
                criadoEm: serverTimestamp(), uid: donoId, 
                fotoUrl: user.photoURL || "", empresaId: empresaId
            });
        }
    } catch (error) {
        console.error("Erro ao garantir perfil do dono:", error);
        mostrarErro("Não foi possível verificar o perfil do dono.");
    }
}

async function inicializar() {
    try {
        empresaId = localStorage.getItem("empresaAtivaId");
        if (!empresaId) {
            await showAlert("Atenção", "Nenhuma empresa ativa selecionada! Redirecionando...");
            window.location.href = "selecionar-empresa.html";
            return;
        }
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const empresaRef = doc(db, "empresarios", empresaId);
                const empresaSnap = await getDoc(empresaRef);
                if (empresaSnap.exists()) {
                    const empresaData = empresaSnap.data();
                    const adminUID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                    isDono = (empresaData.donoId === user.uid) || (user.uid === adminUID);
                    
                    if (empresaData.donoId === user.uid) {
                        await garantirPerfilDoDono();
                    }

                    await carregarServicos();
                    iniciarListenerDaEquipe();
                    adicionarEventListeners();
                } else {
                    await showAlert("Erro", "A empresa selecionada não foi encontrada. Redirecionando...");
                    window.location.href = "selecionar-empresa.html";
                }
            } else {
                window.location.href = "login.html";
            }
        });
    } catch (error) {
        console.error("Erro na inicialização:", error);
        mostrarErro("Erro ao inicializar a página.");
    }
}

async function iniciarListenerDaEquipe() {
    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
    onSnapshot(query(profissionaisRef), (snapshot) => {
        renderizarEquipe(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
        console.error("Erro no listener da equipe:", error);
        mostrarErro("Não foi possível carregar a equipe em tempo real.");
    });
}

function setupPerfilTabs() {
    const tabServicos = document.getElementById('tab-servicos');
    const tabHorarios = document.getElementById('tab-horarios');
    const tabAgendaEspecial = document.getElementById('tab-agenda-especial');
    const contentServicos = document.getElementById('tab-content-servicos');
    const contentHorarios = document.getElementById('tab-content-horarios');
    const contentAgendaEspecial = document.getElementById('tab-content-agenda-especial');
    if (!tabServicos || !tabHorarios || !tabAgendaEspecial) return;
    
    const setActiveTab = (activeTab, activeContent) => {
        [tabServicos, tabHorarios, tabAgendaEspecial].forEach(t => t.classList.remove('active'));
        [contentServicos, contentHorarios, contentAgendaEspecial].forEach(c => c.classList.remove('active'));
        activeTab.classList.add('active');
        activeContent.classList.add('active');
    };

    tabServicos.onclick = () => setActiveTab(tabServicos, contentServicos);
    tabHorarios.onclick = () => setActiveTab(tabHorarios, contentHorarios);
    tabAgendaEspecial.onclick = () => setActiveTab(tabAgendaEspecial, contentAgendaEspecial);
    
    if (elementos.agendaTipo) {
        elementos.agendaTipo.onchange = function () {
            if(elementos.agendaMesArea) elementos.agendaMesArea.style.display = this.value === "mes" ? "block" : "none";
            if(elementos.agendaIntervaloArea) elementos.agendaIntervaloArea.style.display = this.value === "intervalo" ? "block" : "none";
        };
    }
}
window.addEventListener('DOMContentLoaded', setupPerfilTabs);

function voltarMenuLateral() { window.location.href = "index.html"; }

async function carregarServicos() {
    try {
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const snapshot = await getDocs(servicosRef);
        servicosDisponiveis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        servicosDisponiveis = [];
    }
}

function renderizarEquipe(equipe) {
    if (!elementos.listaProfissionaisPainel) return;
    elementos.listaProfissionaisPainel.innerHTML = "";
    if (equipe.length === 0) {
        elementos.listaProfissionaisPainel.innerHTML = `<div class="empty-state"><h3>👥 Equipe Vazia</h3><p>Nenhum profissional na equipe ainda. Clique em "Convidar Funcionário" para começar.</p></div>`;
        return;
    }
    equipe.sort((a, b) => {
        if (a.ehDono && !b.ehDono) return -1;
        if (!a.ehDono && b.ehDono) return 1;
        return (a.nome || "").localeCompare(b.nome || "");
    }).forEach(profissional => {
        const div = document.createElement("div");
        div.className = "profissional-card";
        if (profissional.status === 'pendente') div.classList.add('pendente');
        
        let botoesDeAcao = '';
        if (profissional.status === 'pendente') {
            botoesDeAcao = `<button class="btn btn-success" onclick="ativarFuncionario('${profissional.id}')">✅ Ativar</button>
                            <button class="btn btn-danger" onclick="recusarFuncionario('${profissional.id}')">❌ Recusar</button>`;
        } else {
            botoesDeAcao = `<button class="btn btn-profile" onclick="abrirPerfilProfissional('${profissional.id}')">👤 Perfil</button>
                            <button class="btn btn-edit" onclick="editarProfissional('${profissional.id}')">✏️ Editar</button>
                            ${!profissional.ehDono ? `<button class="btn btn-danger" onclick="excluirProfissional('${profissional.id}')">🗑️ Excluir</button>` : ""}`;
        }

        div.innerHTML = `<div class="profissional-foto"><img src="${profissional.fotoUrl || "https://placehold.co/150x150/eef2ff/4f46e5?text=P"}" alt="Foto de ${profissional.nome}" onerror="this.src='https://placehold.co/150x150/eef2ff/4f46e5?text=P'"></div>
                         <div class="profissional-info">
                             <span class="profissional-nome">${profissional.nome}</span>
                             <span class="profissional-status">${profissional.status === 'pendente' ? 'Pendente de Ativação' : (profissional.ehDono ? 'Dono' : 'Funcionário')}</span>
                         </div>
                         <div class="profissional-actions">${botoesDeAcao}</div>`;
        elementos.listaProfissionaisPainel.appendChild(div);
    });
}

async function abrirPerfilProfissional(profissionalId) {
    try {
        const profissional = await carregarDadosProfissional(profissionalId);
        if (!profissional) {
            return mostrarErro("Não foi possível carregar os dados deste profissional.");
        }
        profissionalAtual = profissionalId;
        elementos.perfilNomeProfissional.textContent = `👤 Perfil de ${profissional.nome}`;
        renderizarServicosNoPerfil(profissional.servicos || []);
        agendaEspecial = profissional.agendaEspecial || [];
        renderizarAgendaEspecial();
        elementos.modalPerfilProfissional.classList.add('show');
    } catch (error) {
        console.error("Erro ao abrir perfil:", error);
        await showAlert("Erro", "Não foi possível abrir o perfil do profissional.");
    }
}

async function carregarDadosProfissional(profissionalId) {
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        const profissionalDoc = await getDoc(profissionalRef);
        if (!profissionalDoc.exists()) return null;
        const dados = profissionalDoc.data();
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId, "configuracoes", "horarios");
        const horariosDoc = await getDoc(horariosRef);
        if (horariosDoc.exists()) {
            renderizarHorarios(horariosDoc.data());
            if (elementos.permitirAgendamentoMultiplo) {
                elementos.permitirAgendamentoMultiplo.checked = horariosDoc.data().permitirAgendamentoMultiplo || false;
            }
        } else {
            renderizarHorarios({ ...horariosBase, intervalo: intervaloBase });
            if (elementos.permitirAgendamentoMultiplo) {
                elementos.permitirAgendamentoMultiplo.checked = false;
            }
        }
        return dados;
    } catch (error) {
        console.error("Erro ao carregar dados do profissional:", error);
        return null;
    }
}

function renderizarServicosNoPerfil(servicosSelecionados = []) {
    if(!elementos.servicosLista) return;
    elementos.servicosLista.innerHTML = "";
    if (servicosDisponiveis.length === 0) {
        elementos.servicosLista.innerHTML = `<div class="servicos-empty-state"><p>Nenhum serviço cadastrado.</p><p>Vá para a página de serviços para adicioná-los.</p></div>`;
        return;
    }
    servicosDisponiveis.forEach(servico => {
        const div = document.createElement("div");
        div.className = "servico-item";
        div.setAttribute('data-servico-id', servico.id);
        div.innerHTML = `<div class="servico-nome">${servico.nome}</div><div class="servico-preco">R$ ${Number(servico.preco || 0).toFixed(2)}</div>`;
        if (servicosSelecionados.includes(servico.id)) div.classList.add('selected');
        div.addEventListener('click', () => div.classList.toggle('selected'));
        elementos.servicosLista.appendChild(div);
    });
}

function renderizarHorarios(horariosDataCompleta = {}) {
    if(!elementos.horariosLista) return;
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
            <div class="dia-header"><label class="dia-nome">${dia.nome}</label><label class="switch"><input type="checkbox" class="toggle-dia" ${estaAtivo ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="horario-conteudo"><div class="horario-intervalos">${blocos.map(bloco => `<div class="horario-inputs"><input type="time" name="inicio" value="${bloco.inicio}"><span>até</span><input type="time" name="fim" value="${bloco.fim}"><button type="button" class="btn-remover-intervalo" title="Remover intervalo">✖</button></div>`).join('')}</div><button type="button" class="btn-incluir-intervalo">+ Incluir horário</button></div>`;
        horariosLista.appendChild(div);
    });
    horariosLista.querySelectorAll('.toggle-dia').forEach(toggle => toggle.addEventListener('change', function() { this.closest('.dia-horario').classList.toggle('inativo', !this.checked); }));
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
    if(!elementos.horariosLista) return;
    elementos.horariosLista.querySelectorAll('.btn-remover-intervalo').forEach(btn => {
        btn.onclick = async function () {
            const container = this.closest('.horario-intervalos');
            if (container.children.length > 1) {
                this.closest('.horario-inputs').remove();
            } else {
                await showAlert("Aviso", "Para desativar o dia, use o botão ao lado do nome do dia.");
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
    if (elementos.permitirAgendamentoMultiplo) {
        horarios.permitirAgendamentoMultiplo = elementos.permitirAgendamentoMultiplo.checked;
    }
    return horarios;
}

function renderizarAgendaEspecial() {
    if(!elementos.agendaEspecialLista) return;
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

async function adicionarAgendaEspecial() {
    if(!elementos.agendaTipo) return;
    const tipo = elementos.agendaTipo.value;
    if (tipo === 'mes') {
        if (!elementos.agendaMes.value) return await showAlert("Aviso", "Selecione o mês.");
        agendaEspecial.push({ tipo: 'mes', mes: elementos.agendaMes.value });
    } else {
        if (!elementos.agendaInicio.value || !elementos.agendaFim.value) return await showAlert("Aviso", "Informe o intervalo de datas.");
        agendaEspecial.push({ tipo: 'intervalo', inicio: elementos.agendaInicio.value, fim: elementos.agendaFim.value });
    }
    renderizarAgendaEspecial();
}

async function salvarPerfilProfissional() {
    try {
        const servicosSelecionados = Array.from(document.querySelectorAll('.servico-item.selected')).map(item => item.getAttribute('data-servico-id'));
        const horarios = coletarHorarios();
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual);
        await updateDoc(profissionalRef, { servicos: servicosSelecionados, agendaEspecial: agendaEspecial });
        const horariosRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual, "configuracoes", "horarios");
        await setDoc(horariosRef, horarios, { merge: true });
        if(elementos.modalPerfilProfissional) elementos.modalPerfilProfissional.classList.remove('show');
        await showAlert("Sucesso!", "Perfil atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        await showAlert("Erro", `Ocorreu um erro ao salvar o perfil: ${error.message}`);
    }
}

// ⭐ --- FUNÇÃO DE ADICIONAR LISTENERS CORRIGIDA --- ⭐
function adicionarEventListeners() {
    if (elementos.btnCancelarEquipe) elementos.btnCancelarEquipe.addEventListener("click", voltarMenuLateral);
    if (elementos.btnCancelarProfissional) elementos.btnCancelarProfissional.addEventListener("click", () => elementos.modalAddProfissional.classList.remove('show'));
    if (elementos.btnCancelarPerfil) elementos.btnCancelarPerfil.addEventListener("click", () => elementos.modalPerfilProfissional.classList.remove('show'));
    if (elementos.btnSalvarPerfil) elementos.btnSalvarPerfil.addEventListener("click", salvarPerfilProfissional);
    if (elementos.btnAgendaEspecial) elementos.btnAgendaEspecial.addEventListener('click', adicionarAgendaEspecial);
    if (elementos.btnConvite) elementos.btnConvite.addEventListener('click', gerarLinkDeConvite);

    [elementos.modalAddProfissional, elementos.modalPerfilProfissional].forEach(modal => {
        if(modal) modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove('show'); });
    });

    // O listener de submissão do formulário é adicionado APENAS UMA VEZ, aqui.
    if (elementos.formAddProfissional) {
        elementos.formAddProfissional.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Salvando...";
            }

            await salvarEdicaoProfissional();

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "💾 Salvar Profissional";
            }
        });
    }
}

async function gerarLinkDeConvite() {
    if (!empresaId) {
        return await showAlert("Erro", "Não foi possível identificar a sua empresa para gerar o convite.");
    }
    const baseUrl = window.location.origin;
    const conviteUrl = `${baseUrl}/convite.html?empresaId=${empresaId}`;
    try {
        await navigator.clipboard.writeText(conviteUrl);
        await showAlert("Sucesso!", "Link de convite copiado! Envie para o novo funcionário.");
    } catch (err) {
        console.error('Falha ao copiar: ', err);
        window.prompt("Copie o link abaixo:", conviteUrl);
    }
}

// ⭐ --- FUNÇÃO DE EDITAR SIMPLIFICADA --- ⭐
async function editarProfissional(profissionalId) {
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        const profissionalDoc = await getDoc(profissionalRef);
        if (profissionalDoc.exists()) {
            const dados = profissionalDoc.data();
            elementos.formAddProfissional.reset();
            elementos.nomeProfissional.value = dados.nome || "";
            elementos.tituloModalProfissional.textContent = "✏️ Editar Profissional";
            
            window.editandoProfissionalId = profissionalId; 
            elementos.modalAddProfissional.classList.add('show');
        }
    } catch (error) {
        await showAlert("Erro", `Erro ao buscar profissional: ${error.message}`);
    }
}

async function salvarEdicaoProfissional() {
    const profissionalId = window.editandoProfissionalId;
    if (!profissionalId) {
        return await showAlert("Erro", "ID do profissional não definido.");
    }

    const nome = elementos.nomeProfissional.value.trim();
    if (!nome) {
        return await showAlert("Erro", "O nome do profissional é obrigatório.");
    }

    try {
        const updateData = { nome };
        const fotoFile = elementos.fotoProfissional.files[0];
        
        if (fotoFile) {
            const usuarioLogadoId = auth.currentUser.uid;
            const caminhoStorage = `fotos-profissionais/${empresaId}/${profissionalId}/${Date.now()}-${fotoFile.name}`;
            const storageRef = ref(storage, caminhoStorage);
            const metadata = {
                customMetadata: {
                    'uploaderId': usuarioLogadoId,
                    'isOwnerUploading': isDono ? 'true' : 'false' 
                }
            };
            const snapshot = await uploadBytes(storageRef, fotoFile, metadata);
            updateData.fotoUrl = await getDownloadURL(snapshot.ref);
        }

        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await updateDoc(profissionalRef, updateData);

        elementos.modalAddProfissional.classList.remove('show');
        await showAlert("Sucesso!", "Profissional editado com sucesso!");

    } catch (error) {
        console.error("Erro ao salvar edição do profissional:", error);
        await showAlert("Erro", `Ocorreu um erro ao salvar a edição. Verifique suas permissões de segurança se o erro persistir.`);
    }
}


async function excluirProfissional(profissionalId) {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este profissional? Essa ação não pode ser desfeita.");
    if (!confirmado) return;
    
    if (!isDono) {
        return await showAlert("Acesso Negado", "Apenas donos podem excluir funcionários.");
    }

    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await deleteDoc(profissionalRef);
        await showAlert("Sucesso!", "Profissional excluído!");
    } catch (error) {
        await showAlert("Erro", `Erro ao excluir profissional: ${error.message}`);
    }
}

async function ativarFuncionario(profissionalId) {
    const confirmado = await showCustomConfirm("Confirmar Ativação", "Tem certeza que deseja ativar este profissional? Ele terá acesso ao sistema.");
    if(!confirmado) return;
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await updateDoc(profissionalRef, { status: 'ativo' });
        await showAlert("Sucesso!", "Profissional ativado com sucesso!");
    } catch (error) {
        console.error("Erro ao ativar profissional:", error);
        await showAlert("Erro", "Ocorreu um erro ao ativar o profissional.");
    }
}

async function recusarFuncionario(profissionalId) {
    const confirmado = await showCustomConfirm("Confirmar Recusa", "Tem certeza que deseja recusar e excluir este cadastro pendente?");
    if(!confirmado) return;
    await excluirProfissional(profissionalId); 
}

function mostrarErro(mensagem) {
    if(elementos.listaProfissionaisPainel) {
       elementos.listaProfissionaisPainel.innerHTML = `<div class="error-message"><h4>❌ Erro</h4><p>${mensagem}</p></div>`;
    }
}

// Tornar funções globais para uso no HTML (onclick)
window.abrirPerfilProfissional = abrirPerfilProfissional;
window.editarProfissional = editarProfissional;
window.excluirProfissional = excluirProfissional;
window.ativarFuncionario = ativarFuncionario;
window.recusarFuncionario = recusarFuncionario;

window.addEventListener("DOMContentLoaded", inicializar);
