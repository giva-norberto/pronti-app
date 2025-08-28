// ======================================================================
// ARQUIVO: servicos.js (VERSÃO REVISADA E CENTRALIZADA)
// ======================================================================

// 1. Importa as funções do Firestore e Auth da versão correta
import { collection, doc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 2. IMPORTANTE: Importa 'db' e 'auth' do arquivo de configuração MESTRE
import { db, auth } from "./firebase-config.js"; 
import { showCustomConfirm, showAlert } from "./vitrini-utils.js"; // Supondo que este caminho esteja correto

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
    
    // Ordena os serviços por nome antes de renderizar
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
                    <!-- O botão de editar é visível para todos que podem ver a página -->
                    <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
                    <!-- O botão de excluir só é renderizado se o usuário for o dono -->
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

    try {
        const servicosCol = collection(db, "empresarios", empresaId, "servicos");
        const snap = await getDocs(servicosCol);
        const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarServicos(servicos);
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    }
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

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoIdParaExcluir);
        await deleteDoc(servicoRef);
        await showAlert("Sucesso!", "Serviço excluído com sucesso!");
        await carregarServicosDoFirebase(); // Recarrega a lista após a exclusão
    } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        await showAlert("Erro", "Ocorreu um erro ao excluir o serviço: " + error.message);
    }
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

        // Lógica de permissão simplificada: busca a empresa ativa e verifica o dono.
        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);

        if (empresaSnap.exists() && empresaSnap.data().donoId === user.uid) {
            isDono = true;
        } else {
            isDono = false;
        }

        // Mostra o botão de adicionar apenas para o dono.
        if (btnAddServico) {
            btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
        }

        await carregarServicosDoFirebase();

    } catch (error) {
        console.error("Erro fatal durante a inicialização:", error);
        if (loader) loader.innerHTML = `<p style="color:red;">Ocorreu um erro crítico ao carregar a página.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
    }
});

// --- Listeners de Eventos ---

// Delegação de eventos para os botões na lista de serviços
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

// Listener para o botão de adicionar novo serviço
if (btnAddServico) {
    btnAddServico.addEventListener('click', (e) => {
        e.preventDefault();
        // Apenas o dono pode adicionar, mas o botão já estará escondido se não for.
        // Adicionamos uma verificação extra por segurança.
        if (isDono) {
            window.location.href = 'novo-servico.html';
        }
    });
}
