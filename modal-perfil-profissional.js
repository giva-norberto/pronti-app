// modal-perfil-profissional.js

// Alternância de abas no modal de perfil
function alternarAbaPerfil(tab) {
    document.querySelectorAll('#modal-perfil-profissional .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('#modal-perfil-profissional .tab-content').forEach(tc => {
        tc.classList.toggle('active', tc.id === 'tab-' + tab);
    });
}

// Função para abrir o modal de perfil e preencher os dados
export function abrirModalPerfilProfissional(profissional, todosServicos, empresaId, callback) {
    const modal = document.getElementById('modal-perfil-profissional');
    if (!modal) return;

    modal.classList.add('show');
    document.getElementById('perfil-profissional-nome').textContent = profissional.nome || '';

    // Ativa a aba "Horários" por padrão
    alternarAbaPerfil('horarios');

    // Preencher checkboxes de serviços
    const listaServicos = document.getElementById('lista-servicos-checkbox');
    listaServicos.innerHTML = '';
    if (Array.isArray(todosServicos)) {
        todosServicos.forEach(servico => {
            const isChecked = profissional.servicos && profissional.servicos.includes(servico.id);
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${servico.id}" ${isChecked ? 'checked' : ''}>
                ${servico.nome}
            `;
            listaServicos.appendChild(label);
        });
    }

    // Handler do formulário de serviços
    const formServicos = document.getElementById('form-servicos-perfil-profissional');
    formServicos.onsubmit = function (e) {
        e.preventDefault();
        const selecionados = Array.from(listaServicos.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        if (typeof callback === 'function') {
            callback('servicos', selecionados, profissional); // Você pode personalizar essa chamada
        }
        modal.classList.remove('show');
    };
}

// Setup das abas e botões do modal (roda uma vez só)
document.addEventListener('DOMContentLoaded', () => {
    // Alternância de abas
    document.querySelectorAll('#modal-perfil-profissional .tab-btn').forEach(btn => {
        btn.onclick = () => alternarAbaPerfil(btn.dataset.tab);
    });

    // Botão cancelar na aba serviços
    const btnCancelar = document.getElementById('btn-cancelar-servicos-perfil');
    if (btnCancelar) {
        btnCancelar.onclick = () => {
            document.getElementById('modal-perfil-profissional').classList.remove('show');
        };
    }

    // Fechar modal ao clicar fora do conteúdo
    const modal = document.getElementById('modal-perfil-profissional');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
});

// Disponibiliza globalmente para uso no equipe.js
window.abrirModalPerfilProfissional = abrirModalPerfilProfissional;
