// --------- EXIBE O MODAL QUANDO NÃO LOGADO ---------
setupAuthListener(async (user) => {
    if (!user) {
        showModalAuth();
        showStep('login');
    } else {
        hideModalAuth();
    }
});

// --------- EVENTOS E TROCA DE TELA ---------
window.addEventListener('DOMContentLoaded', () => {
    // Botões para alternar entre login/cadastro
    document.getElementById('modal-auth-btn-to-cadastro').onclick = () => showStep('cadastro');
    document.getElementById('modal-auth-btn-to-login').onclick = () => showStep('login');
    document.getElementById('modal-auth-btn-google').onclick = handleLoginGoogle;
    document.getElementById('modal-auth-form-login').onsubmit = handleLoginEmail;
    document.getElementById('modal-auth-form-cadastro').onsubmit = handleCadastro;
});
