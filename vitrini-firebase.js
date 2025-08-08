import { collection, getDocs } from "./vitrini-firebase.js";

const listaServicosDiv = document.getElementById('lista-servicos');
const detalhesServicoDiv = document.getElementById('detalhes-servico');

function formatarPreco(preco) {
    if (!preco) return "Preço não informado";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}
function formatarDuracao(duracao) {
    if (!duracao) return "Duração não informada";
    return `${duracao} min`;
}

function renderizarServicosVitrine(servicos) {
    // VALIDAÇÃO
    if (!servicos || !Array.isArray(servicos) || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço disponível na vitrini.</p>`;
        detalhesServicoDiv.innerHTML = '';
        return;
    }
    // FILTRA SÓ OS SERVIÇOS VÁLIDOS (com nome e preço)
    const servicosValidos = servicos.filter(s => s.nome && s.preco !== undefined && s.preco !== null);

    if (servicosValidos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Não há serviços válidos cadastrados no momento.</p>`;
        detalhesServicoDiv.innerHTML = '';
        return;
    }

    listaServicosDiv.innerHTML = servicosValidos.map((servico, idx) => `
        <div class="servico-card" data-idx="${idx}">
            <div class="servico-header">
                <h3>${servico.nome}</h3>
                <span>${formatarPreco(servico.preco)}</span>
            </div>
        </div>
    `).join('');

    listaServicosDiv.querySelectorAll('.servico-card').forEach(card => {
        card.onclick = () => {
            listaServicosDiv.querySelectorAll('.servico-card.selecionado').forEach(c => c.classList.remove('selecionado'));
            card.classList.add('selecionado');
            renderizarDetalhesServicoVitrine(servicosValidos[card.dataset.idx]);
        };
    });
}

function renderizarDetalhesServicoVitrine(servico) {
    if (!servico) {
        detalhesServicoDiv.innerHTML = '';
        return;
    }
    detalhesServicoDiv.innerHTML = `
        <div class="detalhe-servico-card">
            <h4>${servico.nome}</h4>
            <p><strong>Duração:</strong> ${formatarDuracao(servico.duracao)}</p>
            <p><strong>Descrição:</strong> ${servico.descricao ? servico.descricao : 'Sem descrição.'}</p>
        </div>
    `;
}

export async function carregarServicosVitrine(empresaId, profissionalId = null) {
    let servicosCol;
    if (profissionalId) {
        servicosCol = collection(db, "empresarios", empresaId, "profissionais", profissionalId, "servicos");
    } else {
        servicosCol = collection(db, "empresarios", empresaId, "servicos");
    }
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // LOG para validação!
    console.log("SERVIÇOS VITRINE:", servicos);

    renderizarServicosVitrine(servicos);
}
