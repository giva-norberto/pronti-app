// vitrini-utils.js (VERSÃO FINAL E DEFINITIVA)

/**
 * Função principal que controla o modal, tornando-o visível e configurando seus botões.
 * @param {string} title - Título do modal.
 * @param {string} message - Mensagem do modal.
 * @param {Array<object>} buttons - Array com a configuração dos botões.
 * @returns {Promise<any>} - Retorna o valor associado ao botão clicado.
 */
function showModal(title, message, buttons) {
    return new Promise(resolve => {
        // Usa os IDs do seu HTML original
        const overlay = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('modal-titulo');
        const messageEl = document.getElementById('modal-mensagem');
        const buttonsContainer = document.querySelector('.modal-botoes');

        if (!overlay || !titleEl || !messageEl || !buttonsContainer) {
            console.error("Elementos do modal não encontrados no DOM. Verifique seu HTML.");
            return resolve(false); // Retorna 'false' para não travar a aplicação
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        buttonsContainer.innerHTML = ''; // Limpa botões antigos para evitar duplicatas

        // Função para fechar o modal e resolver a Promise
        const close = (value) => {
            overlay.classList.remove('ativo');
            resolve(value);
        };

        // Cria os botões dinamicamente
        buttons.forEach(buttonInfo => {
            const button = document.createElement('button');
            button.id = buttonInfo.id; // Usa os IDs do seu CSS
            button.textContent = buttonInfo.text;
            button.addEventListener('click', () => close(buttonInfo.value));
            buttonsContainer.appendChild(button);
        });

        overlay.classList.add('ativo');
    });
}

/**
 * Exibe um "Card de Alerta" central com um único botão "OK".
 * @param {string} title - Título do alerta.
 * @param {string} message - Mensagem do alerta.
 */
export function showAlert(title, message) {
    const buttons = [
        { text: 'OK', id: 'modal-btn-confirmar', value: true } // Reutiliza o estilo do botão de confirmar
    ];
    return showModal(title, message, buttons);
}

/**
 * Exibe um "Card de Pergunta" central com botões de confirmação e cancelamento.
 * @param {string} title - Título da pergunta.
 * @param {string} message - Mensagem da pergunta.
 * @returns {Promise<boolean>} - Retorna true para confirmação, false para cancelamento.
 */
export function showCustomConfirm(title, message) {
    const buttons = [
        { text: 'Cancelar', id: 'modal-btn-cancelar', value: false },
        { text: 'Confirmar', id: 'modal-btn-confirmar', value: true }
    ];
    return showModal(title, message, buttons);
}
