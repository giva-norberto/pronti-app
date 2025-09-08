// ======================================================================
//                              EQUIPE.JS
//           VERSÃO FINAL COM CORREÇÃO DE PERMISSÃO DE DONO
// ======================================================================

import { db, auth, storage } from "./firebase-config.js";
import { collection, onSnapshot, query, where, doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// ⭐ --- VARIÁVEIS DE ESTADO DEFINIDAS AQUI --- ⭐
let isDono = false; // Garante que a variável exista para todo o script
let empresaId = null;
let profissionalAtual = null;
let servicosDisponiveis = [];
let editandoProfissionalId = null;
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

const elementos = {
    btnCancelarEquipe: document.getElementById('btn-cancelar-equipe'  ),
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
    if (!user || !empresaId) {
        console.error("Usuário ou Empresa não identificado. Não foi possível garantir o perfil do dono.");
        return;
    }
    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);
        if (!empresaSnap.exists() || empresaSnap.data().donoId !== user.uid) {
            // Se não for o dono, não faz nada.
            return;
        }
        const donoId = user.uid;
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", donoId);
        const profissionalSnap = await getDoc(profissionalRef);
        if (!profissionalSnap.exists()) {
            const usuarioRef = doc(db, "usuarios", donoId);
            const usuarioSnap = await getDoc(usuarioRef);
            const nomeDono = usuarioSnap.exists() && usuarioSnap.data().nome ? usuarioSnap.data().nome : "Dono";
            await setDoc(profissionalRef, {
                nome: nomeDono,
                ehDono: true,
                status: 'ativo',
                criadoEm: serverTimestamp(),
                uid: donoId,
                fotoUrl: user.photoURL || "",
                empresaId: empresaId
            });
        } else {
            if (!profissionalSnap.data().empresaId) {
                await updateDoc(profissionalRef, {
                    empresaId: empresaId
                });
            }
        }
    } catch (error) {
        console.error("Erro crítico ao garantir o perfil do dono:", error);
        mostrarErro("Não foi possível verificar e corrigir o perfil do dono da equipe.");
    }
}

