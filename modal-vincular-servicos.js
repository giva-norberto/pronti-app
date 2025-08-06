import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Abre o modal para vincular/desvincular serviços a um funcionário
 * @param {Object} funcionario - objeto do funcionário (deve ter id, nome, servicos[])
 * @param {Array} todosServicos - array de todos os serviços disponíveis [{id, nome, ...}]
 * @param {string} empresaId - ID da empresa
 * @param {Function} onSaved - callback chamado ao salvar (opcional)
 */
export function abrirModalServicosFuncionario(funcionario, todosServicos, empresaId, onSaved) {
    const modal = document.getElementById('modal-servicos-funcionario');
    const listaDiv = document.getElementById('lista-servicos-checkbox');
    modal.classList.add('show');

    // Renderiza os checkboxes dos serviços
    listaDiv.innerHTML = todosServicos.map(servico => `
        <label>
            <input type="checkbox" name="servico" value="${servico.id}"
                ${Array.isArray(funcionario.servicos) && funcionario.servicos.includes(servico.id) ? 'checked' : ''}>
            ${servico.nome}
        </label>
    `).join('');

    // Botão Cancelar
    document.getElementById('btn-cancelar-servicos').onclick = () => {
        modal.classList.remove('show');
    };

    // Botão Salvar
    document.getElementById('form-servicos-funcionario').onsubmit = async (e) => {
        e.preventDefault();
        const selecionados = Array.from(
            listaDiv.querySelectorAll('input[type="checkbox"]:checked')
        ).map(chk => chk.value);

        await updateDoc(
            doc(db, "empresarios", empresaId, "profissionais", funcionario.id),
            { servicos: selecionados }
        );
        modal.classList.remove('show');
        if (onSaved) onSaved(selecionados);
        alert("Vínculo de serviços atualizado!");
    };
}
