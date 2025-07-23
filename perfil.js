/**
 * perfil.js (Versão Unificada com Horários)
 * * Gere a página de perfil completa, incluindo informações do negócio,
 * * logótipo, horários de atendimento e intervalos.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Elementos do formulário
const form = document.getElementById('form-perfil');
const nomeNegocioInput = document.getElementById('nomeNegocio');
const slugInput = document.getElementById('slug');
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

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    gerarEstruturaDosDias();
    carregarTodosOsDados(uid);
    adicionarListenersDeEvento();
    // Define o URL base dinamicamente
    if (urlBaseEl) {
        urlBaseEl.textContent = `${window.location.origin}/vitrine.html?slug=`;
    }
  } else {
    window.location.href = 'login.html';
  }
});

function adicionarListenersDeEvento() {
    nomeNegocioInput.addEventListener('keyup', () => {
        slugInput.value = gerarSlug(nomeNegocioInput.value);
    });
    form.addEventListener('submit', handleFormSubmit);
    btnCopiarLink.addEventListener('click', copiarLink);
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
        if (data[dia.id] && data[dia.id].blocos && data[dia.id].blocos.length > 0) {
            document.getElementById(`blocos-${dia.id}`).innerHTML = ''; // Limpa blocos padrão
            data[dia.id].blocos.forEach(bloco => {
                adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim);
            });
        }
      });
    }
  } catch (error) { console.error("Erro ao carregar horários:", error); }
}

// --- LÓGICA DE SALVAMENTO DE DADOS ---
async function handleFormSubmit(event) {
  event.preventDefault();
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A salvar...';

  try {
    // Salva as duas partes em paralelo
    await Promise.all([
        salvarDadosDoPerfil(),
        salvarHorarios()
    ]);
    alert("Todas as configurações foram salvas com sucesso!");
  } catch (error) {
    console.error("ERRO GERAL AO SALVAR:", error);
    alert("Ocorreu um erro ao salvar as configurações.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Todas as Configurações';
  }
}

async function salvarDadosDoPerfil() {
  const slug = slugInput.value.trim();
  const nomeNegocio = nomeNegocioInput.value.trim();
  const logoFile = logoInput.files[0];

  if (!nomeNegocio || !slug) throw new Error("Nome do negócio e slug são obrigatórios.");

  let logoUrl = logoPreview.src.startsWith('https://') ? logoPreview.src : null;
  if (logoFile) {
    const storageRef = ref(storage, `logos/${uid}/${logoFile.name}`);
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

  const perfilPrivadoRef = doc(db, "users", uid, "publicProfile", "profile");
  await setDoc(perfilPrivadoRef, perfilData);

  const perfilPublicoRef = doc(db, "publicProfiles", uid);
  await setDoc(perfilPublicoRef, { slug, ownerId: uid, logoUrl, nomeNegocio });
}

async function salvarHorarios() {
  const horariosData = { intervalo: parseInt(intervaloSelect.value) };
  diasDaSemana.forEach(dia => {
    const blocos = [];
    document.querySelectorAll(`#blocos-${dia.id} .bloco-horario`).forEach(blocoEl => {
        const inputs = blocoEl.querySelectorAll('input[type="time"]');
        blocos.push({ inicio: inputs[0].value, fim: inputs[1].value });
    });
    horariosData[dia.id] = { blocos };
  });

  const horariosRef = doc(db, "users", uid, "configuracoes", "horarios");
  await setDoc(horariosRef, horariosData);
}

// --- FUNÇÕES AUXILIARES ---
function gerarSlug(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

function copiarLink() {
    const slug = slugInput.value.trim();
    if (!slug) { alert("Preencha o campo 'URL da sua Vitrine' para poder copiar o link."); return; }
    const urlCompleta = `${window.location.origin}/vitrine.html?slug=${slug}`;
    navigator.clipboard.writeText(urlCompleta).then(() => alert("Link copiado para a área de transferência!"));
}

function gerarEstruturaDosDias() {
    diasDaSemana.forEach(dia => {
        const divDia = document.createElement('div');
        divDia.className = 'dia-semana';
        divDia.innerHTML = `
            <span class="dia-semana-nome">${dia.nome}</span>
            <div class="horarios-blocos" id="blocos-${dia.id}"></div>
            <button type="button" class="btn-adicionar-bloco" data-dia="${dia.id}">+ Adicionar Horário</button>
        `;
        diasContainer.appendChild(divDia);
        // Adiciona um bloco padrão se estiver vazio
        adicionarBlocoDeHorario(dia.id);
    });
    document.querySelectorAll('.btn-adicionar-bloco').forEach(btn => {
        btn.addEventListener('click', (e) => adicionarBlocoDeHorario(e.target.dataset.dia));
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
    divBloco.querySelector('.btn-remover-bloco').addEventListener('click', (e) => e.target.parentElement.remove());
}
