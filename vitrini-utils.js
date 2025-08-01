// vitrini-utils.js (VERSÃO FINAL E DEFINITIVA)

/**
 * Exibe um modal genérico na tela.
 * Esta é a função interna que alimenta showAlert e showCustomConfirm.
 */
function showModal(title, message, buttons) {
    return new Promise(resolve => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const buttonsContainer = document.getElementById('modal-buttons-container');

        if (!overlay || !titleEl || !messageEl || !buttonsContainer) {
            console.error("Elementos do modal unificado não encontrados no DOM. Verifique o Passo 1 do HTML.");
            resolve(false); // Retorna falso para não travar a aplicação
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        buttonsContainer.innerHTML = ''; // Limpa botões antigos para segurança

        // Função de limpeza para remover listeners após o clique
        const cleanupAndResolve = (value) => {
            overlay.style.display = 'none';
            buttonsContainer.innerHTML = '';
            resolve(value);
        };

        // Cria os botões dinamicamente
        buttons.forEach(buttonInfo => {
            const button = document.createElement('button');
            button.textContent = buttonInfo.text;
            // Adapta as classes do CSS que já criamos
            button.className = `btn-confirm ${buttonInfo.styleClass}`; 
            button.addEventListener('click', () => cleanupAndResolve(buttonInfo.value));
            buttonsContainer.appendChild(button);
        });

        overlay.style.display = 'flex';
    });
}

/**
 * Exibe um "Card de Alerta" central com um único botão "OK".
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem do alerta.
 */
export function showAlert(title, message) {
    const buttons = [
        { text: 'OK', styleClass: 'btn-ok', value: true }
    ];
    return showModal(title, message, buttons);
}

/**
 * Exibe um "Card de Pergunta" central com botões de confirmação e cancelamento.
 * @param {string} title - O título da pergunta.
 * @param {string} message - A mensagem da pergunta.
 * @returns {Promise<boolean>} - Retorna true para confirmação, false para cancelamento.
 */
export function showCustomConfirm(title, message) {
    const buttons = [
        { text: 'Cancelar', styleClass: 'btn-cancel', value: false },
        { text: 'Confirmar', styleClass: 'btn-ok', value: true }
    ];
    // O botão de cancelar vem primeiro visualmente
    return showModal(title, message, buttons.reverse());
}
