// ======================================================================
// ARQUIVO: novo-servico.js (LÓGICA ORIGINAL RESTAURADA E FUNCIONAL)
// ======================================================================

import { 
    doc, getDoc, setDoc, updateDoc, deleteDoc, 
    collection, query, where, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Garante que está importando do arquivo de configuração MESTRE.
import { db, auth } from "./firebase-config.js"; 
import { showAlert } from "./vitrini-utils.js";

// --- Elementos do DOM e Variáveis de Estado ---
const form = document.getElementById('form-servico' );
const btnExcluir = document.getElementById('btn-excluir-servico');
let empresaId = null;
let servicoId = null;
let servicoEditando = null;
let isDono = false;

// --- Funções Auxiliares (do seu código original que funcionava) ---

function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId");
}

// Esta função é uma peça chave da sua lógica original.
async function getEmpresaDoUsuario(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        // Retorna a primeira empresa que encontrar onde o usuário é dono.
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
}

function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco || '';
    document.getElementById('duracao-servico').value = servico.duracao || '';
}

function usuarioEDono(empresa, uid) {
    return empresa && empresa.donoId === uid;
}

// --- Lógica Principal (A estrutura que funcionava) ---

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    empresaId = getEmpresaIdAtiva();
    if (!empresaId) {
        await showAlert("Atenção", "Nenhuma empresa ativa selecionada. Retorne ao painel.");
        form.querySelector('button[type="submit"]').disabled = true;
        return;
    }

    // A verificação de permissão crucial, como no seu código original.
    const empresa = await getEmpresaDoUsuario(user.uid);
    isDono = usuarioEDono(empresa, user.uid);

    servicoId = getIdFromUrl();
    if (servicoId) {
        // Se está editando, busca os dados do serviço.
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            servicoEditando = { id: servicoSnap.id, ...servicoSnap.data() };
            preencherFormulario(servicoEditando);
        }
    }

    // Lógica de UI para permissões
    if (!isDono) {
        await showAlert("Acesso Negado", "Apenas o dono da empresa pode criar ou editar serviços.");
        form.querySelector('button[type="submit"]').disabled = true;
    }

    if (btnExcluir) {
        if (servicoEditando && isDono) {
            btnExcluir.style.display = 'block';
            btnExcluir.addEventListener('click', handleServicoExcluir);
        } else {
            btnExcluir.style.display = 'none';
        }
    }

    // PONTO CRÍTICO: O formulário só é "ligado" DEPOIS que todas as verificações foram feitas.
    form.addEventListener('submit', handleFormSubmit);
});

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!isDono) {
        await showAlert("Acesso Negado", "Apenas o dono pode salvar um serviço.");
        return;
    }

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        await showAlert("Atenção", "Preencha todos os campos obrigatórios corretamente.");
        return;
    }

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        const dadosServico = { nome, descricao, preco, duracao, updatedAt: serverTimestamp() };

        if (servicoEditando) {
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, dadosServico);
        } else {
            dadosServico.createdAt = serverTimestamp();
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, dadosServico);
        }

        await showAlert("Sucesso!", servicoEditando ? "Serviço atualizado!" : "Serviço criado!");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao salvar serviço:", err);
        await showAlert("Erro", `Ocorreu um erro ao salvar: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoEditando) return;
    
    const confirmou = await showAlert("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço?", true);
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
