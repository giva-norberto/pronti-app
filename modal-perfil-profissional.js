import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
let profissionalData = null;

// Função principal do modal
export async function abrirModalPerfilProfissional(profissionalId) {
  if (typeof profissionalId === "object" && profissionalId !== null && profissionalId.id) {
    profissionalId = profissionalId.id;
  }
  if (!profissionalId || typeof profissionalId !== "string") return;

  const modal = document.getElementById('modal-perfil-profissional');
  if (!modal) return;
  modal.style.display = 'block';

  // Botão "X" para fechar modal
  const btnFechar = document.getElementById('btn-fechar-modal-perfil');
  if (btnFechar) {
    btnFechar.onclick = () => {
      modal.style.display = 'none';
    };
  }

  // Limpa campos
  const formHorarios = document.getElementById('form-horarios');
  if (formHorarios) formHorarios.reset();
  const diasContainer = document.getElementById('dias-container');
  if (diasContainer) diasContainer.innerHTML = '';

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      empresaId = await getEmpresaIdDoDono(user.uid);
      if (!empresaId) {
        alert("Empresa não encontrada. Por favor, complete o seu perfil primeiro.");
        modal.style.display = 'none'; return;
      }
      profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalId);
      await carregarDadosProfissional();
      renderizarCabecalhoProfissional();
      gerarEstruturaDosDias();
      await carregarHorarios();
      if (formHorarios) formHorarios.onsubmit = handleFormSubmit;
    } else {
      window.location.href = 'login.html';
    }
  });
}

// Carrega dados completos do profissional
async function carregarDadosProfissional() {
  if (!profissionalRef) return;
  const snap = await getDoc(profissionalRef);
  if (snap.exists()) profissionalData = snap.data();
}

// Renderiza cabeçalho com foto e nome do profissional
function renderizarCabecalhoProfissional() {
  const cabecalho = document.getElementById('cabecalho-profissional');
  if (!cabecalho || !profissionalData) return;
  const nome = profissionalData.nome || 'Profissional';
  const foto = profissionalData.foto || profissionalData.fotoUrl || 'https://via.placeholder.com/80x80?text=Foto';
  const servicos = profissionalData.servicos || [];
  const ativo = profissionalData.ativo !== false;
  cabecalho.innerHTML = `
    <div class="perfil-header">
      <div class="perfil-foto-container">
        <img src="${foto}" alt="${nome}" class="perfil-foto" onerror="this.src='https://via.placeholder.com/80x80?text=Foto'">
        <button type="button" class="btn-editar-foto" onclick="editarFotoProfissional()">📷</button>
      </div>
      <div class="perfil-info">
        <div class="perfil-nome-container">
          <h3 class="perfil-nome">${nome}</h3>
          <button type="button" class="btn-editar-nome" onclick="editarNomeProfissional()">✏️</button>
        </div>
        <div class="status-profissional ${ativo ? 'ativo' : 'inativo'}">
          ${ativo ? '🟢 Ativo' : '🔴 Inativo'}
        </div>
        <div class="servicos-profissional">
          <h4>Serviços:</h4>
          <div class="lista-servicos">
            ${servicos.length > 0 ? 
              servicos.map(servico => `<span class="servico-tag">${servico}</span>`).join('') : 
              '<span class="sem-servicos">Nenhum serviço cadastrado</span>'
            }
          </div>
          <button type="button" class="btn-editar-servicos" onclick="editarServicosProfissional()">Editar Serviços</button>
        </div>
      </div>
      <div class="acoes-profissional">
        <button type="button" class="btn-toggle-status ${ativo ? 'desativar' : 'ativar'}" onclick="toggleStatusProfissional()">
          ${ativo ? '❌ Desativar' : '✅ Ativar'}
        </button>
        <button type="button" class="btn-excluir-profissional" onclick="excluirProfissional()">🗑️ Excluir</button>
        <button type="button" class="btn-sincronizar-calendario" onclick="sincronizarCalendario()">📅 Sincronizar Agenda</button>
      </div>
    </div>
  `;
}

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

// Adiciona um bloco de horário no dia com validação de sobreposição
function adicionarBlocoDeHorario(diaId, inicio = '09:00', fim = '18:00') {
  const container = document.getElementById(`blocos-${diaId}`);
  if (!container) return;
  
  const divBloco = document.createElement('div');
  divBloco.className = 'slot-horario bloco-horario';
  divBloco.innerHTML = `
    <input type="time" value="${inicio}" class="horario-inicio">
    <span class="ate">até</span>
    <input type="time" value="${fim}" class="horario-fim">
    <button type="button" class="btn-remove-slot">Remover</button>
    <div class="erro-sobreposicao" style="display: none; color: red; font-size: 12px;">⚠️ Horário sobreposto!</div>
  `;
  container.appendChild(divBloco);
  
  // Adiciona validação de sobreposição
  const inputInicio = divBloco.querySelector('.horario-inicio');
  const inputFim = divBloco.querySelector('.horario-fim');
  
  [inputInicio, inputFim].forEach(input => {
    input.addEventListener('change', () => validarSobreposicao(diaId));
  });
  
  const btnRemove = divBloco.querySelector('.btn-remove-slot');
  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      if (container.childElementCount > 1) {
        e.target.closest('.slot-horario').remove();
        validarSobreposicao(diaId);
      } else {
        alert("Para não atender neste dia, desative o botão na parte superior.");
      }
    });
  }
  
  setTimeout(() => validarSobreposicao(diaId), 100);
}

