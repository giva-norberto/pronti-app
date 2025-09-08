// ======================================================================
// ARQUIVO: servicos.js (VERSÃO NOTA 10 - LAYOUT FINAL + TEMPO REAL)
// ======================================================================

import { collection, doc, getDoc, deleteDoc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { showCustomConfirm, showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');

// --- Variáveis de Estado ---
let empresaId = null;
let isDono = false;

// Obtém o empresaId da empresa ativa do localStorage
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

// --- Inicialização e Autenticação ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            empresaId = getEmpresaIdAtiva();
            if (!empresaId) {
                if(listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Nenhuma empresa ativa selecionada.</p>';
                return;
            }

            const empresaRef = doc(db, "empresarios", empresaId);
            const empresaSnap = await getDoc(empresaRef);
            if (empresaSnap.exists()) {
                isDono = empresaSnap.data().donoId === user.uid;
            }

            if (btnAddServico) {
                btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
            }

            iniciarListenerDeServicos();

        } catch (error) {
            console.error("Erro durante a inicialização:", error);
            if(listaServicosDiv) listaServicosDiv.innerHTML = `<p style="color:red;">Ocorreu um erro crítico ao carregar a página.</p>`;
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- Listener em Tempo Real ---
function iniciarListenerDeServicos() {
    if (!empresaId) return;
    if (listaServicosDiv) listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

    const servicosCol = collection(db, "empresarios", empresaId, "servicos");
    const q = query(servicosCol);

    onSnapshot(q, (snapshot) => {
        const servicos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarServicos(servicos);
    }, (error) => {
        console.error("Erro ao carregar serviços em tempo real:", error);
        if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    });
}

// --- ⭐ Renderização Final (Com Categoria + Card Limpo) ---
function renderizarServicos(servicos) {
    if (!listaServicosDiv) return;

    if (!servicos || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. ${isDono ? 'Clique em "Adicionar Novo Serviço" para começar.' : ''}</p>`;
        return;
    }

    // 1. Agrupa os serviços por categoria
    const agrupados = {};
    servicos.forEach(servico => {
        const cat = (servico.categoria && servico.categoria.trim()) ? servico.categoria.trim() : "Sem Categoria";
        if (!agrupados[cat]) agrupados[cat] = [];
        agrupados[cat].push(servico);
    });

    // 2. Ordena as categorias em ordem alfabética
    const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => a.localeCompare(b, "pt-BR"));

    // 3. Gera o HTML final
    listaServicosDiv.innerHTML = categoriasOrdenadas.map(cat => {
        // Ordena os serviços dentro de cada categoria
        const servicosCategoria = agrupados[cat].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        
        return `
            <div class="categoria-bloco">
                <h2 class="categoria-titulo" style="color: #6366f1; margin-top: 24px; margin-bottom: 12px;">
                    ${sanitizeHTML(cat)}
                </h2>
                ${servicosCategoria.map(servico => `
                    <div class="servico-card">
                        <div class="servico-header">
                            <h3 class="servico-titulo">${sanitizeHTML(servico.nome)}</h3>
                        </div>
                        <p class="servico-descricao">${sanitizeHTML(servico.descricao) || ''}</p>
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
                `).join("")}
            </div>
        `;
    }).join("");
}


async function excluirServico(servicoId) {
    if (!isDono) {
        await showAlert("Acesso Negado", "Apenas o dono pode excluir serviços.");
        return;
    }
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.");
    if (!confirmado) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        await showAlert("Sucesso!", "Serviço excluído com sucesso!");
    } catch (error) {
        await showAlert("Erro", "Ocorreu um erro ao excluir o serviço: " + error.message);
    }
}

function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco || 0);
}

function sanitizeHTML(str) {
    if (!str) return "";
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// --- Event Listeners ---
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
        if (!isDono) {
            e.preventDefault();
            showAlert("Acesso Negado", "Apenas o dono pode adicionar serviços.");
        } else {
            e.preventDefault();
            window.location.href = 'novo-servico.html';
        }
    });
}
