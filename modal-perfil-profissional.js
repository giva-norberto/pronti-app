// modal-perfil-profissional.js

// Dias da semana
const diasSemana = [
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terça' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

let profissionalAtual = null;
let empresaIdGlobal = null;

// EXPORT: Função para abrir o modal de perfil do profissional
export function abrirModalPerfilProfissional(profissional, empresaId = null, servicosDisponiveis = []) {
    profissionalAtual = profissional;
    empresaIdGlobal = empresaId;

    // Preenche nome
    document.getElementById('perfil-profissional-nome').textContent = profissional.nome || '';

    // Preenche horários
    preencherHorarios(profissional.horarios || {});

    // Preenche intervalos
    preencherIntervalos(profissional.intervalos || {});

    // Preenche serviços
    preencherServicos(profissional.servicos || [], servicosDisponiveis);

    // Abre modal
    const modal = document.getElementById('modal-perfil-profissional');
    modal.style.display = 'flex';
    modal.classList.add('show');

    // Aba padrão: horários
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="horarios"]').classList.add('active');
    document.getElementById('tab-horarios').classList.add('active');
}

// Fecha modal ao clicar fora
document.getElementById('modal-perfil-profissional').addEventListener('click', function(e) {
    if (e.target === this) {
        fecharModalPerfil();
    }
});
function fecharModalPerfil() {
    const modal = document.getElementById('modal-perfil-profissional');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

// Troca de abas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// Preencher horários
function preencherHorarios(horarios) {
    diasSemana.forEach(dia => {
        document.getElementById(`${dia.key}_inicio`).value = horarios[dia.key]?.inicio || '';
        document.getElementById(`${dia.key}_fim`).value = horarios[dia.key]?.fim || '';
    });
}

// Preencher intervalos
function preencherIntervalos(intervalos) {
    diasSemana.forEach(dia => {
        document.getElementById(`${dia.key}_intervalo_inicio`).value = intervalos[dia.key]?.inicio || '';
        document.getElementById(`${dia.key}_intervalo_fim`).value = intervalos[dia.key]?.fim || '';
    });
}

// Preencher serviços
function preencherServicos(servicosSelecionados, servicosDisponiveis) {
    const lista = document.getElementById('lista-servicos-checkbox');
    lista.innerHTML = '';
    servicosDisponiveis.forEach(servico => {
        const checked = servicosSelecionados.includes(servico.id) ? 'checked' : '';
        lista.innerHTML += `
          <label>
            <input type="checkbox" value="${servico.id}" ${checked}>
            ${servico.nome}
          </label>
        `;
    });
}

// --------- Salvar Horários -----------
document.getElementById('form-horarios-perfil-profissional').onsubmit = async function(e) {
    e.preventDefault();
    if(!profissionalAtual) return;

    const horarios = {};
    diasSemana.forEach(dia => {
        horarios[dia.key] = {
            inicio: document.getElementById(`${dia.key}_inicio`).value,
            fim: document.getElementById(`${dia.key}_fim`).value,
        };
    });

    profissionalAtual.horarios = horarios; // Local update

    alert('Horários salvos!');
    fecharModalPerfil();
};

// --------- Salvar Intervalos -----------
document.getElementById('form-intervalos-perfil-profissional').onsubmit = async function(e) {
    e.preventDefault();
    if(!profissionalAtual) return;

    const intervalos = {};
    diasSemana.forEach(dia => {
        intervalos[dia.key] = {
            inicio: document.getElementById(`${dia.key}_intervalo_inicio`).value,
            fim: document.getElementById(`${dia.key}_intervalo_fim`).value,
        };
    });

    profissionalAtual.intervalos = intervalos;

    alert('Intervalos salvos!');
    fecharModalPerfil();
};

// --------- Salvar Serviços -----------
document.getElementById('form-servicos-perfil-profissional').onsubmit = async function(e) {
    e.preventDefault();
    if(!profissionalAtual) return;

    const checked = Array.from(document.querySelectorAll('#lista-servicos-checkbox input[type=checkbox]:checked')).map(cb => cb.value);
    profissionalAtual.servicos = checked;

    alert('Serviços salvos!');
    fecharModalPerfil();
};

// Botão cancelar serviços fecha modal
document.getElementById('btn-cancelar-servicos-perfil').onclick = fecharModalPerfil;
