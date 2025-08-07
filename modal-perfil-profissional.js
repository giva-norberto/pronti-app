import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Dias da semana padrão
const diasSemana = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

let profissionalAtual = null;
let empresaIdGlobal = null;

// Função para abrir o modal de perfil do profissional
export function abrirModalPerfilProfissional(profissional, empresaId) {
    profissionalAtual = profissional;
    empresaIdGlobal = empresaId;

    // Preenche nome
    document.getElementById('perfil-profissional-nome').textContent = profissional.nome || '';

    // Renderiza horários
    renderizarHorarios(profissional.horarios || {});

    // TODO: renderizar intervalos e serviços...

    // Abre modal
    const modal = document.getElementById('modal-perfil-profissional');
    modal.style.display = 'flex';
    modal.classList.add('show');

    // Deixa a aba de horários ativa por padrão
    trocarAba('horarios');
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

// Renderiza tabela de horários
function renderizarHorarios(horarios) {
    const tbody = document.querySelector('#form-horarios-profissional tbody');
    tbody.innerHTML = diasSemana.map(dia => {
        const inicio = horarios[dia.key]?.inicio || '';
        const fim = horarios[dia.key]?.fim || '';
        return `
            <tr>
                <td>${dia.label}</td>
                <td>
                    <input type="time" name="inicio-${dia.key}" value="${inicio}" />
                </td>
                <td>
                    <input type="time" name="fim-${dia.key}" value="${fim}" />
                </td>
            </tr>
        `;
    }).join('');
}

// Salvar horários
document.getElementById('form-horarios-profissional').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const novosHorarios = {};
    diasSemana.forEach(dia => {
        const inicio = form[`inicio-${dia.key}`].value;
        const fim = form[`fim-${dia.key}`].value;
        novosHorarios[dia.key] = { inicio, fim };
    });
    try {
        await updateDoc(
            doc(db, "empresarios", empresaIdGlobal, "profissionais", profissionalAtual.id),
            { horarios: novosHorarios }
        );
        alert('Horários salvos!');
        // Atualiza no modal
        renderizarHorarios(novosHorarios);
    } catch (err) {
        alert('Erro ao salvar horários: ' + err.message);
    }
};

// Cancelar horários
document.getElementById('btn-cancelar-horarios').onclick = () => {
    document.getElementById('modal-perfil-profissional').style.display = 'none';
    document.getElementById('modal-perfil-profissional').classList.remove('show');
};

// Fechar modal ao clicar fora
document.getElementById('modal-perfil-profissional').addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
        this.classList.remove('show');
    }
});
