/**
 * perfil.js (VERSÃO FINAL E COMPLETA - Integrado com o novo layout)
 *
 * Este script controla a página de perfil do empresário.
 * - Detecta se o usuário é novo e apresenta um formulário de cadastro.
 * - Carrega os dados de um usuário existente para edição.
 * - Salva todas as informações na estrutura de dados 'empresarios' no Firebase.
 * - Preserva a estrutura e o design do HTML/CSS fornecido.
 */

import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- Mapeamento de Elementos do DOM (Baseado no seu HTML final) ---
const elements = {
    h1Titulo: document.querySelector('.main-content h1'),
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
    btnLogout: document.getElementById('btn-logout')
};

const diasDaSemana = [
    { id: 'seg', nome: 'Segunda-feira' }, { id: 'ter', nome: 'Terça-feira' },
    { id: 'qua', nome: 'Quarta-feira' }, { id: 'qui', nome: 'Quinta-feira' },
    { id: 'sex', nome: 'Sexta-feira' }, { id: 'sab', nome: 'Sábado' },
    { id: 'dom', nome: 'Domingo' }
];

// --- Variáveis de Estado ---
let currentUser;
let empresaId = null;

// --- INICIALIZAÇÃO ---
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

/**
 * Lógica "Porteiro": Verifica se o usuário já tem uma empresa cadastrada.
 * Se tiver, carrega os dados para edição. Senão, prepara a página para o primeiro cadastro.
 */
async function verificarEcarregarDados(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // NOVO EMPRESÁRIO
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'none';
        if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'none';
    } else {
        // EMPRESÁRIO EXISTENTE
        const empresaDoc = snapshot.docs[0];
        empresaId = empresaDoc.id;
        const dadosEmpresa = empresaDoc.data();
        
        // O profissional a ser editado é o próprio dono (uid === profissionalId)
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
        const profissionalSnap = await getDoc(profissionalRef);
        const dadosProfissional = profissionalSnap.exists() ? profissionalSnap.data() : {};

        preencherFormulario(dadosEmpresa, dadosProfissional);
    }
}

/**
 * Preenche o formulário com os dados carregados do Firebase.
 */
function preencherFormulario(dadosEmpresa, dadosProfissional) {
    elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
    elements.descricaoInput.value = dadosEmpresa.descricao || '';
    if (dadosEmpresa.logoUrl) {
        elements.logoPreview.src = dadosEmpresa.logoUrl;
    }

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
                if (diaData?.ativo && diaData.blocos) {
                    diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
                } else if (diaData?.ativo) {
                    adicionarBlocoDeHorario(dia.id);
                }
            }
            toggleAtivo.dispatchEvent(new Event('change'));
        }
    });
    
    const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
    if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
    if (elements.btnAbrirVitrine) {
        elements.btnAbrirVitrine.href = urlCompleta;
        elements.btnAbrirVitrine.style.display = 'inline-flex';
    }
    if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
    if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'block';
}

/**
 * Lida com o envio do formulário, criando ou atualizando a empresa e o perfil profissional.
 */
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
            const empresaAtualRef = doc(db, "empresarios", empresaId);
            const empresaAtualSnap = await getDoc(empresaAtualRef);
            if (empresaAtualSnap.exists()) {
                dadosEmpresa.logoUrl = empresaAtualSnap.data().logoUrl || '';
            }
        }

        if (empresaId) { // Atualiza dados existentes
            const empresaRef = doc(db, "empresarios", empresaId);
            await setDoc(empresaRef, dadosEmpresa, { merge: true });
            
            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            const docOriginal = await getDoc(profissionalRef);
            dadosProfissional.servicos = docOriginal.exists() ? docOriginal.data().servicos || [] : [];
            await setDoc(profissionalRef, dadosProfissional, { merge: true });
            alert("Perfil atualizado com sucesso!");
        } else { // Cria nova empresa
            dadosProfissional.servicos = []; // Adiciona uma lista de serviços vazia no cadastro inicial
            const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
            empresaId = novaEmpresaRef.id;
            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            await setDoc(profissionalRef, dadosProfissional);
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

function coletarDadosDeHorarios() {
    const horariosData = { intervalo: parseInt(elements.intervaloSelect.value, 10) };
    diasDaSemana.forEach(dia => {
        const estaAtivo = document.getElementById(`${dia.id}-ativo`).checked;
        const blocos = [];
        if (estaAtivo) {
            document.querySelectorAll(`#blocos-${dia.id} .bloco-horario`).forEach(blocoEl => {
                const inputs = blocoEl.querySelectorAll('input[type="time"]');
                if (inputs[0].value && inputs[1].value) {
                    blocos.push({ inicio: inputs[0].value, fim: inputs[1].value });
                }
            });
        }
        horariosData[dia.id] = { ativo: estaAtivo, blocos: blocos };
    });
    return horariosData;
}

function adicionarListenersDeEvento() {
    elements.form.addEventListener('submit', handleFormSubmit);
    if(elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
    if (elements.btnUploadLogo && elements.logoInput) {
        elements.btnUploadLogo.addEventListener('click', () => elements.logoInput.click());
    }
    if(elements.logoInput) {
        elements.logoInput.addEventListener('change', () => {
            if (elements.logoInput.files && elements.logoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => { elements.logoPreview.src = e.target.result; };
                reader.readAsDataURL(elements.logoInput.files[0]);
            }
        });
    }
    if (elements.btnLogout) {
        elements.btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Erro no logout:", error);
                alert("Ocorreu um erro ao sair.");
            }
        });
    }
}

function copiarLink() {
    if (!empresaId) {
        alert("Salve seu perfil primeiro para gerar o link da sua vitrine.");
        return;
    }
    const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
    navigator.clipboard.writeText(urlCompleta).then(() => {
        alert("Link da vitrine copiado para a área de transferência!");
    });
}

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
            </div>
        `;
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
    elements.diasContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-add-slot')) {
            adicionarBlocoDeHorario(e.target.dataset.dia);
        }
    });
}

function adicionarBlocoDeHorario(diaId, inicio = '09:00', fim = '18:00') {
    const container = document.getElementById(`blocos-${diaId}`);
    const divBloco = document.createElement('div');
    divBloco.className = 'slot-horario';
    divBloco.innerHTML = `
        <input type="time" value="${inicio}">
        <span class="ate">até</span>
        <input type="time" value="${fim}">
        <button type="button" class="btn-remove-slot">Remover</button>
    `;
    container.appendChild(divBloco);
    
    divBloco.querySelector('.btn-remove-slot').addEventListener('click', (e) => {
        if (container.childElementCount > 1) {
            e.target.closest('.slot-horario').remove();
        } else {
            alert("Para não atender neste dia, desative o botão na parte superior.");
        }
    });
}
