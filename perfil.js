/**
 * perfil.js (VERSÃO FINAL E COMPLETA - COM LOGOUT INTEGRADO)
 *
 * Esta é a versão definitiva do painel do empresário.
 * Lógica Principal:
 * 1. Ao carregar, verifica se o usuário logado já possui uma empresa na coleção 'empresarios'.
 * 2. Se NÃO tiver, a página age como um formulário de CADASTRO.
 * 3. Se JÁ tiver, a página carrega os dados e age como um painel de EDIÇÃO.
 * 4. Salva e lê dados da estrutura `empresarios/{empresaId}/profissionais/{profissionalId}`.
 * 5. O link da vitrine é gerado automaticamente com o ID da empresa.
 * 6. Inclui a funcionalidade de logout no botão 'Sair'.
 */

import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
// [NOVO] Importa a função de logout
import { fazerLogout } from './vitrini-auth.js';

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- Elementos do DOM ---
const h1Titulo = document.querySelector('.main-content h1');
const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const descricaoInput = document.getElementById('descricao');
const logoInput = document.getElementById('logoNegocio');
const logoPreview = document.getElementById('logo-preview');
const btnUploadLogo = document.getElementById('btn-upload-logo');
const btnSalvar = form.querySelector('button[type="submit"]');
const btnCopiarLink = document.getElementById('btn-copiar-link');
const containerLinkVitrine = document.getElementById('container-link-vitrine');
const urlVitrineEl = document.getElementById('url-vitrine-display');
const intervaloSelect = document.getElementById('intervalo-atendimento');
const diasContainer = document.getElementById('dias-container');
const btnAbrirVitrine = document.getElementById('btn-abrir-vitrine');
const btnLogout = document.getElementById('btn-logout');

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
 * Lógica "Porteiro": Verifica se o usuário já tem uma empresa.
 */
async function verificarEcarregarDados(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // NOVO EMPRESÁRIO
        h1Titulo.textContent = "Crie seu Perfil de Negócio";
        btnAbrirVitrine.style.display = 'none';
        if (containerLinkVitrine) containerLinkVitrine.style.display = 'none';
        if (btnCopiarLink) btnCopiarLink.style.display = 'none';
    } else {
        // EMPRESÁRIO EXISTENTE
        const empresaDoc = snapshot.docs[0];
        empresaId = empresaDoc.id;
        const dadosEmpresa = empresaDoc.data();
        
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
    nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
    descricaoInput.value = dadosEmpresa.descricao || '';
    if (dadosEmpresa.logoUrl) {
        logoPreview.src = dadosEmpresa.logoUrl;
    }

    const horarios = dadosProfissional.horarios || {};
    intervaloSelect.value = horarios.intervalo || '30';
    diasDaSemana.forEach(dia => {
        const diaData = horarios[dia.id];
        const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
        const containerBlocos = document.getElementById(`blocos-${dia.id}`);
        if (toggleAtivo && containerBlocos) {
            toggleAtivo.checked = diaData ? diaData.ativo : false;
            containerBlocos.innerHTML = '';
            if (diaData && diaData.ativo && diaData.blocos) {
                diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
            } else if (diaData && diaData.ativo) {
                adicionarBlocoDeHorario(dia.id);
            }
            toggleAtivo.dispatchEvent(new Event('change'));
        }
    });
    
    const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
    if (urlVitrineEl) urlVitrineEl.textContent = urlCompleta;
    if (containerLinkVitrine) containerLinkVitrine.style.display = 'block';
    if (btnCopiarLink) btnCopiarLink.style.display = 'block';

    btnAbrirVitrine.href = urlCompleta;
    btnAbrirVitrine.style.display = 'inline-block';
}

