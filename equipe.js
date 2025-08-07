// Exemplo de integração básica (adapte para seu Firebase!)
// Preenche cards, ativa modal de adicionar e perfil, sem debug.

document.addEventListener("DOMContentLoaded", () => {
    // Ativa botão após inicialização do sistema
    document.getElementById('btn-add-profissional').disabled = false;

    // Exemplo estático. Substitua por dados vindos do Firebase!
    const profissionais = [
        {
            id: "1",
            nome: "Givanildo Silva",
            fotoUrl: "",
            ehDono: true,
            horarios: {},
            status: "Dono"
        },
        {
            id: "2",
            nome: "Givanildo Funcionário",
            fotoUrl: "",
            ehDono: false,
            horarios: {},
            status: "Funcionário"
        }
    ];

    const painel = document.getElementById('lista-profissionais-painel');
    painel.innerHTML = "";
    profissionais.forEach(profissional => {
        const div = document.createElement("div");
        div.className = "profissional-card";
        div.innerHTML = `
            <div class="profissional-foto">
                <img src="${profissional.fotoUrl || 'https://placehold.co/60x60?text=User'}" alt="Foto de ${profissional.nome}" />
            </div>
            <div class="profissional-info">
                <span class="profissional-nome">${profissional.nome}</span>
                <span class="profissional-status">${profissional.status}</span>
            </div>
            <button class="btn btn-perfil-profissional" data-id="${profissional.id}">👤 Perfil</button>
        `;
        painel.appendChild(div);
    });

    // Abrir modal de adicionar profissional
    document.getElementById('btn-add-profissional').onclick = () => {
        document.getElementById('form-add-profissional').reset();
        document.getElementById('modal-add-profissional').classList.add('show');
    };
    document.getElementById('btn-cancelar-profissional').onclick = () => {
        document.getElementById('modal-add-profissional').classList.remove('show');
    };

    // Abrir modal de perfil profissional
    document.querySelectorAll('.btn-perfil-profissional').forEach(btn => {
        btn.onclick = () => {
            const card = btn.closest('.profissional-card');
            document.getElementById('perfil-profissional-nome').textContent = card.querySelector('.profissional-nome').textContent;
            document.getElementById('modal-perfil-profissional').classList.add('show');
        };
    });

    // Fechar modal ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Tabs do modal perfil
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById('tab-' + tab).classList.add('active');
        };
    });
});
