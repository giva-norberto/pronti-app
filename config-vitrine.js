import { auth, firestore } from './firebase-config.js';
import { doc, collection, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const listaServicosContainer = document.getElementById('lista-servicos-vitrine');
const btnPreview = document.getElementById('btn-preview-vitrine');

let servicos = [];
let servicosSelecionados = new Set();
let userUid = null;

function renderListaServicos() {
  if (servicos.length === 0) {
    listaServicosContainer.innerHTML = '<p>Você não tem serviços cadastrados.</p>';
    return;
  }

  const html = servicos.map(servico => {
    const checked = servicosSelecionados.has(servico.id) ? 'checked' : '';
    return `
      <label style="display: block; margin-bottom: 8px; cursor: pointer;">
        <input type="checkbox" data-id="${servico.id}" ${checked} />
        ${servico.nome}
      </label>
    `;
  }).join('');
  listaServicosContainer.innerHTML = html;

  // Adicionar listeners nos checkboxes
  listaServicosContainer.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        servicosSelecionados.add(id);
      } else {
        servicosSelecionados.delete(id);
      }
      salvarConfiguracao();
    });
  });
}

async function carregarServicos() {
  listaServicosContainer.innerHTML = '<p>Carregando serviços...</p>';
  try {
    const servicesRef = collection(firestore, 'users', userUid, 'services');
    const querySnapshot = await getDocs(servicesRef);
    servicos = [];
    querySnapshot.forEach(docSnap => {
      servicos.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
    listaServicosContainer.innerHTML = '<p>Erro ao carregar serviços.</p>';
  }
}

async function carregarConfiguracao() {
  try {
    const configRef = doc(firestore, 'users', userUid, 'publicProfile', 'vitrineConfig');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      servicosSelecionados = new Set(data.servicosVisiveis || []);
    } else {
      servicosSelecionados = new Set();
    }
  } catch (error) {
    console.error('Erro ao carregar configuração:', error);
    servicosSelecionados = new Set();
  }
}

async function salvarConfiguracao() {
  try {
    const configRef = doc(firestore, 'users', userUid, 'publicProfile', 'vitrineConfig');
    await setDoc(configRef, { servicosVisiveis: Array.from(servicosSelecionados) });
    console.log('Configuração salva com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
  }
}

btnPreview.addEventListener('click', () => {
  // Abrir a página pública da vitrine, pode ser um caminho fixo
  // Exemplo: vitrine.html?user=uid
  if (!userUid) {
    alert('Usuário não autenticado.');
    return;
  }
  const url = `vitrine.html?user=${userUid}`;
  window.open(url, '_blank');
});

onAuthStateChanged(auth, async user => {
  if (user) {
    userUid = user.uid;
    await carregarServicos();
    await carregarConfiguracao();
    renderListaServicos();
  } else {
    // Se não autenticado, redirecionar para login ou mostrar mensagem
    alert('Você precisa estar logado para acessar esta página.');
    window.location.href = 'login.html';
  }
});
