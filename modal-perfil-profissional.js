export function abrirModalPerfilProfissional(profissionalId) {
  const modal = document.getElementById('modal-perfil-profissional');
  if (!modal) return;
  modal.style.display = 'block';

  // Garantir evento do botão X
  const btnFechar = document.getElementById('btn-fechar-modal-perfil');
  if (btnFechar) btnFechar.onclick = () => { modal.style.display = 'none'; };

  // Renderização de exemplo dos dias/horários
  const diasContainer = document.getElementById('dias-container');
  if (diasContainer) {
    diasContainer.innerHTML = '';
    ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'].forEach(dia => {
      diasContainer.innerHTML += `
        <div class="dia-semana">
          <div class="dia-info">
            <span class="dia-nome">${dia}</span>
            <button class="btn-add-slot">+ Horário</button>
          </div>
          <div class="horarios-container">
            <div class="bloco-horario">
              <input type="time" class="horario-inicio" value="09:00"> até
              <input type="time" class="horario-fim" value="18:00">
              <button class="btn-remove-slot">Remover</button>
            </div>
          </div>
        </div>
      `;
    });
  }
}
