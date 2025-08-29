// ======================================================================
//                    NOVO-SERVICO.JS (VERSÃO DE DIAGNÓSTICO)
// ======================================================================

import { 
    doc, getDoc, updateDoc, deleteDoc, 
    collection, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 
import { mostrarAlerta, mostrarConfirmacao } from "./vitrini-ui.js"; 

// --- MAPEAMENTO DOS ELEMENTOS DO DOM ---
const form = document.getElementById('form-servico');
const nomeInput = document.getElementById('nome-servico');
const descricaoInput = document.getElementById('descricao-servico');
const precoInput = document.getElementById('preco-servico');
const duracaoInput = document.getElementById('duracao-servico');
const tituloPagina = document.querySelector('.form-card h1');
const btnExcluir = document.createElement('button');
btnExcluir.id = 'btn-excluir-servico';
btnExcluir.textContent = 'Excluir Serviço';
btnExcluir.type = 'button';
btnExcluir.className = 'btn-submit'; 
btnExcluir.style.background = '#ef4444'; 
btnExcluir.style.marginTop = '10px';
btnExcluir.style.display = 'none';

// --- VARIÁVEIS DE ESTADO ---
let empresaId = null;
let servicoId = null;
let temPermissaoParaEditar = false;

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; 

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    console.clear(); // Limpa o console para facilitar a leitura
    console.log("==== INICIANDO DIAGNÓSTICO DE PERMISSÃO ====");

    if (!user) {
        console.log("DIAGNÓSTICO: Nenhum utilizador logado. Redirecionando...");
        window.location.href = 'login.html';
        return;
    }

    console.log(`DIAGNÓSTICO: Utilizador logado. UID: ${user.uid}`);
    console.log(`DIAGNÓSTICO: ADMIN_UID definido no código: ${ADMIN_UID}`);
    const isAdmin = user.uid === ADMIN_UID;
    console.log(`DIAGNÓSTICO: Este utilizador é o Admin? ${isAdmin}`);

    try {
        empresaId = localStorage.getItem("empresaAtivaId");
        console.log(`DIAGNÓSTICO: ID da empresa ativa (localStorage): ${empresaId}`);

        if (!empresaId) {
            throw new Error("Nenhuma empresa ativa selecionada. Por favor, volte ao seu perfil.");
        }

        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);
        
        let isDono = false;
        if (empresaSnap.exists()) {
            const donoId = empresaSnap.data().donoId;
            console.log(`DIAGNÓSTICO: 'donoId' da empresa no banco de dados: ${donoId}`);
            isDono = (user.uid === donoId);
            console.log(`DIAGNÓSTICO: Este utilizador é o Dono desta empresa? ${isDono}`);
        } else {
            console.error(`DIAGNÓSTICO: A empresa com ID "${empresaId}" não foi encontrada no banco de dados.`);
        }

        temPermissaoParaEditar = isDono || isAdmin;
        console.log(`DIAGNÓSTICO: RESULTADO FINAL - Tem permissão para editar? ${temPermissaoParaEditar}`);

        servicoId = new URLSearchParams(window.location.search).get('id');

        if (servicoId) {
            tituloPagina.textContent = 'Editar Serviço';
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            const servicoSnap = await getDoc(servicoRef);
            if (servicoSnap.exists()) {
                preencherFormulario(servicoSnap.data());
                if (temPermissaoParaEditar) {
                    form.appendChild(btnExcluir);
                    btnExcluir.style.display = 'block';
                }
            } else {
                throw new Error("Serviço não encontrado.");
            }
        } else {
            tituloPagina.textContent = 'Novo Serviço';
            if (!temPermissaoParaEditar) {
                 console.log("DIAGNÓSTICO: Acesso negado. Mostrando alerta.");
                 await mostrarAlerta("Acesso Negado", "Apenas o dono da empresa ou um administrador pode criar novos serviços.");
                 form.querySelector('button[type="submit"]').disabled = true;
            } else {
                 console.log("DIAGNÓSTICO: Acesso permitido. Formulário de criação habilitado.");
            }
        }
        console.log("==== DIAGNÓSTICO CONCLUÍDO ====");
    } catch (error) {
        console.error("==== ERRO NO DIAGNÓSTICO ====", error);
        await mostrarAlerta("Erro", error.message);
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }
    }
});

// Adiciona os listeners de evento (sem alterações)
if (form) form.addEventListener('submit', handleFormSubmit);
btnExcluir.addEventListener('click', handleServicoExcluir);

// --- FUNÇÕES DE LÓGICA (sem alterações) ---

function preencherFormulario(servico) {
    nomeInput.value = servico.nome || '';
    descricaoInput.value = servico.descricao || '';
    precoInput.value = servico.preco !== undefined ? servico.preco : '';
    duracaoInput.value = servico.duracao !== undefined ? servico.duracao : '';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!temPermissaoParaEditar) {
        await mostrarAlerta("Acesso Negado", "Você não tem permissão para salvar serviços.");
        return;
    }

    const servicoData = {
        nome: nomeInput.value.trim(),
        descricao: descricaoInput.value.trim(),
        preco: parseFloat(precoInput.value),
        duracao: parseInt(duracaoInput.value, 10)
    };

    if (!servicoData.nome || isNaN(servicoData.preco) || isNaN(servicoData.duracao) || servicoData.preco < 0 || servicoData.duracao <= 0) {
        await mostrarAlerta("Dados Inválidos", "Por favor, preencha todos os campos corretamente.");
        return;
    }

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        if (servicoId) {
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, servicoData);
            await mostrarAlerta("Sucesso!", "Serviço atualizado com sucesso!");
        } else {
            servicoData.visivelNaVitrine = true;
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, servicoData);
            await mostrarAlerta("Sucesso!", "Novo serviço salvo com sucesso!");
        }
        window.location.href = 'servicos.html';
    } catch (err) {
        await mostrarAlerta("Erro", `Ocorreu um erro ao salvar: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!temPermissaoParaEditar || !servicoId) return;

    const confirmado = await mostrarConfirmacao("Excluir Serviço", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        await mostrarAlerta("Serviço Excluído", "O serviço foi removido com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        await mostrarAlerta("Erro", `Ocorreu um erro ao excluir o serviço: ${err.message}`);
    }
}

