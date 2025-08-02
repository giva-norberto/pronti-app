// servicos.js (VERSÃO CORRIGIDA SEM ONCLICK)

// Dados dos serviços (simulando um banco de dados)
let servicos = [
    {
        id: 1,
        nome: "Corte de Cabelo Masculino",
        descricao: "Corte moderno e personalizado para homens, incluindo lavagem e finalização.",
        preco: 35.00,
        duracao: 45,
        categoria: "Cabelo"
    },
    {
        id: 2,
        nome: "Manicure Completa",
        descricao: "Cuidado completo das unhas das mãos com esmaltação.",
        preco: 25.00,
        duracao: 60,
        categoria: "Unhas"
    },
    {
        id: 3,
        nome: "Limpeza de Pele",
        descricao: "Tratamento facial profundo para limpeza e hidratação da pele.",
        preco: 80.00,
        duracao: 90,
        categoria: "Estética"
    },
    {
        id: 4,
        nome: "Escova Progressiva",
        descricao: "Tratamento para alisamento e redução do volume dos cabelos.",
        preco: 150.00,
        duracao: 180,
        categoria: "Cabelo"
    },
    {
        id: 5,
        nome: "Massagem Relaxante",
        descricao: "Massagem terapêutica para alívio do estresse e tensões musculares.",
        preco: 120.00,
        duracao: 60,
        categoria: "Bem-estar"
    }
];

// Variável para controlar qual serviço será excluído
let servicoParaExcluir = null;

// Função para formatar preço em reais
function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(preco);
}

// Função para formatar duração
function formatarDuracao(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    if (horas > 0) {
        return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
    }
    return `${mins}min`;
}

// Função para renderizar a lista de serviços
function renderizarServicos() {
    const listaServicos = document.getElementById('lista-servicos');
    
    if (servicos.length === 0) {
        listaServicos.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <h3>Nenhum serviço cadastrado</h3>
                <p>Comece adicionando seu primeiro serviço</p>
            </div>
        `;
        return;
    }
    
    // --- ALTERAÇÃO 1: REMOVIDO O 'onclick' DO HTML ---
    // Agora os botões têm apenas 'data-id' para identificação.
    listaServicos.innerHTML = servicos.map(servico => `
        <div class="servico-card">
            <div class="servico-header">
                <h3 class="servico-titulo">${servico.nome}</h3>
                <span class="servico-categoria">${servico.categoria}</span>
            </div>
            <p class="servico-descricao">${servico.descricao}</p>
            <div class="servico-footer">
                <div>
                    <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                    <span class="servico-duracao"> • ${formatarDuracao(servico.duracao)}</span>
                </div>
                <div class="servico-acoes">
                    <button class="btn-acao btn-editar" data-id="${servico.id}">
                        Editar
                    </button>
                    <button class="btn-acao btn-excluir" data-id="${servico.id}">
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Função para confirmar exclusão (abre o modal)
function confirmarExclusao(id) {
    const servico = servicos.find(s => s.id === id);
    if (!servico) return;
    
    servicoParaExcluir = id;
    
    // Atualizar conteúdo do modal
    document.getElementById('modal-titulo').textContent = 'Confirmar Exclusão';
    document.getElementById('modal-mensagem').textContent = 
        `Tem certeza que deseja excluir o serviço "${servico.nome}"? Esta ação não pode ser desfeita.`;
    
    // Mostrar modal
    const modal = document.getElementById('custom-confirm-modal');
    modal.classList.add('ativo');
}

// Função para excluir serviço
function excluirServico() {
    if (servicoParaExcluir) {
        servicos = servicos.filter(s => s.id !== servicoParaExcluir);
        servicoParaExcluir = null;
        renderizarServicos();
        fecharModal();
        
        // Mostrar mensagem de sucesso (opcional)
        alert('Serviço excluído com sucesso!');
    }
}

// Função para fechar modal
function fecharModal() {
    const modal = document.getElementById('custom-confirm-modal');
    modal.classList.remove('ativo');
    servicoParaExcluir = null;
}

// Função para editar serviço (placeholder)
function editarServico(id) {
    const servico = servicos.find(s => s.id === id);
    if (servico) {
        alert(`Funcionalidade de edição será implementada para: ${servico.nome}`);
    }
}

// --- ALTERAÇÃO 2: 'addEventListener' CENTRALIZADO ---
// Todo o controle de cliques agora acontece aqui, no JavaScript.
document.addEventListener('DOMContentLoaded', function() {
    // Renderizar serviços ao carregar a página
    renderizarServicos();
    
    // Botão confirmar do modal
    document.getElementById('modal-btn-confirmar').addEventListener('click', excluirServico);
    
    // Botão cancelar do modal
    document.getElementById('modal-btn-cancelar').addEventListener('click', fecharModal);
    
    // Fechar modal clicando fora dele
    document.getElementById('custom-confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            fecharModal();
        }
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            fecharModal();
        }
    });

    // NOVO: Adiciona um único "escutador" para todos os cliques na lista de serviços
    document.getElementById('lista-servicos').addEventListener('click', function(e) {
        const target = e.target.closest('.btn-acao'); // Procura pelo botão mais próximo que foi clicado
        if (!target) return; // Se não clicou em um botão de ação, não faz nada

        const id = Number(target.dataset.id); // Pega o ID do botão e converte para número

        if (target.classList.contains('btn-editar')) {
            editarServico(id);
        }

        if (target.classList.contains('btn-excluir')) {
            confirmarExclusao(id);
        }
    });
});
