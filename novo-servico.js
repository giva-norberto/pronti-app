// ======================================================================
//                    NOVO-SERVICO.JS
//      Gerencia o cadastro e edição de serviços para a empresa
// ======================================================================

import { 
    doc, getDoc, updateDoc, deleteDoc, 
    collection, query, where, getDocs, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// CORRIGIDO: Padronizado para usar a mesma configuração de todo o app
import { db, auth } from "./firebase-config.js"; 
// REFINADO: Usa as funções de "mensagens bonitas"
import { mostrarAlerta, mostrarConfirmacao } from "./vitrini-utils.js"; 

// --- MAPEAMENTO DOS ELEMENTOS DO DOM ---
const form = document.getElementById('form-servico');
const nomeInput = document.getElementById('nome-servico');
const descricaoInput = document.getElementById('descricao-servico');
const precoInput = document.getElementById('preco-servico');
const duracaoInput = document.getElementById('duracao-servico');
const tituloPagina = document.querySelector('.form-card h1');
// Adicionado um botão de excluir no HTML para esta lógica funcionar
const btnExcluir = document.createElement('button');
btnExcluir.id = 'btn-excluir-servico';
btnExcluir.textContent = 'Excluir Serviço';
btnExcluir.className = 'btn-submit'; // Reutiliza um estilo existente
btnExcluir.style.background = '#ef4444'; // Cor de perigo
btnExcluir.style.marginTop = '10px';
btnExcluir.style.display = 'none'; // Começa escondido

// --- VARIÁVEIS DE ESTADO ---
let empresaId = null;
let servicoId = null;
let isDono = false;

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // A lógica agora é mais direta e robusta
    try {
        empresaId = localStorage.getItem("empresaAtivaId");
        if (!empresaId) {
            throw new Error("Nenhuma empresa ativa selecionada.");
        }

        const empresaRef = doc(db, "empresarios", empresaId);
        const empresaSnap = await getDoc(empresaRef);
        if (!empresaSnap.exists() || empresaSnap.data().donoId !== user.uid) {
            isDono = false; // Não é o dono da empresa ativa
        } else {
            isDono = true;
        }

        servicoId = new URLSearchParams(window.location.search).get('id');

        if (servicoId) {
            // Modo de Edição
            tituloPagina.textContent = 'Editar Serviço';
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            const servicoSnap = await getDoc(servicoRef);
            if (servicoSnap.exists()) {
                preencherFormulario(servicoSnap.data());
                // Adiciona e mostra o botão de excluir se for o dono
                if (isDono) {
                    form.appendChild(btnExcluir);
                    btnExcluir.style.display = 'block';
                }
            } else {
                throw new Error("Serviço não encontrado.");
            }
        } else {
            // Modo de Criação
            tituloPagina.textContent = 'Novo Serviço';
            if (!isDono) {
                 await mostrarAlerta("Acesso Negado", "Apenas o dono da empresa pode criar novos serviços.");
                 form.querySelector('button[type="submit"]').disabled = true;
            }
        }
    } catch (error) {
        await mostrarAlerta("Erro", error.message);
        form.querySelector('button[type="submit"]').disabled = true;
    }
});

// Adiciona os listeners de evento
if (form) form.addEventListener('submit', handleFormSubmit);
btnExcluir.addEventListener('click', handleServicoExcluir);


// --- FUNÇÕES DE LÓGICA ---

function preencherFormulario(servico) {
    nomeInput.value = servico.nome || '';
    descricaoInput.value = servico.descricao || '';
    precoInput.value = servico.preco !== undefined ? servico.preco : '';
    duracaoInput.value = servico.duracao !== undefined ? servico.duracao : '';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!isDono) {
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
            // Atualiza o serviço existente
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, servicoData);
            await mostrarAlerta("Sucesso!", "Serviço atualizado com sucesso!");
        } else {
            // Cria um novo serviço
            servicoData.visivelNaVitrine = true; // Valor padrão
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, servicoData);
            await mostrarAlerta("Sucesso!", "Novo serviço salvo com sucesso!");
        }
        window.location.href = 'servicos.html'; // Redireciona para a lista
    } catch (err) {
        await mostrarAlerta("Erro", `Ocorreu um erro ao salvar: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoId) return;

    // REFINADO: Usa o modal de confirmação "bonito"
    const confirmado = await mostrarConfirmacao("Excluir Serviço", "Tem a certeza que deseja excluir este serviço? Esta ação é permanente.");
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
