/**
 * perfil.js (VERSÃO FINAL E COMPLETA - COM GERENCIAMENTO DE EQUIPE E CORREÇÕES)
 */

import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app );
const auth = getAuth(app);
const storage = getStorage(app);

// Mapeamento dos elementos do DOM para fácil acesso
const elements = {
    h1Titulo: document.getElementById('main-title'),
    form: document.getElementById('form-perfil'),
    nomeNegocioInput: document.getElementById('nomeNegocio'),
    descricaoInput: document.getElementById('descricao'),
    logoInput: document.getElementById('logoNegocio'),
    logoPreview: document.getElementById('logo-preview'),
    btnUploadLogo: document.getElementById('btn-upload-logo'),
    btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
    btnCopiarLink: document.getElementById('btn-copiar-link'),
    containerLinkVitrine: document.getElementById('container-link-vitrine'),
    urlVitrineEl: document.getElementById('url-vitrine-display'),
    intervaloSelect: document.getElementById('intervalo-atendimento'),
    diasContainer: document.getElementById('dias-container'),
    btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
    btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
    btnLogout: document.getElementById('btn-logout'),
    listaProfissionaisPainel: document.getElementById('lista-profissionais-painel'),
    btnAddProfissional: document.getElementById('btn-add-profissional'),
    modalAddProfissional: document.getElementById('modal-add-profissional'),
    formAddProfissional: document.getElementById('form-add-profissional'),
    btnCancelarProfissional: document.getElementById('btn-cancelar-profissional')
};

const diasDaSemana = [
    { id: 'seg', nome: 'Segunda-feira' }, { id: 'ter', nome: 'Terça-feira' },
    { id: 'qua', nome: 'Quarta-feira' }, { id: 'qui', nome: 'Quinta-feira' },
    { id: 'sex', nome: 'Sexta-feira' }, { id: 'sab', nome: 'Sábado' },
    { id: 'dom', nome: 'Domingo' }
];

let currentUser;
let empresaId = null; // Armazena o ID do documento da empresa

// Observador de autenticação: Roda quando a página carrega e o estado do usuário é verificado
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        verificarEcarregarDados(user.uid);
        adicionarListenersDeEvento();
        gerarEstruturaDosDias();
    } else {
        window.location.href = 'login.html';
    }
});

// Carrega os dados da empresa e do profissional (dono)
async function verificarEcarregarDados(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    const secaoEquipe = elements.btnAddProfissional?.closest('.form-section');

    if (snapshot.empty) {
        // Se não tem empresa, prepara a UI para criação
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'none';
        if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'none';
        if (secaoEquipe) secaoEquipe.style.display = 'none'; // Esconde a seção de equipe
    } else {
        // Se já tem empresa, carrega os dados
        const empresaDoc = snapshot.docs[0];
        empresaId = empresaDoc.id; // Guarda o ID da empresa
        const dadosEmpresa = empresaDoc.data();
        
        // Busca os dados do profissional (que é o dono)
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
        const profissionalSnap = await getDoc(profissionalRef);
        const dadosProfissional = profissionalSnap.exists() ? profissionalSnap.data() : {};

        preencherFormulario(dadosEmpresa, dadosProfissional);
        if (secaoEquipe) secaoEquipe.style.display = 'block'; // Mostra a seção de equipe
        renderizarListaProfissionais(empresaId);
    }
}

// Mostra a lista de profissionais na tela
async function renderizarListaProfissionais(idDaEmpresa) {
    if (!elements.listaProfissionaisPainel) return;
    elements.listaProfissionaisPainel.innerHTML = `<p>Carregando equipe...</p>`;
    const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");
    const snapshot = await getDocs(profissionaisRef);

    if (snapshot.empty) {
        elements.listaProfissionaisPainel.innerHTML = `<p>Nenhum profissional na equipe ainda.</p>`;
        return;
    }
    elements.listaProfissionaisPainel.innerHTML = snapshot.docs.map(doc => {
        const profissional = doc.data();
        return `<div class="profissional-card">
                    <img src="${profissional.fotoUrl || 'https://placehold.co/40x40/eef2ff/4f46e5?text=P'}" alt="Foto de ${profissional.nome}">
                    <span class="profissional-nome">${profissional.nome}</span>
                </div>`;
    } ).join('');
}