/**
 * Lida com o envio do formulário, criando ou atualizando a empresa.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'A salvar...';

    try {
        const uid = currentUser.uid;
        const nomeNegocio = nomeNegocioInput.value.trim();
        if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

        const dadosEmpresa = {
            nomeFantasia: nomeNegocio,
            descricao: descricaoInput.value.trim(),
            donoId: uid
        };
        const dadosProfissional = {
            nome: currentUser.displayName || nomeNegocio,
            fotoUrl: currentUser.photoURL || '',
            horarios: coletarDadosDeHorarios()
        };

        const logoFile = logoInput.files[0];
        if (logoFile) {
            const storageRef = ref(storage, `logos/${uid}/logo`);
            const uploadResult = await uploadBytes(storageRef, logoFile);
            dadosEmpresa.logoUrl = await getDownloadURL(uploadResult.ref);
        }

        if (empresaId) {
            // ATUALIZA
            const empresaRef = doc(db, "empresarios", empresaId);
            await setDoc(empresaRef, dadosEmpresa, { merge: true });
            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            await setDoc(profissionalRef, dadosProfissional, { merge: true });
            alert("Perfil atualizado com sucesso!");
        } else {
            // CRIA
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
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Todas as Configurações';
    }
}

/**
 * Coleta os dados de horários do formulário.
 */
function coletarDadosDeHorarios() {
    const horariosData = { intervalo: parseInt(intervaloSelect.value, 10) };
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

// --- FUNÇÕES UTILITÁRIAS E DE UI (PRESERVADAS) ---

function adicionarListenersDeEvento() {
    form.addEventListener('submit', handleFormSubmit);
    if(btnCopiarLink) btnCopiarLink.addEventListener('click', copiarLink);
    if (btnUploadLogo && logoInput) {
        btnUploadLogo.addEventListener('click', () => logoInput.click());
    }
    if(logoInput) {
        logoInput.addEventListener('change', () => {
            if (logoInput.files && logoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => { logoPreview.src = e.target.result; };
                reader.readAsDataURL(logoInput.files[0]);
            }
        });
    }

    // [NOVO] Adiciona o listener para o botão de logout
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            fazerLogout();
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
    if (!diasContainer) return;
    diasContainer.innerHTML = '';
    diasDaSemana.forEach(dia => {
        const divDia = document.createElement('div');
        divDia.className = 'dia-semana';
        divDia.innerHTML = `
            <div class="dia-semana-header">
                <span class="dia-semana-nome">${dia.nome}</span>
                <div class="toggle-atendimento">
                    <label class="switch">
                        <input type="checkbox" id="${dia.id}-ativo">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="horarios-container" id="container-${dia.id}" style="display: none;">
                <div class="horarios-blocos" id="blocos-${dia.id}"></div>
                <button type="button" class="btn-adicionar-bloco" data-dia="${dia.id}">+ Adicionar Horário</button>
            </div>
        `;
        diasContainer.appendChild(divDia);
        
        const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
        toggleAtivo.addEventListener('change', (e) => {
            const container = document.getElementById(`container-${dia.id}`);
            container.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked && container.querySelector('.horarios-blocos').childElementCount === 0) {
                adicionarBlocoDeHorario(dia.id);
            }
        });
    });
    diasContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-adicionar-bloco')) {
            adicionarBlocoDeHorario(e.target.dataset.dia);
        }
    });
}

function adicionarBlocoDeHorario(diaId, inicio = '09:00', fim = '18:00') {
    const container = document.getElementById(`blocos-${diaId}`);
    const divBloco = document.createElement('div');
    divBloco.className = 'bloco-horario';
    divBloco.innerHTML = `
        <input type="time" value="${inicio}">
        <span>até</span>
        <input type="time" value="${fim}">
        <button type="button" class="btn-remover-bloco">-</button>
    `;
    container.appendChild(divBloco);
    
    divBloco.querySelector('.btn-remover-bloco').addEventListener('click', (e) => {
        if (container.childElementCount > 1) {
            e.target.closest('.bloco-horario').remove();
        } else {
            alert("Para não atender neste dia, desative o botão na parte superior.");
        }
    });
}
