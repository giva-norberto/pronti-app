// Funções para abrir/fechar modal perfil
function openModalPerfil(nome) {
  document.getElementById('modal-perfil-profissional').style.display = 'flex';
  if (nome) document.getElementById('perfil-profissional-nome').textContent = nome;
}
function closeModalPerfil() {
  document.getElementById('modal-perfil-profissional').style.display = 'none';
}

// Exemplo: abrir modal ao clicar no botão da equipe
document.querySelectorAll('.btn-perfil-profissional').forEach(btn => {
  btn.onclick = () => openModalPerfil(btn.dataset.nome || 'Perfil do Profissional');
});

// O resto do JS para horários permanece igual ao seu (carregarHorarios, salvar, etc.)