// Valida sobreposição de horários
function validarSobreposicao(diaId) {
  const blocos = document.querySelectorAll(`#blocos-${diaId} .bloco-horario`);
  const horarios = [];
  let temSobreposicao = false;
  blocos.forEach((bloco, index) => {
    const inicio = bloco.querySelector('.horario-inicio').value;
    const fim = bloco.querySelector('.horario-fim').value;
    const erroDiv = bloco.querySelector('.erro-sobreposicao');
    erroDiv.style.display = 'none'; bloco.classList.remove('erro');
    if (inicio && fim) {
      if (inicio >= fim) {
        erroDiv.textContent = '⚠️ Horário de início deve ser menor que o fim!';
        erroDiv.style.display = 'block'; bloco.classList.add('erro');
        temSobreposicao = true;
        return;
      }
      horarios.push({ inicio, fim, elemento: bloco, erroDiv, index });
    }
  });
  for (let i = 0; i < horarios.length; i++) {
    for (let j = i + 1; j < horarios.length; j++) {
      const h1 = horarios[i];
      const h2 = horarios[j];
      if ((h1.inicio < h2.fim && h1.fim > h2.inicio)) {
        h1.erroDiv.style.display = 'block';
        h2.erroDiv.style.display = 'block';
        h1.elemento.classList.add('erro');
        h2.elemento.classList.add('erro');
        temSobreposicao = true;
      }
    }
  }
  return !temSobreposicao;
}

// Salva horários e intervalo com validação
async function handleFormSubmit(event) {
  event.preventDefault();
  let temErros = false;
  diasDaSemana.forEach(dia => {
    const ativoInput = document.getElementById(`${dia.id}-ativo`);
    if (ativoInput && ativoInput.checked) {
      if (!validarSobreposicao(dia.id)) {
        temErros = true;
      }
    }
  });
  if (temErros) {
    alert('Corrija os horários com sobreposição antes de salvar!');
    return;
  }
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

// Funções para edição do profissional (window para onclick inline)
window.editarNomeProfissional = async function() {
  const novoNome = prompt('Digite o novo nome:', profissionalData?.nome || '');
  if (novoNome && novoNome.trim()) {
    try {
      await updateDoc(profissionalRef, { nome: novoNome.trim() });
      profissionalData.nome = novoNome.trim();
      renderizarCabecalhoProfissional();
      alert('Nome atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar nome: ' + error.message);
    }
  }
};

window.editarFotoProfissional = async function() {
  const novaFoto = prompt('Digite a URL da nova foto:', profissionalData?.foto || profissionalData.fotoUrl || '');
  if (novaFoto && novaFoto.trim()) {
    try {
      await updateDoc(profissionalRef, { foto: novaFoto.trim() });
      profissionalData.foto = novaFoto.trim();
      renderizarCabecalhoProfissional();
      alert('Foto atualizada com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar foto: ' + error.message);
    }
  }
};

window.editarServicosProfissional = async function() {
  const servicosAtuais = profissionalData?.servicos || [];
  const servicosTexto = servicosAtuais.join(', ');
  const novosServicos = prompt('Digite os serviços separados por vírgula:', servicosTexto);
  if (novosServicos !== null) {
    const servicosArray = novosServicos.split(',').map(s => s.trim()).filter(s => s);
    try {
      await updateDoc(profissionalRef, { servicos: servicosArray });
      profissionalData.servicos = servicosArray;
      renderizarCabecalhoProfissional();
      alert('Serviços atualizados com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar serviços: ' + error.message);
    }
  }
};

window.toggleStatusProfissional = async function() {
  const ativo = profissionalData?.ativo !== false;
  const novoStatus = !ativo;
  const acao = novoStatus ? 'ativar' : 'desativar';
  if (confirm(`Tem certeza que deseja ${acao} este profissional?`)) {
    try {
      await updateDoc(profissionalRef, { ativo: novoStatus });
      profissionalData.ativo = novoStatus;
      renderizarCabecalhoProfissional();
      alert(`Profissional ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      alert('Erro ao alterar status: ' + error.message);
    }
  }
};

window.excluirProfissional = async function() {
  const nome = profissionalData?.nome || 'este profissional';
  if (confirm(`Tem certeza que deseja EXCLUIR ${nome}? Esta ação não pode ser desfeita!`)) {
    if (confirm('CONFIRMAÇÃO FINAL: Todos os dados serão perdidos permanentemente!')) {
      try {
        await deleteDoc(profissionalRef);
        alert('Profissional excluído com sucesso!');
        document.getElementById('modal-perfil-profissional').style.display = 'none';
        if (window.carregarProfissionais) window.carregarProfissionais();
      } catch (error) {
        alert('Erro ao excluir profissional: ' + error.message);
      }
    }
  }
};

window.sincronizarCalendario = async function() {
  const opcoes = [
    'Google Calendar',
    'Outlook',
    'Apple Calendar',
    'Calendário Personalizado'
  ];
  let escolha = '';
  opcoes.forEach((opcao, index) => {
    escolha += `${index + 1}. ${opcao}\n`;
  });
  const selecao = prompt(`Escolha o calendário para sincronizar:\n${escolha}\nDigite o número:`);
  if (selecao && selecao >= 1 && selecao <= opcoes.length) {
    const calendarioEscolhido = opcoes[selecao - 1];
    try {
      await updateDoc(profissionalRef, { 
        sincronizacaoCalendario: {
          tipo: calendarioEscolhido,
          ativo: true,
          dataConfiguracao: new Date().toISOString()
        }
      });
      alert(`Sincronização com ${calendarioEscolhido} configurada! 
1. Configure as credenciais de acesso
2. Defina a frequência de sincronização
3. Teste a conexão
Entre em contato com o suporte para finalizar a configuração.`);
    } catch (error) {
      alert('Erro ao configurar sincronização: ' + error.message);
    }
  }
};

window.abrirModalPerfilProfissional = abrirModalPerfilProfissional;