// Preenche o formulário com os dados do Firebase
function preencherFormulario(dadosEmpresa, dadosProfissional) {
    elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
    elements.descricaoInput.value = dadosEmpresa.descricao || '';
    if (dadosEmpresa.logoUrl) elements.logoPreview.src = dadosEmpresa.logoUrl;

    const horarios = dadosProfissional.horarios || {};
    elements.intervaloSelect.value = horarios.intervalo || '30';
    diasDaSemana.forEach(dia => {
        const diaData = horarios[dia.id];
        const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
        if (toggleAtivo) {
            toggleAtivo.checked = diaData ? diaData.ativo : false;
            const containerBlocos = document.getElementById(`blocos-${dia.id}`);
            if (containerBlocos) {
                containerBlocos.innerHTML = '';
                if (diaData?.ativo && diaData.blocos?.length > 0) {
                    diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
                } else if (diaData?.ativo) {
                    adicionarBlocoDeHorario(dia.id);
                }
            }
            toggleAtivo.dispatchEvent(new Event('change'));
        }
    });
    
    const urlCompleta = `${window.location.origin}/vitrine.html?id=${empresaId}`;
    if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
    if (elements.btnAbrirVitrine) {
        elements.btnAbrirVitrine.href = urlCompleta;
        elements.btnAbrirVitrine.style.display = 'inline-flex';
    }
    if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
    if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'block';
}

// Lida com o salvamento do formulário principal
async function handleFormSubmit(event) {
    event.preventDefault();
    elements.btnSalvar.disabled = true;
    elements.btnSalvar.textContent = 'Salvando...';
    try {
        const uid = currentUser.uid;
        const nomeNegocio = elements.nomeNegocioInput.value.trim();
        if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

        const dadosEmpresa = {
            nomeFantasia: nomeNegocio,
            descricao: elements.descricaoInput.value.trim(),
            donoId: uid
        };
        const dadosProfissional = {
            nome: currentUser.displayName || nomeNegocio,
            fotoUrl: currentUser.photoURL || '',
            horarios: coletarDadosDeHorarios(),
        };

        const logoFile = elements.logoInput.files[0];
        if (logoFile) {
            const storageRef = ref(storage, `logos/${uid}/logo`);
            const uploadResult = await uploadBytes(storageRef, logoFile);
            dadosEmpresa.logoUrl = await getDownloadURL(uploadResult.ref);
        } else if (empresaId) {
            const empresaAtualSnap = await getDoc(doc(db, "empresarios", empresaId));
            if (empresaAtualSnap.exists()) dadosEmpresa.logoUrl = empresaAtualSnap.data().logoUrl || '';
        }

        if (empresaId) {
            await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            const docOriginal = await getDoc(profissionalRef);
            dadosProfissional.servicos = docOriginal.exists() ? docOriginal.data().servicos || [] : [];
            await setDoc(profissionalRef, dadosProfissional, { merge: true });
            alert("Perfil atualizado com sucesso!");
        } else {
            dadosProfissional.servicos = [];
            const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
            empresaId = novaEmpresaRef.id;
            await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional);
            alert("Seu negócio foi cadastrado com sucesso!");
            window.location.reload();
        }
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Ocorreu um erro ao salvar: " + error.message);
    } finally {
        elements.btnSalvar.disabled = false;
        elements.btnSalvar.textContent = 'Salvar Todas as Configurações';
    }
}

// Coleta os horários do formulário
function coletarDadosDeHorarios() {
    const horariosData = { intervalo: parseInt(elements.intervaloSelect.value, 10) };
    diasDaSemana.forEach(dia => {
        const estaAtivo = document.getElementById(`${dia.id}-ativo`).checked;
        const blocos = [];
        if (estaAtivo) {
            document.querySelectorAll(`#blocos-${dia.id} .slot-horario`).forEach(blocoEl => {
                const inputs = blocoEl.querySelectorAll('input[type="time"]');
                if (inputs[0].value && inputs[1].value) blocos.push({ inicio: inputs[0].value, fim: inputs[1].value });
            });
        }
        horariosData[dia.id] = { ativo: estaAtivo, blocos: blocos };
    });
    return horariosData;
}

