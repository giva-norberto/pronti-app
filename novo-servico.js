// ======================================================================
// ARQUIVO: novo-servico.js (Foco em "Arrumar a Casa")
// ======================================================================

import { 
    doc, getDoc, updateDoc, deleteDoc, 
    collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 1. IMPORTANTE: Garanta que está importando o config do PAINEL.
import { db, auth } from "./firebase-config.js"; 
import { showAlert } from "./vitrini-utils.js"; // Seu utilitário de alertas

// --- Mapeamento de Elementos do DOM ---
const form = document.getElementById('form-servico' );
const btnExcluir = document.getElementById('btn-excluir-servico');
const btnSalvar = form.querySelector('button[type="submit"]');

// --- Variáveis de Estado ---
let empresaId = null;
let servicoId = null;
let isDono = false;

/**
 * Obtém o ID da empresa ativa do localStorage.
 * Esta é a fonte da verdade para saber em qual empresa operar.
 */
function getEmpresaIdAtiva() {
    const id = localStorage.getItem("empresaAtivaId");
    if (!id) {
        console.error("Nenhum 'empresaAtivaId' encontrado no localStorage.");
        showAlert("Erro Crítico", "Nenhuma empresa está ativa. Por favor, retorne ao painel e selecione uma empresa.");
    }
    return id;
}

/**
 * Extrai o ID do serviço da URL para saber se estamos em modo de edição.
 */
function getIdServicoFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Preenche o formulário com os dados de um serviço existente.
 */
function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco || '';
    document.getElementById('duracao-servico').value = servico.duracao || '';
}

/**
 * Ponto de entrada principal que roda quando a página carrega.
 */
async function inicializarPagina(user) {
    empresaId = getEmpresaIdAtiva();
    if (!empresaId) {
        btnSalvar.disabled = true;
        return;
    }

    // A única permissão que importa aqui é: o usuário logado é o dono da empresa ativa?
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    
    if (!empresaSnap.exists() || empresaSnap.data().donoId !== user.uid) {
        isDono = false;
        showAlert("Acesso Negado", "Você não tem permissão para gerenciar serviços nesta empresa.");
        btnSalvar.disabled = true;
        if (btnExcluir) btnExcluir.style.display = 'none';
        return;
    }
    
    isDono = true;
    servicoId = getIdServicoFromUrl();
    const modoEdicao = !!servicoId;

    if (modoEdicao) {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            preencherFormulario(servicoSnap.data());
            if (btnExcluir) btnExcluir.style.display = 'block'; // Mostra o botão de excluir
        } else {
            showAlert("Erro", "O serviço que você está tentando editar não foi encontrado.");
            btnSalvar.disabled = true;
        }
    }
}

/**
 * Lida com o envio do formulário para criar ou atualizar um serviço.
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    if (!isDono || !empresaId) {
        showAlert("Erro", "Não foi possível salvar. Permissões ou ID da empresa ausentes.");
        return;
    }

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        showAlert("Atenção", "Preencha todos os campos obrigatórios corretamente.");
        return;
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        const dadosServico = { nome, descricao, preco, duracao, updatedAt: serverTimestamp() };

        if (servicoId) { // Modo Edição
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, dadosServico);
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

/**
 * Lida com a exclusão de um serviço.
 */
async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoId) return;
    
    // Usando a função de alerta customizada para confirmação
    const confirmou = await showAlert("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.", true);
    if (!confirmou) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        await showAlert("Serviço excluído", "O serviço foi removido com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao excluir serviço:", err);
        await showAlert("Erro", `Ocorreu um erro ao excluir: ${err.message}`);
    }
}

// --- Ponto de Entrada ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        inicializarPagina(user);
    } else {
        window.location.href = 'login.html';
    }
});

form.addEventListener('submit', handleFormSubmit);
if (btnExcluir) {
    btnExcluir.addEventListener('click', handleServicoExcluir);
}
