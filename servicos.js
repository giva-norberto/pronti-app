// servicos.js (VERSÃO DEFINITIVA E CORRIGIDA PARA FIREBASE v10)
console.log("servicos.js carregado!");
listaServicosDiv.addEventListener('click', function(e) {
  console.log("Clique detectado em listaServicosDiv", e.target);
  alert("Clique detectado em listaServicosDiv");
});
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

// =================================================================================
// INICIALIZAÇÃO E ESTADO
// =================================================================================
const listaServicosDiv = document.getElementById('lista-servicos');
let profissionalRef = null;

// =================================================================================
// FUNÇÕES DE UTILIDADE
// =================================================================================

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const modalTitle = document.getElementById('modal-titulo');
        const modalMessage = document.getElementById('modal-mensagem');
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        const btnCancelar = document.getElementById('modal-btn-cancelar');

        if (!modal || !modalTitle || !modalMessage || !btnConfirmar || !btnCancelar) {
            console.error("Elementos do modal não encontrados no HTML!");
            resolve(confirm(message)); // Usa o confirm antigo como fallback
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        const close = (value) => {
            modal.classList.remove('ativo');
            resolve(value);
        };

        const newBtnConfirmar = btnConfirmar.cloneNode(true);
        const newBtnCancelar = btnCancelar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(newBtnConfirmar, btnConfirmar);
        btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);

        newBtnConfirmar.addEventListener('click', () => close(true));
        newBtnCancelar.addEventListener('click', () => close(false));
        
        modal.classList.add('ativo');
    });
}

// =================================================================================
// FUNÇÕES DE LÓGICA PRINCIPAL
// =================================================================================

async function getEmpresaIdDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.error("Nenhuma empresa encontrada para o dono com UID:", uid);
        return null;
    }
    return snapshot.docs[0].id;
}

function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

function renderizarServicos(servicos) {
    if (!servicos || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>`;
        return;
    }
    servicos.sort((a, b) => a.nome.localeCompare(b.nome));
    listaServicosDiv.innerHTML = servicos.map(servico => `
        <div class="servico-card">
            <div class="servico-header">
                <h3 class="servico-titulo">${servico.nome}</h3>
                <!-- Campo de categoria removido -->
            </div>
            <p class="servico-descricao">${servico.descricao}</p>
            <div class="servico-footer">
                <div>
                    <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                    <span class="servico-duracao"> • ${servico.duracao} min</span>
                </div>
                <div class="servico-acoes">
                    <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
                    <button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function carregarServicosDoFirebase() {
    if (!profissionalRef) {
        listaServicosDiv.innerHTML = '<p style="color:red;">Perfil profissional não encontrado.</p>';
        return;
    }
    listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
    try {
        const docSnap = await getDoc(profissionalRef);
        if (docSnap.exists()) {
            const servicos = docSnap.data().servicos || [];
            renderizarServicos(servicos);
        } else {
            renderizarServicos([]);
        }
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    }
}

async function excluirServico(servicoIdParaExcluir) {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        const docSnap = await getDoc(profissionalRef);
        if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");

        const servicosAtuais = docSnap.data().servicos || [];
        const novaListaDeServicos = servicosAtuais.filter(s => String(s.id) !== servicoIdParaExcluir);

        await updateDoc(profissionalRef, { servicos: novaListaDeServicos });
        alert("Serviço excluído com sucesso!");
        carregarServicosDoFirebase();
    } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        alert("Ocorreu um erro ao excluir o serviço.");
    }
}

// =================================================================================
// PONTO DE PARTIDA E EVENT LISTENERS
// =================================================================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
            carregarServicosDoFirebase();
        } else {
            listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
        }
    } else {
        window.location.href = 'login.html';
    }
});

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
