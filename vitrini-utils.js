// vitrini-utils.js
export function showNotification(message, erro = false) {
    const container = document.getElementById('notification-message');
    if (!container) return;
    container.textContent = message;
    container.style.color = erro ? 'red' : 'green';
    container.style.opacity = '1';
    setTimeout(() => {
        container.style.opacity = '0';
    }, 3000);
}
// Adicione esta função em vitrini-utils.js

/**
 * Exibe um modal de confirmação personalizado e retorna uma promessa.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem a ser exibida.
 * @returns {Promise<boolean>} - Resolve com 'true' se confirmado, 'false' se cancelado.
 */
export function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const modalTitle = document.getElementById('modal-titulo');
        const modalMessage = document.getElementById('modal-mensagem');
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        const btnCancelar = document.getElementById('modal-btn-cancelar');

        if (!modal || !modalTitle || !modalMessage || !btnConfirmar || !btnCancelar) {
            // Se o modal não existir, usa o confirm() antigo como alternativa
            resolve(confirm(message));
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        const close = (value) => {
            modal.classList.remove('ativo');
            // Remove os event listeners para não se acumularem
            btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
            btnCancelar.replaceWith(btnCancelar.cloneNode(true));
            resolve(value);
        };

        document.getElementById('modal-btn-confirmar').addEventListener('click', () => close(true), { once: true });
        document.getElementById('modal-btn-cancelar').addEventListener('click', () => close(false), { once: true });

        modal.classList.add('ativo');
    });
}
