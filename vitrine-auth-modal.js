// --------- EXIBE O MODAL QUANDO NÃO LOGADO ---------
if (typeof setupAuthListener === "function") {
  setupAuthListener(async (user) => {
    if (!user) {
      if (typeof showModalAuth === "function") showModalAuth();
      if (typeof showStep === "function") showStep('login');
    } else {
      if (typeof hideModalAuth === "function") hideModalAuth();
    }
  });
} else {
  console.error("setupAuthListener não está definido.");
}

// --------- EVENTOS E TROCA DE TELA ---------
window.addEventListener('DOMContentLoaded', () => {
  const btnToCadastro = document.getElementById('modal-auth-btn-to-cadastro');
  const btnToLogin = document.getElementById('modal-auth-btn-to-login');
  const btnGoogle = document.getElementById('modal-auth-btn-google');
  const formLogin = document.getElementById('modal-auth-form-login');
  const formCadastro = document.getElementById('modal-auth-form-cadastro');

  if (btnToCadastro) btnToCadastro.onclick = () => showStep && showStep('cadastro');
  if (btnToLogin) btnToLogin.onclick = () => showStep && showStep('login');
  if (btnGoogle) btnGoogle.onclick = () => handleLoginGoogle && handleLoginGoogle();
  if (formLogin) formLogin.onsubmit = (event) => handleLoginEmail && handleLoginEmail(event);
  if (formCadastro) formCadastro.onsubmit = (event) => handleCadastro && handleCadastro(event);
});
