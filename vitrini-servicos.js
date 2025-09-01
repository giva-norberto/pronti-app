import { db, collection, getDocs, query, where } from './vitrini-firebase.js';

const listaServicosDiv = document.getElementById('lista-servicos');
const detalhesServicoDiv = document.getElementById('detalhes-servico');
const categoriasDiv = document.getElementById('categorias-servicos');

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
 * Renderiza as categorias e permite expandir/recolher serviços por categoria
 */
function renderizarCategoriasEServicos(servicos) {
    if (!listaServicosDiv) return;

    if (!servicos || !Array.isArray(servicos) || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço disponível.</p>`;
        if (detalhesServicoDiv) detalhesServicoDiv.innerHTML = '';
        return;
    }

    // Agrupa por categoria
    const agrupados = {};
    servicos.forEach(servico => {
        const cat = (servico.categoria && servico.categoria.trim()) ? servico.categoria.trim() : "Sem Categoria";
        if (!agrupados[cat]) agrupados[cat] = [];
        agrupados[cat].push(servico);
    });

    // Ordena categorias
    const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Renderiza categorias como botões/lista
    let htmlCategorias = `<div class="categorias-lista">`;
    categoriasOrdenadas.forEach((cat, idx) => {
        htmlCategorias += `
            <button class="categoria-btn" data-cat="${cat}" ${idx === 0 ? 'data-ativo="1"' : ''}>
                ${cat}
            </button>
        `;
    });
    htmlCategorias += `</div><div id="servicos-por-categoria"></div>`;

    listaServicosDiv.innerHTML = htmlCategorias;

    // Lista dos serviços por categoria (exibe só da categoria ativa)
    function renderizarServicosDaCategoria(catAtual) {
        const servicosCat = agrupados[catAtual];
        if (!servicosCat || servicosCat.length === 0) {
            document.getElementById('servicos-por-categoria').innerHTML = `<p>Nenhum serviço nesta categoria.</p>`;
            if (detalhesServicoDiv) detalhesServicoDiv.innerHTML = '';
            return;
        }
        document.getElementById('servicos-por-categoria').innerHTML = servicosCat.map((servico, idx) => `
            <div class="servico-card" data-idx="${idx}" data-cat="${catAtual}">
                <h3>${servico.nome ? servico.nome : '<span style="color:red">Sem nome</span>'}</h3>
                <div>${servico.preco !== undefined && servico.preco !== null ? formatarPreco(servico.preco) : '<span style="color:red">Preço não informado</span>'}</div>
            </div>
        `).join('');

        document.querySelectorAll('.servico-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('.servico-card.selecionado').forEach(c => c.classList.remove('selecionado'));
                card.classList.add('selecionado');
                renderizarDetalhesServicoVitrine(servicosCat[card.dataset.idx]);
            };
        });
    }

    // Evento de click nos botões de categoria
    listaServicosDiv.querySelectorAll('.categoria-btn').forEach(btn => {
        btn.onclick = () => {
            listaServicosDiv.querySelectorAll('.categoria-btn').forEach(b => b.removeAttribute('data-ativo'));
            btn.setAttribute('data-ativo', '1');
            renderizarServicosDaCategoria(btn.dataset.cat);
        };
    });

    // Inicializa mostrando a primeira categoria
    if (categoriasOrdenadas.length > 0) {
        renderizarServicosDaCategoria(categoriasOrdenadas[0]);
    }
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
 * Busca e carrega os serviços do Firebase para a vitrine.
 * Filtra apenas os serviços visíveis na vitrine.
 * Se profissionalId for fornecido, busca por profissional. Caso contrário, pela empresa.
 * MULTIEMPRESA: empresaId deve ser passado corretamente pelo contexto de chamada.
 */
export async function carregarServicosVitrine(empresaId, profissionalId = null) {
    try {
        let servicosCol;
        if (profissionalId) {
            servicosCol = collection(db, "empresarios", empresaId, "profissionais", profissionalId, "servicos");
        } else {
            servicosCol = collection(db, "empresarios", empresaId, "servicos");
        }

        // Filtra apenas serviços visíveis na vitrine
        const servicosQuery = query(servicosCol, where("visivelNaVitrine", "==", true));
        const snap = await getDocs(servicosQuery);
        const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // LOG para validação!
        console.log("SERVIÇOS VITRINE:", servicos);

        renderizarCategoriasEServicos(servicos);
    } catch (error) {
        console.error("Erro ao buscar serviços da vitrine:", error);
        if (listaServicosDiv) {
            listaServicosDiv.innerHTML = `<p>Erro ao carregar serviços. Tente novamente mais tarde.</p>`;
        }
        if (detalhesServicoDiv) {
            detalhesServicoDiv.innerHTML = '';
        }
    }
}
