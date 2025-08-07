// modal-perfil-profissional.js

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

// ===== Funções de preenchimento de campos =====
function preencherHorarios(horarios) {
    diasSemana.forEach(dia => {
        const elInicio = document.getElementById(`${dia.key}_inicio`);
        const elFim = document.getElementById(`${dia.key}_fim`);
        if (elInicio) elInicio.value = horarios[dia.key]?.inicio || '';
        if (elFim) elFim.value = horarios[dia.key]?.fim || '';
    });
}
function preencherIntervalos(intervalos) {
    diasSemana.forEach(dia => {
        const elInicio = document.getElementById(`${dia.key}_intervalo_inicio`);
        const elFim = document.getElementById(`${dia.key}_intervalo_fim`);
        if (elInicio) elInicio.value = intervalos[dia.key]?.inicio || '';
        if (elFim) elFim.value = intervalos[dia.key]?.fim || '';
    });
}
function preencherServicos(servicosSelecionados, servicosDisponiveis) {
    const lista = document.getElementById('lista-servicos-checkbox');
    if (!lista) return;
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

// ===== Export principal =====
export function abrirModalPerfilProfissional(profissional, empresaId = null, servicosDisponiveis = []) {
    profissionalAtual = profissional;
    empresaIdGlobal = empresaId;

    // Preenche nome
    const nomeEl = document.getElementById('perfil-profissional-nome');
    if (nomeEl) nomeEl.textContent = profissional.nome || '';

    // Preenche horários, intervalos, serviços
    preencherHorarios(profissional.horarios || {});
    preencherIntervalos(profissional.intervalos || {});
    preencherServicos(profissional.servicos || [], servicosDisponiveis);

    // Abre modal
    const modal = document.getElementById('modal-perfil-profissional');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }

    // Aba padrão: horários
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const horariosTabBtn = document.querySelector('.tab-btn[data-tab="horarios"]');
    const horariosTabContent = document.getElementById('tab-horarios');
    if (horariosTabBtn) horariosTabBtn.classList.add('active');
    if (horariosTabContent) horariosTabContent.classList.add('active');
}

// ===== Bind de eventos (deve ser feito após DOM pronto) =====
window.addEventListener('DOMContentLoaded', () => {
    // Fecha modal ao clicar fora
    const modalPerfil = document.getElementById('modal-perfil-profissional');
    if (modalPerfil) {
        modalPerfil.addEventListener('click', function(e) {
            if (e.target === this) {
                fecharModalPerfil();
            }
        });
    }

    // Troca de abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            btn.classList.add('active');
            const conteudo = document.getElementById('tab-' + btn.dataset.tab);
            if (conteudo) conteudo.classList.add('active');
        });
    });

    // Salvar horários
    const formHorarios = document.getElementById('form-horarios-perfil-profissional');
    if (formHorarios) {
        formHorarios.onsubmit = function(e) {
            e.preventDefault();
            if(!profissionalAtual) return;
            const horarios = {};
            diasSemana.forEach(dia => {
                horarios[dia.key] = {
                    inicio: document.getElementById(`${dia.key}_inicio`).value,
                    fim: document.getElementById(`${dia.key}_fim`).value,
                };
            });
            profissionalAtual.horarios = horarios;
            alert('Horários salvos!');
            fecharModalPerfil();
        };
    }

    // Salvar intervalos
    const formIntervalos = document.getElementById('form-intervalos-perfil-profissional');
    if (formIntervalos) {
        formIntervalos.onsubmit = function(e) {
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
    }

    // Salvar serviços
    const formServicos = document.getElementById('form-servicos-perfil-profissional');
    if (formServicos) {
        formServicos.onsubmit = function(e) {
            e.preventDefault();
            if(!profissionalAtual) return;
            const checked = Array.from(document.querySelectorAll('#lista-servicos-checkbox input[type=checkbox]:checked')).map(cb => cb.value);
            profissionalAtual.servicos = checked;
            alert('Serviços salvos!');
            fecharModalPerfil();
        };
    }

    // Botão cancelar serviços fecha modal
    const btnCancelarServicos = document.getElementById('btn-cancelar-servicos-perfil');
    if (btnCancelarServicos) {
        btnCancelarServicos.onclick = fecharModalPerfil;
    }
});

// Função para fechar modal
function fecharModalPerfil() {
    const modal = document.getElementById('modal-perfil-profissional');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}
