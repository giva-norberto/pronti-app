export function abrirModalPerfilProfissional(profissional) {
    document.getElementById('perfil-profissional-nome').textContent = profissional.nome || '';
    document.getElementById('modal-perfil-profissional').style.display = 'block';
}
