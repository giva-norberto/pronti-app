/**
 * novo-servico.js (VERSÃO FINAL - GERENCIAMENTO DE EMPRESA)
 *
 * Lógica Principal:
 * 1. Ao carregar, identifica o usuário logado (o dono da empresa) e encontra o ID da sua empresa.
 * 2. Ao salvar, busca o documento do profissional correspondente (o próprio dono).
 * 3. Lê a lista de serviços que já existe para aquele profissional.
 * 4. Adiciona o novo serviço a essa lista.
 * 5. Salva a lista inteira de volta no documento do profissional, usando `updateDoc`.
 * 6. Usa os "Cards de Alerta" para feedback e redireciona para a página de serviços.
 */

import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
// [MODIFICADO] Usando nosso novo sistema de alertas
import { showAlert } from "./vitrini-utils.js"; 

const db = getFirestore(app);
const auth = getAuth(app);

const formServico = document.getElementById('form-servico');
let currentUser = null;
let empresaId = null;

/**
 * Busca o ID da empresa com base no ID do dono (usuário logado).
 * @param {string} uid - O UID do usuário.
 * @returns {string|null} O ID da empresa ou nulo.
 */
async function getEmpresaIdDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.error("Nenhuma empresa encontrada para este dono. É necessário cadastrar o perfil primeiro.");
        return null;
    }
    return snapshot.docs[0].id;
}

/**
 * Lida com o envio do formulário para salvar um novo serviço.
 * @param {Event} event - O evento de submit do formulário.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    const btnSalvar = formServico.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    if (!currentUser || !empresaId) {
        await showAlert("Erro", "Usuário não autenticado ou empresa não encontrada. Por favor, recarregue a página.");
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Serviço';
        return;
    }

    try {
        // 1. Coleta e valida os dados do formulário
        const nome = document.getElementById('nome-servico').value.trim();
        const descricao = document.getElementById('descricao-servico').value.trim();
        const preco = parseFloat(document.getElementById('preco-servico').value);
        const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

        if (!nome || isNaN(preco) || preco < 0 || isNaN(duracao) || duracao <= 0) {
            throw new Error("Por favor, preencha todos os campos obrigatórios corretamente.");
        }

        const novoServico = {
            id: `serv_${Date.now()}`, // Cria um ID local único para o serviço
            nome,
            descricao,
            preco,
            duracao,
            criadoEm: new Date()
        };

        // 2. Busca o documento do profissional (o próprio dono, neste caso)
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", currentUser.uid);
        const profissionalSnap = await getDoc(profissionalRef);

        if (!profissionalSnap.exists()) {
            throw new Error("Perfil profissional não encontrado. Cadastre seu perfil primeiro.");
        }

        // 3. Adiciona o novo serviço à lista de serviços existente
        const dadosProfissional = profissionalSnap.data();
        const servicosAtuais = dadosProfissional.servicos || []; // Pega a lista atual ou cria uma nova se não existir
        servicosAtuais.push(novoServico);

        // 4. Salva a lista de serviços atualizada de volta no documento do profissional
        await updateDoc(profissionalRef, {
            servicos: servicosAtuais
        });

        await showAlert("Sucesso!", "Novo serviço salvo com sucesso.");
        // Redireciona para a lista de serviços após o sucesso
        window.location.href = 'servicos.html'; 

    } catch (error) {
        console.error("Erro ao salvar serviço:", error);
        await showAlert("Erro ao Salvar", error.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Serviço';
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Descobre a empresa do usuário antes de habilitar o formulário
        empresaId = await getEmpresaIdDoDono(user.uid);
        if(empresaId) {
            formServico.addEventListener('submit', handleFormSubmit);
        } else {
            await showAlert("Atenção", "Não foi possível encontrar sua empresa. Por favor, complete seu cadastro na página 'Meu Perfil' antes de adicionar serviços.");
        }
    } else {
        // Se não estiver logado, redireciona para login
        window.location.href = 'login.html';
    }
});
