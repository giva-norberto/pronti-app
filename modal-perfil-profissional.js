import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const diasDaSemana = [
  { id: 'seg', nome: 'Segunda-feira' }, { id: 'ter', nome: 'Terça-feira' },
  { id: 'qua', nome: 'Quarta-feira' }, { id: 'qui', nome: 'Quinta-feira' },
  { id: 'sex', nome: 'Sexta-feira' }, { id: 'sab', nome: 'Sábado' },
  { id: 'dom', nome: 'Domingo' }
];

let empresaId = null;
let profissionalRef = null;

export async function abrirModalPerfilProfissional(profissionalId) {
  const modal = document.getElementById('modal-perfil-profissional');
  if (!modal) {
    alert('Modal do perfil profissional não encontrado no DOM.');
    return;
  }
  modal.style.display = 'block';

  // Botão Voltar/Fechar
  const btnVoltar = document.getElementById('btn-voltar-modal-perfil');
  if (btnVoltar) {
    btnVoltar.onclick = () => {
      modal.style.display = 'none';
    };
  } else {
    console.warn('Botão Voltar não encontrado dentro do modal!');
  }

  // Limpa campos
  const formHorarios = document.getElementById('form-horarios');
  if (formHorarios) formHorarios.reset();
  const diasContainer = document.getElementById('dias-container');
  if (diasContainer) diasContainer.innerHTML = '';

  // Autenticacao e empresa
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      empresaId = await getEmpresaIdDoDono(user.uid);
      if (!empresaId) {
        alert("Empresa não encontrada. Por favor, complete o seu perfil primeiro.");
        modal.style.display = 'none';
        return;
      }
      profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
      gerarEstruturaDosDias();
      await carregarHorarios();
      if (formHorarios) {
        formHorarios.onsubmit = handleFormSubmit;
      }
    } else {
      window.location.href = 'login.html';
    }
  });
}

// Busca empresaId pelo dono
async function getEmpresaIdDoDono(uid) {
  const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

// Carrega horários e intervalo salvos
async function carregarHorarios() {
  if (!profissionalRef) return;
  const snap = await getDoc(profissionalRef);
  if (!snap.exists()) return;
  const { horarios = {}, intervalo = 30 } = snap.data();
  const intervaloInput = document.getElementById("intervalo-atendimento");
  if (intervaloInput) intervaloInput.value = horarios.intervalo || intervalo || 30;
  diasDaSemana.forEach(dia => {
    const diaData = horarios[dia.id] || {};
    const ativoInput = document.getElementById(`${dia.id}-ativo`);
    if (ativoInput) {
      ativoInput.checked = !!diaData.ativo;
      const blocosDiv = document.getElementById(`blocos-${dia.id}`);
      if (blocosDiv) {
        blocosDiv.innerHTML = '';
        if (diaData.ativo && Array.isArray(diaData.blocos) && diaData.blocos.length > 0) {
          diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
        } else if (diaData.ativo) {
          adicionarBlocoDeHorario(dia.id);
        }
      }
      ativoInput.dispatchEvent(new Event('change'));
    }
  });
}

// Renderiza estrutura dos dias da semana
function gerarEstruturaDosDias() {
  const diasContainer = document.getElementById("dias-container");
  if (!diasContainer) return;
  diasContainer.innerHTML = '';
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
    diasContainer.appendChild(divDia);

    // Listener do toggle ativo
    const ativoInput = divDia.querySelector(`#${dia.id}-ativo`);
    if (ativoInput) {
      ativoInput.addEventListener('change', (e) => {
        const container = document.getElementById(`container-${dia.id}`);
        const label = e.target.closest('.toggle-container').querySelector('.toggle-label');
        if (container && label) {
          container.style.display = e.target.checked ? 'flex' : 'none';
          label.textContent = e.target.checked ? 'Aberto' : 'Fechado';
          if (e.target.checked && container.querySelector('.horarios-blocos').childElementCount === 0) {
            adicionarBlocoDeHorario(dia.id);
          }
        }
      });
    }
  });

  // Listener para adicionar horários
  diasContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-add-slot')) {
      adicionarBlocoDeHorario(e.target.dataset.dia);
    }
  });
}

// Adiciona um bloco de horário no dia
function adicionarBlocoDeHorario(diaId, inicio = '09:00', fim = '18:00') {
  const container = document.getElementById(`blocos-${diaId}`);
  if (!container) return;
  const divBloco = document.createElement('div');
  divBloco.className = 'slot-horario bloco-horario';
  divBloco.innerHTML = `
    <input type="time" value="${inicio}">
    <span class="ate">até</span>
    <input type="time" value="${fim}">
    <button type="button" class="btn-remove-slot">Remover</button>
  `;
  container.appendChild(divBloco);
  const btnRemove = divBloco.querySelector('.btn-remove-slot');
  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      if (container.childElementCount > 1) {
        e.target.closest('.slot-horario').remove();
      } else {
        alert("Para não atender neste dia, desative o botão na parte superior.");
      }
    });
  }
}

// Salva horários e intervalo
async function handleFormSubmit(event) {
  event.preventDefault();
  const btnSalvar = document.querySelector('#form-horarios .btn-submit');
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";
  }
  const intervaloInput = document.getElementById("intervalo-atendimento");
  const horariosData = { intervalo: intervaloInput ? parseInt(intervaloInput.value, 10) : 30 };
  diasDaSemana.forEach(dia => {
    const ativoInput = document.getElementById(`${dia.id}-ativo`);
    const estaAtivo = ativoInput ? ativoInput.checked : false;
    const blocos = [];
    if (estaAtivo) {
      document.querySelectorAll(`#blocos-${dia.id} .bloco-horario`).forEach(blocoEl => {
        const inputs = blocoEl.querySelectorAll('input[type="time"]');
        if (inputs[0]?.value && inputs[1]?.value) blocos.push({ inicio: inputs[0].value, fim: inputs[1].value });
      });
    }
    horariosData[dia.id] = { ativo: estaAtivo, blocos: blocos };
  });

  try {
    await setDoc(profissionalRef, { horarios: horariosData }, { merge: true });
    alert("Horários salvos com sucesso!");
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Horários";
    }
  }
}

// Torna global para integração com equipe.js
window.abrirModalPerfilProfissional = abrirModalPerfilProfissional;
