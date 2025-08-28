// ======================================================================
// ARQUIVO: novo-servico.js (VERSÃO CORRETA, BASEADA NO SEU CÓDIGO ANTIGO)
// ======================================================================

import { 
    doc, getDoc, setDoc, updateDoc, deleteDoc, 
    collection, query, where, getDocs, addDoc, serverTimestamp // Adicionado serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"; // Versão atualizada

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"; // Versão atualizada

import { db, auth } from "./firebase-config.js";
import { showAlert } from "./vitrini-utils.js";

// --- Elementos do DOM e Variáveis de Estado ---
const form = document.getElementById('form-servico' );
const btnExcluir = document.getElementById('btn-excluir-servico');
let empresaId = null;
let servicoId = null;
let servicoEditando = null;
let isDono = false;

// --- Funções Auxiliares (do seu código original) ---

function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

async function getEmpresaDoUsuario(uid) {
    // Esta função pode ser simplificada no futuro, mas vamos mantê-la por enquanto
    let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    let snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return null; // Simplificado, pois a lógica de permissão principal é outra
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
    return empresa.donoId === uid;
}

// --- Lógica Principal (Estrutura do seu código original, que é a correta) ---

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    empresaId = getEmpresaIdAtiva();
    const empresa = await getEmpresaDoUsuario(user.uid); // Usado para checar se é dono

    if (!empresaId) {
        await showAlert("Atenção", "Nenhuma empresa ativa selecionada. Complete seu cadastro ou selecione uma empresa.");
        form.querySelector('button[type="submit"]').disabled = true;
        if (btnExcluir) btnExcluir.style.display = 'none';
        return;
    }

    // A verificação de permissão crucial
    isDono = empresa && usuarioEDono(empresa, user.uid);

    servicoId = getIdFromUrl();
    if (servicoId) {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            servicoEditando = { id: servicoSnap.id, ...servicoSnap.data() };
            preencherFormulario(servicoEditando);
        }
    }

    // Lógica de UI para permissões
    if (!isDono && !servicoId) {
        await showAlert("Atenção", "Apenas o dono pode criar um novo serviço.");
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

    // CORREÇÃO: O listener do formulário é adicionado AQUI, no final,
    // garantindo que todas as variáveis de estado (isDono, empresaId) já estão definidas.
    form.addEventListener('submit', handleFormSubmit);
});

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!empresaId) {
        await showAlert("Erro", "Empresa não identificada. Tente recarregar a página.");
        return;
    }

    if (!isDono) { // Simplificado: se não é dono, não pode salvar/editar.
        await showAlert("Atenção", "Apenas o dono pode salvar ou editar um serviço.");
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
            dadosServico.visivelNaVitrine = true;
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, dadosServico);
        }

        await showAlert("Sucesso!", servicoEditando ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao salvar serviço:", err);
        await showAlert("Erro", `Ocorreu um erro ao salvar o serviço: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoEditando) return;
    
    const confirmou = confirm("Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmou) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        await showAlert("Serviço excluído", "O serviço foi removido com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao excluir serviço:", err);
        await showAlert("Erro", `Ocorreu um erro ao excluir o serviço: ${err.message}`);
    }
}
