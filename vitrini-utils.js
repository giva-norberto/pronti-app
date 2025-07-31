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
