/**
 * perfil.js (Versão Final Otimizada)
 * - Validação de slug único
 * - Estrutura de múltiplos horários por dia
 * - Otimização da estrutura de dados no Firestore
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- Elementos do DOM ---
const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
const slugFeedbackEl = document.createElement('div'); // Feedback para o slug
const descricaoInput = document.getElementById('descricao');
const logoInput = document.getElementById('logoNegocio');
const logoPreview = document.getElementById('logo-preview');
const btnSalvar = form.querySelector('button[type="submit"]');
const btnCopiarLink = document.getElementById('btn-copiar-link');
const urlBaseEl = document.getElementById('url-base');
const intervaloSelect = document.getElementById('intervalo-atendimento');
const diasContainer = document.getElementById('dias-container');

const diasDaSemana = [
    { id: 'seg', nome: 'Segunda-feira' }, { id: 'ter', nome: 'Terça-feira' },
    { id: 'qua', nome: 'Quarta-feira' }, { id: 'qui', nome: 'Quinta-feira' },
    { id: 'sex', nome: 'Sexta-feira' }, { id: 'sab', nome: 'Sábado' },
    { id: 'dom', nome: 'Domingo' }
];

let uid;
let slugOriginal = ''; // Para saber se o slug foi alterado

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        uid = user.uid;
        gerarEstruturaDosDias();
        carregarTodosOsDados(uid);
        adicionarListenersDeEvento();
        if (urlBaseEl) {
            urlBaseEl.textContent = `${window.location.origin}/vitrine.html?slug=`;
        }
    } else {
        window.location.href = 'login.html';
    }
});

function adicionarListenersDeEvento() {
    slugInput.insertAdjacentElement('afterend', slugFeedbackEl);
    nomeNegocioInput.addEventListener('keyup', () => {
        slugInput.value = gerarSlug(nomeNegocioInput.value);
    });
    form.addEventListener('submit', handleFormSubmit);
    btnCopiarLink.addEventListener('click', copiarLink);
    logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) logoPreview.src = URL.createObjectURL(file);
    });
}

// --- LÓGICA DE CARREGAMENTO DE DADOS ---
async function carregarTodosOsDados(userId) {
    await Promise.all([
        carregarDadosDoPerfil(userId),
        carregarHorarios(userId)
    ]);
}

async function carregarDadosDoPerfil(userId) {
    try {
        const perfilRef = doc(db, "users", userId, "publicProfile", "profile");
        const docSnap = await getDoc(perfilRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            nomeNegocioInput.value = data.nomeNegocio || '';
            slugInput.value = data.slug || '';
            slugOriginal = data.slug || ''; // Guarda o slug original
            descricaoInput.value = data.descricao || '';
            if (data.logoUrl) logoPreview.src = data.logoUrl;
        }
    } catch (error) { console.error("Erro ao carregar perfil:", error); }
}

async function carregarHorarios(userId) {
    try {
        const horariosRef = doc(db, "users", userId, "configuracoes", "horarios");
        const docSnap = await getDoc(horariosRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            intervaloSelect.value = data.intervalo || '30';
            diasDaSemana.forEach(dia => {
                const diaData = data[dia.id];
                const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
                const containerBlocos = document.getElementById(`blocos-${dia.id}`);
                
                if (diaData) {
                    toggleAtivo.checked = diaData.ativo;
                    // Limpa o bloco padrão antes de adicionar os salvos
                    containerBlocos.innerHTML = ''; 
                    
                    if (diaData.ativo && diaData.blocos && diaData.blocos.length > 0) {
                        diaData.blocos.forEach(bloco => {
                            adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim);
                        });
                    } else if (diaData.ativo) {
                        // Se estiver ativo mas sem blocos, adiciona um padrão
                        adicionarBlocoDeHorario(dia.id);
                    }
                }
                // Dispara o evento para mostrar/esconder o container corretamente
                toggleAtivo.dispatchEvent(new Event('change'));
            });
        }
    } catch (error) { console.error("Erro ao carregar horários:", error); }
}

// --- LÓGICA DE SALVAMENTO DE DADOS ---
async function handleFormSubmit(event) {
    event.preventDefault();
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'A verificar URL...';
    slugFeedbackEl.textContent = '';

    const slugAtual = slugInput.value.trim();
    if (!slugAtual) {
        alert("A URL da vitrine (slug) é obrigatória.");
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Todas as Configurações';
        return;
    }
    
    try {
        const slugDisponivel = await verificarDisponibilidadeSlug(slugAtual);
        if (!slugDisponivel) {
            throw new Error(`A URL "${slugAtual}" já está em uso. Por favor, escolha outra.`);
        }

        btnSalvar.textContent = 'A salvar...';
        await salvarDadosDoPerfil(slugAtual);
        await salvarHorarios();
        
        if (slugOriginal && slugOriginal !== slugAtual) {
            const batch = writeBatch(db);
            const slugAntigoRef = doc(db, "slugs", slugOriginal);
            batch.delete(slugAntigoRef);
            await batch.commit();
        }
        slugOriginal = slugAtual;

        // ***** ÚNICA ALTERAÇÃO ESTÁ NESTA LINHA *****
        localStorage.setItem('prontiUserSlug', slugAtual);
        
        alert("Todas as configurações foram salvas com sucesso!");

    } catch (error) {
        console.error("ERRO GERAL AO SALVAR:", error);
        slugFeedbackEl.textContent = error.message;
        slugFeedbackEl.style.color = 'red';
        alert("Ocorreu um erro ao salvar: " + error.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Todas as Configurações';
    }
}

async function verificarDisponibilidadeSlug(slug) {
    if (slug === slugOriginal) {
        return true;
    }
    const slugRef = doc(db, "slugs", slug);
    const docSnap = await getDoc(slugRef);
    return !docSnap.exists();
}

async function salvarDadosDoPerfil(slug) {
    const nomeNegocio = nomeNegocioInput.value.trim();
    const logoFile = logoInput.files[0];

    if (!nomeNegocio) throw new Error("Nome do negócio é obrigatório.");

    let logoUrl = logoPreview.src.startsWith('https://') ? logoPreview.src : null;
    if (logoFile) {
        const storageRef = ref(storage, `logos/${uid}/${slug}-${logoFile.name}`);
        const uploadResult = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(uploadResult.ref);
    }
  
    const perfilData = {
        nomeNegocio,
        slug,
        descricao: descricaoInput.value.trim(),
        logoUrl,
        ownerId: uid
    };

    const batch = writeBatch(db);
    const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
    batch.set(perfilPrivadoRef, perfilData, { merge: true });
    const slugPublicoRef = doc(db, "slugs", slug);
    batch.set(slugPublicoRef, { uid: uid });
    await batch.commit();
}

async function salvarHorarios() {
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
    const horariosRef = doc(db, "users", uid, "configuracoes", "horarios");
    await setDoc(horariosRef, horariosData);
}

function gerarSlug(texto) {
    if (!texto) return "";
    return texto.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

function copiarLink() {
    const slug = slugInput.value.trim();
    if (!slug) { alert("Preencha o campo 'URL da sua Vitrine' para poder copiar o link."); return; }
    const urlCompleta = `${window.location.origin}/vitrine.html?slug=${slug}`;
    navigator.clipboard.writeText(urlCompleta).then(() => {
        alert("Link da vitrine copiado para a área de transferência!");
    });
}

function gerarEstruturaDosDias() {
    diasContainer.innerHTML = '';
    diasDaSemana.forEach(dia => {
        const divDia = document.createElement('div');
        divDia.className = 'dia-semana';
        divDia.innerHTML = `
            <div class="dia-semana-header">
                <span class="dia-semana-nome">${dia.nome}</span>
                <div class="toggle-atendimento">
                    <label class="switch">
                        <input type="checkbox" id="${dia.id}-ativo" checked>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="horarios-container" id="container-${dia.id}">
                <div class="horarios-blocos" id="blocos-${dia.id}"></div>
                <button type="button" class="btn-adicionar-bloco" data-dia="${dia.id}">+ Adicionar Horário</button>
            </div>
        `;
        diasContainer.appendChild(divDia);
        adicionarBlocoDeHorario(dia.id); 
        const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
        toggleAtivo.addEventListener('change', (e) => {
            document.getElementById(`container-${dia.id}`).style.display = e.target.checked ? 'block' : 'none';
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
