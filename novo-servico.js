// ======================================================================
// ARQUIVO: novo-servico.js (VERSÃO MAIS SEGURA E CORRIGIDA)
// ======================================================================

import { 
    doc, getDoc, updateDoc, deleteDoc, 
    collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Garante que está importando do arquivo de configuração MESTRE.
import { db, auth } from "./firebase-config.js"; 
import { showAlert } from "./vitrini-utils.js";

// --- Mapeamento de Elementos do DOM ---
const form = document.getElementById('form-servico' );
const btnExcluir = document.getElementById('btn-excluir-servico');
const btnSalvar = form.querySelector('button[type="submit"]');

// --- Variáveis de Estado ---
let empresaId = null;
let servicoId = null;
let currentUser = null; // Armazena o objeto do usuário logado

/**
 * Obtém o ID da empresa ativa do localStorage.
 */
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId");
}

/**
 * Extrai o ID do serviço da URL.
 */
function getIdServicoFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Preenche o formulário com dados de um serviço.
 */
function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco || '';
    document.getElementById('duracao-servico').value = servico.duracao || '';
}

/**
 * Ponto de entrada da página.
 */
async function inicializarPagina() {
    empresaId = getEmpresaIdAtiva();
    servicoId = getIdServicoFromUrl();

    if (!empresaId) {
        await showAlert("Atenção", "Nenhuma empresa ativa selecionada.");
        btnSalvar.disabled = true;
        return;
    }

    // Se estiver editando, carrega os dados do serviço.
    if (servicoId) {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            preencherFormulario(servicoSnap.data());
            if (btnExcluir) btnExcluir.style.display = 'block';
        } else {
            await showAlert("Erro", "Serviço não encontrado.");
            btnSalvar.disabled = true;
        }
    }
}

/**
 * Lida com o envio do formulário.
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    // 1. Verificações iniciais
    if (!currentUser || !empresaId) {
        await showAlert("Erro", "Usuário ou empresa não identificados. Recarregue a página.");
        return;
    }

    // 2. A VERIFICAÇÃO DE PERMISSÃO MAIS IMPORTANTE - FEITA NO MOMENTO DA AÇÃO
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);

    if (!empresaSnap.exists() || empresaSnap.data().donoId !== currentUser.uid) {
        await showAlert("Acesso Negado", "Você não tem permissão para salvar serviços nesta empresa.");
        return;
    }

    // 3. Coleta e validação dos dados do formulário
    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        await showAlert("Atenção", "Preencha todos os campos obrigatórios corretamente.");
        return;
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    // 4. Lógica de salvar no banco de dados
    try {
        const dadosServico = { nome, descricao, preco, duracao, updatedAt: serverTimestamp() };

        if (servicoId) { // Modo Edição
            const servicoDocRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoDocRef, dadosServico);
            await showAlert("Sucesso!", "Serviço atualizado com sucesso!");
        } else { // Modo Criação
            dadosServico.createdAt = serverTimestamp();
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, dadosServico);
            await showAlert("Sucesso!", "Serviço salvo com sucesso!");
        }
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao salvar serviço:", err);
        await showAlert("Erro", `Ocorreu um erro ao salvar: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

// ... (a função handleServicoExcluir pode continuar a mesma) ...
async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!currentUser || !empresaId || !servicoId) return;

    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);

    if (!empresaSnap.exists() || empresaSnap.data().donoId !== currentUser.uid) {
        await showAlert("Acesso Negado", "Você não tem permissão para excluir serviços.");
        return;
    }
    
    const confirmou = await showAlert("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço?", true);
    if (!confirmou) return;

    try {
        const servicoDocRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoDocRef);
        await showAlert("Serviço excluído", "O serviço foi removido com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao excluir serviço:", err);
        await showAlert("Erro", `Ocorreu um erro ao excluir: ${err.message}`);
    }
}


// --- Ponto de Entrada e Listeners ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user; // Armazena o usuário logado
        inicializarPagina();
    } else {
        window.location.href = 'login.html';
    }
});

form.addEventListener('submit', handleFormSubmit);
if (btnExcluir) {
    btnExcluir.addEventListener('click', handleServicoExcluir);
}
