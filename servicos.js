// servicos.js
// RESPONSABILIDADE: Gerenciar a listagem, exclusão e navegação dos serviços cadastrados pela empresa no painel Pronti.

import { collection, doc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

const listaServicosDiv = document.getElementById('lista-servicos');
const btnAddServico = document.querySelector('.btn-new');
const loader = document.getElementById('loader'); // Adicionado para controle do loader
const appContent = document.getElementById('app-content'); // Adicionado para controle do conteúdo

let empresaId = null;
let isDono = false;

// --- LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const empresa = await getEmpresaDoUsuario(user.uid);
            if (empresa) {
                empresaId = empresa.id;
                isDono = empresa.donoId === user.uid;
                
                await carregarServicosDoFirebase();
                
                if (btnAddServico) {
                    btnAddServico.style.display = isDono ? 'inline-flex' : 'none';
                }
                
                // Esconde o loader e mostra o conteúdo principal
                if(loader) loader.style.display = 'none';
                if(appContent) appContent.style.display = 'block';

            } else {
                // Se não encontrar empresa, mostra uma mensagem de erro clara
                if(loader) loader.innerHTML = '<p style="color:red;">Nenhuma empresa associada a este utilizador. Verifique se o seu perfil está configurado corretamente.</p>';
            }
        } catch (error) {
            console.error("Erro fatal durante a inicialização:", error);
            if(loader) loader.innerHTML = `<p style="color:red;">Ocorreu um erro crítico ao carregar a página.</p>`;
        }
    } else {
        window.location.href = 'login.html';
    }
});


// --- FUNÇÕES DA PÁGINA ---

// CORREÇÃO: Função de busca de empresa simplificada e mais robusta
async function getEmpresaDoUsuario(uid) {
    // A lógica correta para o painel do dono é buscar apenas pela propriedade 'donoId'
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
}

async function carregarServicosDoFirebase() {
    if (!empresaId) {
        if (listaServicosDiv) listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
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
            <p class="servico-descricao">${servico.descricao || ''}</p>
            <div class="servico-footer">
                <div>
                    <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                    <span class="servico-duracao"> • ${servico.duracao} min</span>
                </div>
                <div class="servico-acoes">
                    <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
                    ${isDono ? `<button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>` : ""}
                </div>
            </div>
        </div>
    `).join('');
}

async function excluirServico(servicoId) {
    if (!isDono) {
        alert("Apenas o dono pode excluir serviços.");
        return;
    }
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem a certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        alert("Serviço excluído com sucesso!");
        await carregarServicosDoFirebase();
    } catch (error) {
        alert("Ocorreu um erro ao excluir o serviço: " + error.message);
    }
}

// --- FUNÇÕES UTILITÁRIAS ---

function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco || 0);
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const modalTitle = document.getElementById('modal-titulo');
        const modalMessage = document.getElementById('modal-mensagem');
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        const btnCancelar = document.getElementById('modal-btn-cancelar');

        if (!modal || !modalTitle || !modalMessage || !btnConfirmar || !btnCancelar) {
            resolve(confirm(message));
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        const newBtnConfirmar = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(newBtnConfirmar, btnConfirmar);
        const newBtnCancelar = btnCancelar.cloneNode(true);
        btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);

        const close = (value) => {
            modal.classList.remove('ativo');
            resolve(value);
        };

        newBtnConfirmar.addEventListener('click', () => close(true));
        newBtnCancelar.addEventListener('click', () => close(false));

        modal.classList.add('ativo');
    });
}

// --- EVENT LISTENERS ---

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
    btnAddServico.addEventListener('click', () => {
        window.location.href = 'novo-servico.html';
    });
}
