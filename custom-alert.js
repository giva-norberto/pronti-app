// custom-alert.js
export function showCustomAlert({ title, message, onTrial, onClose }) {
    // Remove alerta antigo, se existir
    const existing = document.getElementById('custom-alert-backdrop');
    if (existing) existing.remove();

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'custom-alert-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.top = 0; backdrop.style.left = 0;
    backdrop.style.right = 0; backdrop.style.bottom = 0;
    backdrop.style.background = 'rgba(0,0,0,0.3)';
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.zIndex = 9999;

    // Card
    const card = document.createElement('div');
    card.style.background = '#fff';
    card.style.borderRadius = '16px';
    card.style.padding = '24px 18px';
    card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.16)';
    card.style.minWidth = '320px';
    card.style.maxWidth = '90vw';
    card.style.textAlign = 'center';
    card.style.border = '2px solid #0ec6d5';

    // Título
    const h3 = document.createElement('h3');
    h3.innerText = title || 'Ops! Não encontramos sua empresa';
    h3.style.color = '#0ec6d5';
    h3.style.marginBottom = '10px';
    h3.style.fontWeight = '700';
    card.appendChild(h3);

    // Mensagem
    const msg = document.createElement('div');
    msg.innerText = message || 'Deseja experimentar a versão de teste gratuita agora?';
    msg.style.marginBottom = '20px';
    msg.style.color = '#444';
    msg.style.fontSize = '16px';
    card.appendChild(msg);

    // Botões
    const btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.justifyContent = 'center';
    btns.style.gap = '12px';

    // Botão Trial
    const trialBtn = document.createElement('button');
    trialBtn.innerText = 'Usar versão de teste';
    trialBtn.style.background = '#0ec6d5';
    trialBtn.style.color = '#fff';
    trialBtn.style.border = 'none';
    trialBtn.style.borderRadius = '5px';
    trialBtn.style.padding = '8px 20px';
    trialBtn.style.fontWeight = '600';
    trialBtn.style.fontSize = '15px';
    trialBtn.style.cursor = 'pointer';
    trialBtn.onclick = () => {
        if (onTrial) onTrial();
        backdrop.remove();
    };
    btns.appendChild(trialBtn);

    // Botão Cancelar
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Cancelar';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = '#0ec6d5';
    cancelBtn.style.border = '2px solid #0ec6d5';
    cancelBtn.style.borderRadius = '5px';
    cancelBtn.style.padding = '8px 20px';
    cancelBtn.style.fontWeight = '600';
    cancelBtn.style.fontSize = '15px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = () => {
        if (onClose) onClose();
        backdrop.remove();
    };
    btns.appendChild(cancelBtn);

    card.appendChild(btns);
    backdrop.appendChild(card);

    // Fecha ao clicar fora do card
    backdrop.onclick = (e) => {
        if (e.target === backdrop) {
            if (onClose) onClose();
            backdrop.remove();
        }
    };

    document.body.appendChild(backdrop);
}
