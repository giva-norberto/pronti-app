import { db, collection, getDocs } from './vitrini-firebase.js';

const listaServicosDiv = document.getElementById('lista-servicos');
const detalhesServicoDiv = document.getElementById('detalhes-servico');

/**
 * Formata preço para moeda brasileira
 */
function formatarPreco(preco) {
    if (preco === undefined || preco === null || preco === "") return "Preço não informado";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

/**
 * Formata duração
 */
function formatarDuracao(duracao) {
    if (!duracao) return "Duração não informada";
    return `${duracao} min`;
}

/**
 * Renderiza os cards de serviços
 */
function renderizarServicosVitrine(servicos) {
    if (!listaServicosDiv) return;
    if (!servicos || !Array.isArray(servicos) || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço disponível.</p>`;
        if (detalhesServicoDiv) detalhesServicoDiv.innerHTML = '';
        return;
    }

    listaServicosDiv.innerHTML = servicos.map((servico, idx) => `
        <div class="servico-card" data-idx="${idx}">
            <h3>${servico.nome ? servico.nome : '<span style="color:red">Sem nome</span>'}</h3>
            <div>${servico.preco !== undefined && servico.preco !== null ? formatarPreco(servico.preco) : '<span style="color:red">Preço não informado</span>'}</div>
        </div>
    `).join('');

    listaServicosDiv.querySelectorAll('.servico-card').forEach(card => {
        card.onclick = () => {
            listaServicosDiv.querySelectorAll('.servico-card.selecionado').forEach(c => c.classList.remove('selecionado'));
            card.classList.add('selecionado');
            renderizarDetalhesServicoVitrine(servicos[card.dataset.idx]);
        };
    });
}

/**
 * Renderiza detalhes do serviço selecionado
 */
function renderizarDetalhesServicoVitrine(servico) {
    if (!detalhesServicoDiv) return;
    detalhesServicoDiv.innerHTML = `
        <div class="detalhe-servico-card">
            <strong>Duração:</strong> ${servico.duracao ? formatarDuracao(servico.duracao) : "Duração não informada"}<br>
            <strong>Descrição:</strong> ${servico.descricao ? servico.descricao : "Sem descrição."}
        </div>
    `;
}

/**
 * Busca e carrega os serviços do Firebase para a vitrini
 * Troque o caminho da collection se for por profissional!
 */
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
