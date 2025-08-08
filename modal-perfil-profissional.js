// Elementos do modal de perfil profissional
const modalPerfilProfissional = document.getElementById('modal-perfil-profissional');
const perfilNomeProfissional = document.getElementById('perfil-nome-profissional');
const servicosLista = document.getElementById('servicos-lista');
const horariosLista = document.getElementById('horarios-lista');
const btnCancelarPerfil = document.getElementById('btn-cancelar-perfil');
const btnSalvarPerfil = document.getElementById('btn-salvar-perfil');

let profissionalAtual = null;
let servicosDisponiveis = [];
let horariosBase = {
    segunda: { ativo: false, inicio: '09:00', fim: '18:00' },
    terca: { ativo: false, inicio: '09:00', fim: '18:00' },
    quarta: { ativo: false, inicio: '09:00', fim: '18:00' },
    quinta: { ativo: false, inicio: '09:00', fim: '18:00' },
    sexta: { ativo: false, inicio: '09:00', fim: '18:00' },
    sabado: { ativo: false, inicio: '09:00', fim: '18:00' },
    domingo: { ativo: false, inicio: '09:00', fim: '18:00' }
};

function abrirModalPerfilProfissional(profissionalId, nomeProfissional, servicos, horarios) {
    profissionalAtual = profissionalId;
    perfilNomeProfissional.textContent = `👤 Perfil de ${nomeProfissional}`;
    renderizarServicos(servicos);
    renderizarHorarios(horarios || horariosBase);
    modalPerfilProfissional.classList.add('show');
}

function fecharModalPerfilProfissional() {
    modalPerfilProfissional.classList.remove('show');
}

// Renderiza os serviços disponíveis e selecionados
function renderizarServicos(servicosSelecionados = []) {
    servicosLista.innerHTML = '';
    if (servicosDisponiveis.length === 0) {
        servicosLista.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #6c757d;">
            <p>Nenhum serviço cadastrado ainda.</p>
            <p>Vá para a página de serviços para adicionar serviços.</p>
        </div>`;
        return;
    }
    servicosDisponiveis.forEach(servico => {
        const div = document.createElement("div");
        div.className = "servico-item";
        div.setAttribute('data-servico-id', servico.id);
        div.innerHTML = `
            <div class="servico-nome">${servico.nome}</div>
            <div class="servico-preco">R$ ${servico.preco.toFixed(2)}</div>
        `;
        if (servicosSelecionados.includes(servico.id)) {
            div.classList.add('selected');
        }
        div.addEventListener('click', () => {
            div.classList.toggle('selected');
        });
        servicosLista.appendChild(div);
    });
}

// Renderiza os horários por dia da semana
function renderizarHorarios(horarios = horariosBase) {
    horariosLista.innerHTML = '';
    const diasSemana = [
        { key: 'segunda', nome: 'Segunda-feira' },
        { key: 'terca', nome: 'Terça-feira' },
        { key: 'quarta', nome: 'Quarta-feira' },
        { key: 'quinta', nome: 'Quinta-feira' },
        { key: 'sexta', nome: 'Sexta-feira' },
        { key: 'sabado', nome: 'Sábado' },
        { key: 'domingo', nome: 'Domingo' }
    ];
    diasSemana.forEach(dia => {
        const div = document.createElement("div");
        div.className = "dia-horario";
        div.setAttribute('data-dia', dia.key);
        div.innerHTML = `
            <div class="dia-nome">
                <label>
                    <input type="checkbox" ${horarios[dia.key].ativo ? 'checked' : ''}>
                    ${dia.nome}
                </label>
            </div>
            <div class="horario-inputs">
                <input type="time" name="inicio" value="${horarios[dia.key].inicio}">
                <span>até</span>
                <input type="time" name="fim" value="${horarios[dia.key].fim}">
            </div>
        `;
        horariosLista.appendChild(div);
    });
}

// Salva perfil do profissional (serviços e horários)
async function salvarPerfilProfissionalFirebase(db, empresaId) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    try {
        // Coletar serviços selecionados
        const servicosSelecionados = [];
        servicosLista.querySelectorAll('.servico-item.selected').forEach(item => {
            servicosSelecionados.push(item.getAttribute('data-servico-id'));
        });
        // Coletar horários
        const horarios = {};
        horariosLista.querySelectorAll('.dia-horario').forEach(diaElement => {
            const dia = diaElement.getAttribute('data-dia');
            const checkbox = diaElement.querySelector('input[type="checkbox"]');
            const inicio = diaElement.querySelector('input[name="inicio"]');
            const fim = diaElement.querySelector('input[name="fim"]');
            horarios[dia] = {
                ativo: checkbox.checked,
                inicio: inicio.value,
                fim: fim.value
            };
        });
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", profissionalAtual);
        await updateDoc(profissionalRef, { servicos: servicosSelecionados, horarios });
        fecharModalPerfilProfissional();
        alert("✅ Perfil atualizado com sucesso!");
    } catch (error) {
        alert("❌ Erro ao salvar perfil: " + error.message);
    }
}

// Event listeners do modal
btnCancelarPerfil.addEventListener("click", fecharModalPerfilProfissional);
btnSalvarPerfil.addEventListener("click", async () => {
    // db e empresaId devem ser passados do contexto principal
    if (window.db && window.empresaId) {
        await salvarPerfilProfissionalFirebase(window.db, window.empresaId);
    } else {
        alert("Erro: banco de dados não inicializado.");
    }
});

// Fechar modal ao clicar fora da caixa
modalPerfilProfissional.addEventListener("click", (e) => {
    if (e.target === modalPerfilProfissional) {
        fecharModalPerfilProfissional();
    }
});

// Exporta função global para abrir o modal
window.abrirModalPerfilProfissional = abrirModalPerfilProfissional;
window.servicosDisponiveis = servicosDisponiveis; // Se quiser atualizar de fora
