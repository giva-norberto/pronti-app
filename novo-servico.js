// ======================================================================
// ARQUIVO: servicos.js (NOME SUGERIDO)
// ======================================================================

import { 
    doc, getDoc, setDoc, updateDoc, deleteDoc, 
    collection, query, where, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 1. Importa 'db' e 'auth' do seu arquivo de configuração central e único.
import { db, auth } from "./firebase-config.js"; 
// Supondo que seu utilitário de alerta também seja um módulo.
import { showAlert } from "./vitrini-utils.js"; 

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
 * Atualiza a visibilidade dos botões e a interatividade do formulário.
 */
function atualizarUI(podeInteragir, modoEdicao) {
    btnSalvar.disabled = !podeInteragir;
    
    if (btnExcluir) {
        // Mostra o botão de excluir apenas se estiver editando e tiver permissão.
        btnExcluir.style.display = (modoEdicao && podeInteragir) ? 'block' : 'none';
    }
}

/**
 * Ponto de entrada principal que roda quando a página carrega.
 */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    empresaId = getEmpresaIdAtiva();
    if (!empresaId) {
        await showAlert("Atenção", "Nenhuma empresa ativa selecionada. Por favor, selecione uma empresa no seu painel.");
        atualizarUI(false, false);
        return;
    }

    // Verifica se o usuário logado é o dono da empresa ativa.
    const empresaRef = doc(db, "empresarios", empresaId);
    const empresaSnap = await getDoc(empresaRef);
    
    if (!empresaSnap.exists() || empresaSnap.data().donoId !== user.uid) {
        isDono = false;
        await showAlert("Acesso Negado", "Você não tem permissão para gerenciar serviços nesta empresa.");
        atualizarUI(false, false);
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
        } else {
            await showAlert("Erro", "O serviço que você está tentando editar não foi encontrado.");
            atualizarUI(false, false);
            return;
        }
    }
    
    // Permite interação e ajusta a UI com base no contexto.
    atualizarUI(true, modoEdicao);
});

/**
 * Lida com o envio do formulário para criar ou atualizar um serviço.
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    if (!isDono) return; // Dupla verificação de segurança

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

    try {
        const dadosServico = { nome, descricao, preco, duracao, updatedAt: serverTimestamp() };

        if (servicoId) { // Modo Edição
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, dadosServico);
            await showAlert("Sucesso!", "Serviço atualizado com sucesso!");
        } else { // Modo Criação
            dadosServico.createdAt = serverTimestamp();
            dadosServico.visivelNaVitrine = true; // Valor padrão
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, dadosServico);
            await showAlert("Sucesso!", "Serviço salvo com sucesso!");
        }
        window.location.href = 'servicos.html'; // Redireciona para a lista de serviços
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
    
    const confirmou = confirm("Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
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

// Adiciona os listeners aos elementos corretos
form.addEventListener('submit', handleFormSubmit);
if (btnExcluir) {
    btnExcluir.addEventListener('click', handleServicoExcluir);
}