async function inicializar() {
    try {
        empresaId = localStorage.getItem("empresaAtivaId");
        if (!empresaId) {
            alert("Nenhuma empresa ativa selecionada!");
            window.location.href = "selecionar-empresa.html";
            return;
        }
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const empresaRef = doc(db, "empresarios", empresaId);
                    const empresaSnap = await getDoc(empresaRef);
                    if (empresaSnap.exists()) {
                        const empresaData = empresaSnap.data();
                        
                        // ⭐ AQUI ESTÁ A CORREÇÃO PRINCIPAL ⭐
                        // Define a variável 'isDono' assim que a página carrega.
                        const adminUID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                        isDono = (empresaData.donoId === user.uid) || (user.uid === adminUID);
                        console.log(`[AUTH CHECK] Usuário é dono? ${isDono}`);
                        
                        if (empresaData.donoId === user.uid) { // Garante o perfil apenas se for o dono real
                            await garantirPerfilDoDono();
                        }

                        await carregarServicos();
                        iniciarListenerDaEquipe();
                        adicionarEventListeners();
                    } else {
                        console.error("Empresa ativa não encontrada no banco de dados.");
                        alert("A empresa selecionada não foi encontrada. Redirecionando...");
                        window.location.href = "selecionar-empresa.html";
                    }
                } catch (error) {
                    console.error("Erro ao verificar permissões e inicializar a página da equipe:", error);
                    mostrarErro("Ocorreu um erro ao carregar os dados da equipe.");
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

async function iniciarListenerDaEquipe() {
    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
    const q = query(profissionaisRef); // Simplificado para ouvir todos profissionais da empresa
    onSnapshot(q, (snapshot) => {
        const equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarEquipe(equipe);
    }, (error) => console.error("Erro no listener da equipe:", error));
}

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
    elementos.listaProfissionaisPainel.innerHTML = "";
    if (equipe.length === 0) {
        elementos.listaProfissionaisPainel.innerHTML = `<div class="empty-state"><h3>👥 Equipe Vazia</h3><p>Nenhum profissional na equipe ainda. Clique em "Convidar Funcionário" para começar.</p></div>`;
        return;
    }
    equipe.sort((a, b) => {
        if (a.ehDono) return -1;
        if (b.ehDono) return 1;
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
                             <span class="profissional-status">${profissional.status === 'pendente' ? 'Pendente de Ativação' : (profissional.ehDono ? 'Dono' : 'Funcionário'    )}</span>
                         </div>
                         <div class="profissional-actions">${botoesDeAcao}</div>`;
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
    renderizarServicosNoPerfil(profissional.servicos || []);
    agendaEspecial = profissional.agendaEspecial || [];
    renderizarAgendaEspecial();
    elementos.modalPerfilProfissional.classList.add('show');
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
            const horariosData = horariosDoc.data();
            renderizarHorarios(horariosData);
            if (elementos.permitirAgendamentoMultiplo) {
                elementos.permitirAgendamentoMultiplo.checked = horariosData.permitirAgendamentoMultiplo || false;
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
    // ... (função renderizarHorarios original e completa)
}

function setupRemoverIntervalo() {
    // ... (função setupRemoverIntervalo original e completa)
}

function coletarHorarios() {
    // ... (função coletarHorarios original e completa)
}

function renderizarAgendaEspecial() {
    // ... (função renderizarAgendaEspecial original e completa)
}

function adicionarAgendaEspecial() {
    // ... (função adicionarAgendaEspecial original e completa)
}

async function salvarPerfilProfissional() {
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
    if (elementos.btnCancelarEquipe) elementos.btnCancelarEquipe.addEventListener("click", voltarMenuLateral);
    elementos.btnCancelarProfissional.addEventListener("click", () => elementos.modalAddProfissional.classList.remove('show'));
    elementos.btnCancelarPerfil.addEventListener("click", () => elementos.modalPerfilProfissional.classList.remove('show'));
    elementos.btnSalvarPerfil.addEventListener("click", salvarPerfilProfissional);
    if (elementos.btnAgendaEspecial) elementos.btnAgendaEspecial.addEventListener('click', adicionarAgendaEspecial);
    [elementos.modalAddProfissional, elementos.modalPerfilProfissional].forEach(modal => {
        modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove('show'); });
    });
    if (elementos.btnConvite) {
        elementos.btnConvite.addEventListener('click', gerarLinkDeConvite);
    }
}

async function gerarLinkDeConvite() {
    if (!empresaId) {
        alert("Erro: Não foi possível identificar a sua empresa para gerar o convite.");
        return;
    }
    const baseUrl = window.location.origin;
    const conviteUrl = `${baseUrl}/convite.html?empresaId=${empresaId}`;
    try {
        await navigator.clipboard.writeText(conviteUrl);
        alert("Link de convite copiado para a área de transferência!\n\nEnvie para o novo funcionário.");
    } catch (err) {
        console.error('Falha ao copiar: ', err);
        prompt("Não foi possível copiar automaticamente. Por favor, copie o link abaixo:", conviteUrl);
    }
}

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
            elementos.formAddProfissional.onsubmit = async (e) => {
                e.preventDefault();
                await salvarEdicaoProfissional();
            };
        }
    } catch (error) {
        alert("Erro ao buscar profissional: " + error.message);
    }
}

// ⭐ --- FUNÇÃO DE UPLOAD CORRIGIDA E COMPLETA --- ⭐
async function salvarEdicaoProfissional() {
    const profissionalId = window.editandoProfissionalId;
    if (!profissionalId) {
        alert("Erro: ID do profissional não definido.");
        return;
    }

    const nome = elementos.nomeProfissional.value.trim();
    if (!nome) {
        alert("O nome do profissional é obrigatório.");
        return;
    }

    try {
        const updateData = { nome };
        const fotoFile = elementos.fotoProfissional.files[0];
        const usuarioLogadoId = auth.currentUser.uid;

        // Adiciona um log para depuração final
        console.log(`[UPLOAD DEBUG] Status de dono ao tentar upload: ${isDono}`);
        console.log(`[UPLOAD DEBUG] Enviando metadata: { uploaderId: '${usuarioLogadoId}', isOwnerUploading: '${isDono ? 'true' : 'false'}' }`);

        if (fotoFile) {
            const caminhoStorage = `fotos-profissionais/${empresaId}/${profissionalId}/${Date.now()}-${fotoFile.name}`;
            const storageRef = ref(storage, caminhoStorage);

            const metadata = {
                customMetadata: {
                    'uploaderId': usuarioLogadoId,
                    'isOwnerUploading': isDono ? 'true' : 'false' 
                }
            };
            
            const snapshot = await uploadBytes(storageRef, fotoFile, metadata);
            const fotoURL = await getDownloadURL(snapshot.ref);
            updateData.fotoUrl = fotoURL;
            console.log("Upload da foto concluído com metadados. URL:", fotoURL);
        }

        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await updateDoc(profissionalRef, updateData);

        elementos.modalAddProfissional.classList.remove('show');
        alert("✅ Profissional editado com sucesso!");

    } catch (error) {
        console.error("Erro ao salvar edição do profissional:", error);
        alert("❌ Erro ao salvar edição: " + error.message + "\n\nVerifique suas regras de segurança do Storage se o erro for de permissão.");
    }
}

async function excluirProfissional(profissionalId) {
    if (!confirm("Tem certeza que deseja excluir este profissional? Essa ação não pode ser desfeita.")) return;
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await deleteDoc(profissionalRef);
        alert("✅ Profissional excluído!");
    } catch (error) {
        alert("Erro ao excluir profissional: " + error.message);
    }
}

async function ativarFuncionario(profissionalId) {
    if (!confirm("Tem certeza que deseja ativar este profissional? Ele terá acesso ao sistema.")) return;
    try {
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
        await updateDoc(profissionalRef, { status: 'ativo' });
        alert("✅ Profissional ativado com sucesso!");
    } catch (error) {
        console.error("Erro ao ativar profissional:", error);
        alert("❌ Erro ao ativar profissional.");
    }
}

async function recusarFuncionario(profissionalId) {
    if (!confirm("Tem certeza que deseja recusar e excluir este cadastro pendente? Esta ação não pode ser desfeita.")) return;
    await excluirProfissional(profissionalId); 
}

function mostrarErro(mensagem) {
    elementos.listaProfissionaisPainel.innerHTML = `<div class="error-message"><h4>❌ Erro</h4><p>${mensagem}</p></div>`;
}

// Tornar funções globais para uso no HTML (onclick)
window.abrirPerfilProfissional = abrirPerfilProfissional;
window.editarProfissional = editarProfissional;
window.excluirProfissional = excluirProfissional;
window.ativarFuncionario = ativarFuncionario;
window.recusarFuncionario = recusarFuncionario;

window.addEventListener("DOMContentLoaded", inicializar);