// Configura todos os "ouvintes de eventos" da página
function adicionarListenersDeEvento() {
    elements.form.addEventListener('submit', handleFormSubmit);
    if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
    if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput.click());
    if (elements.logoInput) elements.logoInput.addEventListener('change', () => {
        if (elements.logoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => { elements.logoPreview.src = e.target.result; };
            reader.readAsDataURL(elements.logoInput.files[0]);
        }
    });
    if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
        try { await signOut(auth); window.location.href = 'login.html'; }
        catch (error) { console.error("Erro no logout:", error); alert("Ocorreu um erro ao sair."); }
    });

    // Eventos do Modal de Adicionar Profissional
    if (elements.btnAddProfissional) elements.btnAddProfissional.addEventListener('click', () => {
        if (!empresaId) {
            alert("Você precisa salvar as configurações do seu negócio antes de adicionar um funcionário.");
            return;
        }
        if (elements.formAddProfissional) elements.formAddProfissional.reset();
        if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'flex';
    });

    if (elements.btnCancelarProfissional) elements.btnCancelarProfissional.addEventListener('click', () => {
        if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
    });

    // [CORREÇÃO] Lógica para salvar o novo profissional
    if (elements.formAddProfissional) elements.formAddProfissional.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Salvando...';
        try {
            const nome = document.getElementById('nome-profissional').value.trim();
            const fotoFile = document.getElementById('foto-profissional').files[0];
            if (!nome) throw new Error("O nome do profissional é obrigatório.");

            let fotoUrl = '';
            if (fotoFile) {
                const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
                const uploadResult = await uploadBytes(storageRef, fotoFile);
                fotoUrl = await getDownloadURL(uploadResult.ref);
            }
            
            // Cria um objeto com os dados básicos do novo profissional
            const novoProfissional = { 
                nome, 
                fotoUrl, 
                servicos: [], // Começa sem serviços
                horarios: {}  // Começa sem horários definidos
            };
            
            // Adiciona o novo profissional na subcoleção 'profissionais' da empresa atual
            await addDoc(collection(db, "empresarios", empresaId, "profissionais"), novoProfissional);

            alert("Profissional adicionado com sucesso!");
            if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
            renderizarListaProfissionais(empresaId); // Atualiza a lista na tela
        } catch (error) {
            console.error("Erro ao adicionar profissional:", error);
            alert("Erro ao adicionar profissional: " + error.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Salvar Profissional';
        }
    });
}

// Copia o link da vitrine para a área de transferência
function copiarLink() {
    if (!empresaId) return alert("Salve seu perfil para gerar o link.");
    const urlCompleta = `${window.location.origin}/vitrine.html?id=${empresaId}`;
    navigator.clipboard.writeText(urlCompleta).then(() => alert("Link da vitrine copiado!"));
}

// Gera a estrutura HTML para os dias da semana
function gerarEstruturaDosDias() {
    if (!elements.diasContainer) return;
    elements.diasContainer.innerHTML = '';
    diasDaSemana.forEach(dia => {
        const divDia = document.createElement('div');
        divDia.className = 'dia-semana';
        divDia.innerHTML = `
            <div class="dia-info">
                <span class="dia-nome">${dia.nome}</span>
                <div class="toggle-container">
                    <label class="switch">
                        <input type="checkbox" id="${dia.id}-ativo">
                        <span class="slider"></span>
                    </label>
                    <span class="toggle-label">Fechado</span>
                </div>
            </div>
            <div class="horarios-container" style="display: none;" id="container-${dia.id}">
                <div class="horarios-blocos" id="blocos-${dia.id}"></div>
                <button type="button" class="btn-add-slot" data-dia="${dia.id}">+ Adicionar Horário</button>
            </div>`;
        elements.diasContainer.appendChild(divDia);
        
        const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
        toggleAtivo.addEventListener('change', (e) => {
            const container = document.getElementById(`container-${dia.id}`);
            const label = e.target.closest('.toggle-container').querySelector('.toggle-label');
            container.style.display = e.target.checked ? 'flex' : 'none';
            label.textContent = e.target.checked ? 'Aberto' : 'Fechado';
            if (e.target.checked && container.querySelector('.horarios-blocos').childElementCount === 0) {
                adicionarBlocoDeHorario(dia.id);
            }
        });
    });
    elements.diasContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-add-slot')) {
            adicionarBlocoDeHorario(e.target.dataset.dia);
        }
    });
}

// Adiciona um bloco de horário para um dia específico
function adicionarBlocoDeHorario(diaId, inicio = '09:00', fim = '18:00') {
    const container = document.getElementById(`blocos-${diaId}`);
    const divBloco = document.createElement('div');
    divBloco.className = 'slot-horario';
    divBloco.innerHTML = `
        <input type="time" value="${inicio}">
        <span class="ate">até</span>
        <input type="time" value="${fim}">
        <button type="button" class="btn-remove-slot">Remover</button>`;
    container.appendChild(divBloco);
    divBloco.querySelector('.btn-remove-slot').addEventListener('click', (e) => {
        if (container.childElementCount > 1) {
            e.target.closest('.slot-horario').remove();
        } else {
            alert("Para não atender neste dia, desative o botão na parte superior.");
        }
    });
}
