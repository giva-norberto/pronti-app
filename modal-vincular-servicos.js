// Funções para abrir/fechar modal de serviços
function openModalVincularServicos() {
  document.getElementById('modal-vincular-servicos').style.display = 'flex';
  carregarServicosVincular(); // Carrega serviços via Firebase
}
function closeModalVincularServicos() {
  document.getElementById('modal-vincular-servicos').style.display = 'none';
}

// Exemplo de função para carregar e vincular serviços
async function carregarServicosVincular() {
  const servicosContainer = document.getElementById('servicos-container');
  servicosContainer.innerHTML = 'Carregando...';

  // Simule busca no Firebase (substitua pelo seu fetch real)
  const servicos = [
    { id: '1', nome: 'Corte', ativo: true },
    { id: '2', nome: 'Barba', ativo: false }
  ];

  servicosContainer.innerHTML = '';
  servicos.forEach(servico => {
    const div = document.createElement('div');
    div.className = 'servico-item';
    div.innerHTML = `
      <span>${servico.nome}</span>
      <button type="button" class="btn-servico-vincular ${servico.ativo ? 'ativo' : ''}" data-id="${servico.id}">
        ${servico.ativo ? 'Ativo' : 'Inativo'}
      </button>
    `;
    servicosContainer.appendChild(div);
  });

  servicosContainer.querySelectorAll('.btn-servico-vincular').forEach(btn => {
    btn.onclick = function() {
      btn.classList.toggle('ativo');
      btn.textContent = btn.classList.contains('ativo') ? 'Ativo' : 'Inativo';
      // Aqui você faz o update no Firebase!
    };
  });
}
