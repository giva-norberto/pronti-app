import { db, collection, doc, getDoc, getDocs, setDoc } from "./firebase-config.js"; // ajuste o import conforme seu projeto
import { getTodosServicosDaEmpresa } from "./vitrini-profissionais.js"; // ajuste se necessário

const empresaId = /* pegue do contexto do seu app */;
let profissionais = [];

// Carregar lista de funcionários ao iniciar
async function carregarProfissionais() {
  const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
  const snap = await getDocs(profissionaisRef);
  profissionais = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderizarListaProfissionais();
}

function renderizarListaProfissionais() {
  const lista = document.getElementById('lista-profissionais-painel');
  if (!lista) return;
  lista.innerHTML = profissionais.map(prof => `
    <div class="profissional-card" data-id="${prof.id}">
      <img src="${prof.fotoUrl || 'https://placehold.co/40x40/eef2ff/4f46e5?text=P'}" style="width:40px;height:40px;border-radius:50%;">
      <span>${prof.nome}</span>
      <button class="btn-editar-funcionario" data-id="${prof.id}">Editar</button>
    </div>
  `).join('');
}

// Evento de clique na lista
document.getElementById('lista-profissionais-painel').addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-editar-funcionario')) {
    const profId = e.target.dataset.id;
    const prof = profissionais.find(p => p.id === profId);
    if (!prof) return;
    abrirModalEditarFuncionario(prof);
  }
});

// Função para abrir o modal de edição de funcionário
async function abrirModalEditarFuncionario(prof) {
  document.getElementById('func-nome').value = prof.nome || '';

  // Serviços: Carregar todos e marcar os do funcionário
  const servicosEmpresa = await getTodosServicosDaEmpresa(empresaId);
  const servicosSelecionados = prof.servicosIds || prof.servicos || [];
  document.getElementById('func-servicos').innerHTML = servicosEmpresa.map(srv => `
    <label>
      <input type="checkbox" value="${srv.id}" ${servicosSelecionados.includes(srv.id) ? 'checked' : ''}>
      ${srv.nome} (${srv.duracao}min, R$${srv.preco})
    </label>
  `).join('');

  // Horários
  renderEditorHorariosFuncionario(prof.horarios);

  // Abrir modal
  document.getElementById('modal-editar-funcionario').style.display = 'block';

  // Salvar alterações
  document.getElementById('form-editar-funcionario').onsubmit = async function(ev) {
    ev.preventDefault();
    const nome = document.getElementById('func-nome').value.trim();
    const servicosIds = Array.from(document.querySelectorAll('#func-servicos input[type=checkbox]:checked')).map(cb => cb.value);
    const horarios = coletarHorariosEditados();

    // Atualiza no Firestore
    await setDoc(doc(db, "empresarios", empresaId, "profissionais", prof.id), {
      nome,
      servicosIds,
      horarios
    }, { merge: true });
    alert('Funcionário atualizado!');
    document.getElementById('modal-editar-funcionario').style.display = 'none';
    carregarProfissionais(); // atualiza lista
  };
}

// Fecha modal
document.getElementById('btn-fechar-modal').onclick = function() {
  document.getElementById('modal-editar-funcionario').style.display = 'none';
};

// Editor de horários igual perfil
function renderEditorHorariosFuncionario(horarios) {
  const dias = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
  const labels = {seg: "Seg", ter: "Ter", qua: "Qua", qui: "Sex", sex: "Sex", sab: "Sáb", dom: "Dom"};
  const container = document.getElementById('func-horarios');
  container.innerHTML = dias.map(dia => {
    const h = horarios?.[dia] || { ativo: false, blocos: [] };
    return `
      <div>
        <label>
          <input type="checkbox" data-dia="${dia}" class="dia-ativo" ${h.ativo ? 'checked' : ''}>
          ${labels[dia]}
        </label>
        <span>
          ${(h.blocos||[]).map((b, i) => `
            <input type="time" value="${b.inicio}" class="hora-inicio" data-dia="${dia}" data-i="${i}">
            até
            <input type="time" value="${b.fim}" class="hora-fim" data-dia="${dia}" data-i="${i}">
            <button type="button" data-dia="${dia}" data-i="${i}" class="rem-bloco">-</button>
          `).join('')}
          <button type="button" data-dia="${dia}" class="add-bloco">+</button>
        </span>
      </div>
    `;
  }).join('');
  // Você pode adicionar eventos para +, - aqui se quiser
}

// Função para coletar horários editados do editor
function coletarHorariosEditados() {
  const dias = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
  const horarios = {};
  dias.forEach(dia => {
    const ativo = document.querySelector(`input.dia-ativo[data-dia="${dia}"]`)?.checked || false;
    const blocos = [];
    document.querySelectorAll(`.hora-inicio[data-dia="${dia}"]`).forEach((input, i) => {
      const inicio = input.value;
      const fim = document.querySelector(`.hora-fim[data-dia="${dia}"][data-i="${i}"]`)?.value || '';
      if (inicio && fim) blocos.push({ inicio, fim });
    });
    horarios[dia] = { ativo, blocos };
  });
  return horarios;
}

// Inicializa ao carregar
carregarProfissionais();
