// ======================================================================
//                    NOVO-SERVICO.JS (VERSÃO COM VALIDAÇÃO DIRETA)
// ======================================================================

import { 
    doc, getDoc, updateDoc, deleteDoc, 
    collection, addDoc, query, where, getDocs
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

// --- NOVA FUNÇÃO DE "VARREDURA" ---
/**
 * Busca no banco de dados a empresa da qual o usuário é dono.
 * @param {string} uid - O ID do usuário logado.
 * @returns {Promise<string|null>} O ID da empresa ou null se não encontrar.
 */
async function getEmpresaDoDono(uid) {
    const empresariosRef = collection(db, "empresarios");
    const q = query(empresariosRef, where("donoId", "==", uid));
    try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            // Retorna o ID da primeira empresa encontrada para este dono
            return snapshot.docs[0].id;
        }
        return null; // Retorna nulo se o usuário não for dono de nenhuma empresa
    } catch (error) {
        console.error("Erro ao fazer a 'varredura' por empresa:", error);
        return null;
    }
}


// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const isAdmin = user.uid === ADMIN_UID;
    
    try {
        // CORREÇÃO: A lógica agora faz a "varredura" em vez de ler da memória local
        empresaId = await getEmpresaDoDono(user.uid);

        if (!empresaId && !isAdmin) {
             // Se não encontrou empresa e não é admin, não pode fazer nada.
             await mostrarAlerta("Acesso Negado", "Você precisa primeiro cadastrar sua empresa na tela de perfil.");
             form.querySelector('button[type="submit"]').disabled = true;
             return;
        }
        
        // Se for admin e não houver empresa selecionada, usa a do localStorage (para gerenciar outras)
        if (isAdmin && !empresaId) {
             empresaId = localStorage.getItem("empresaAtivaId");
        }
        
        if (!empresaId) {
            throw new Error("Nenhuma empresa ativa selecionada. Por favor, verifique seu perfil.");
        }
        
        // A permissão é verdadeira se o sistema encontrou uma empresa para este dono, ou se é o Admin.
        temPermissaoParaEditar = !!empresaId || isAdmin;

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
                 await mostrarAlerta("Acesso Negado", "Apenas o dono da empresa ou um administrador pode criar novos serviços.");
                 form.querySelector('button[type="submit"]').disabled = true;
            }
        }
    } catch (error) {
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
