// ======================================================================
// ARQUIVO: servicos.js (VERSÃO CORRIGIDA E CENTRALIZADA)
// ======================================================================

// 1. Importa as funções do Firestore e Auth da versão correta
import { collection, doc, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 2. A CORREÇÃO MAIS IMPORTANTE ESTÁ AQUI:
//    Importa 'db' e 'auth' do arquivo de configuração MESTRE do painel.
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
const listaServicosDiv = document.getElementById('lista-servicos' );
const btnAddServico = document.querySelector('.btn-new');
const loader = document.getElementById('loader');
const appContent = document.getElementById('app-content');

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;

/**
 * Obtém o ID da empresa ativa do localStorage.
 */
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId");
}

/**
 * Formata um número para o padrão de moeda BRL.
 */
function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco || 0);
}

/**
 * Renderiza a lista de serviços na tela.
 */
function renderizarServicos(servicos) {
    if (!listaServicosDiv) return;

    if (!servicos || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>`;
        return;
    }
    
    servicos.sort((a, b) => a.nome.localeCompare(b.nome));
    
    listaServicosDiv.innerHTML = servicos.map(servico => `
        <div class="servico-card">
            <div class="servico-header">
                <h3 class="servico-titulo">${servico.nome}</h3>
            </div>
            <p class="servico-descricao">${servico.descricao || 'Sem descrição.'}</p>
            <div class="servico-footer">
                <div>
                    <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                    <span class="servico-duracao"> • ${servico.duracao || 0} min</span>
                </div>
                <div class="servico-acoes">
                    <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
                    ${isDono ? `<button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>` : ""}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Carrega os serviços da subcoleção da empresa ativa no Firestore.
 */
async function carregarServicosDoFirebase() {
    if (!empresaId) {
        if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">ID da empresa não encontrado.</p>';
        return;
    }
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>A carregar serviços...</p>';

    // Esta linha agora vai funcionar, pois 'db' será uma instância válida.
    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const snap = await getDocs(servicosCol);
    const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarServicos(servicos);
}

/**
 * Lida com a exclusão de um serviço.
 */
async function excluirServico(servicoIdParaExcluir) {
    if (!isDono) {
        await showAlert("Acesso Negado", "Apenas o dono pode excluir serviços.");
        return;
    }
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoIdParaExcluir);
    await deleteDoc(servicoRef);
    await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    await carregarServicosDoFirebase();
}

/**
 * Ponto de entrada principal da página.
 */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    if (loader) loader.style.display = 'block';
    if (appContent) appContent.style.display = 'none';

    try {
        empresaId = getEmpresaIdAtiva();
        if (!empresaId) {
            if (loader) loader.innerHTML = '<p style="color:red;">Nenhuma empresa ativa selecionada. Retorne ao painel e selecione uma.</p>';
            return;
        }

        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);

        isDono = empresaSnap.exists() && empresaSnap.data().donoId === user.uid;

        if (btnAddServico) {
            btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
        }

        await carregarServicosDoFirebase();

    } catch (error) {
        console.error("Erro fatal durante a inicialização:", error);
        if (loader) loader.innerHTML = `<p style="color:red;">Ocorreu um erro crítico: ${error.message}</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
    }
});

// --- Listeners de Eventos ---

if (listaServicosDiv) {
    listaServicosDiv.addEventListener('click', function(e) {
        const target = e.target.closest('.btn-acao');
        if (!target) return;
        
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-editar')) {
            window.location.href = `novo-servico.html?id=${id}`;
        }
        if (target.classList.contains('btn-excluir')) {
            excluirServico(id);
        }
    });
}

if (btnAddServico) {
    btnAddServico.addEventListener('click', (e) => {
        e.preventDefault();
        if (isDono) {
            window.location.href = 'novo-servico.html';
        }
    });
}
