/**
 * novo-servico.js (VERSÃO CORRIGIDA E ALINHADA COM A ESTRUTURA 'empresarios')
 */

import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);
const form = document.getElementById('form-servico');

let profissionalRef = null; // Guardará a referência para o documento do profissional

/**
 * Função auxiliar para encontrar o ID da empresa com base no ID do dono.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

// O "porteiro": só executa a lógica depois de confirmar que o usuário está logado.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            // Define a referência ao documento do profissional (o dono)
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
            form.addEventListener('submit', handleFormSubmit);
        } else {
            alert("Empresa não encontrada. Por favor, complete o seu perfil.");
            form.querySelector('button[type="submit"]').disabled = true;
        }
    } else {
        window.location.href = 'login.html';
    }
});

/**
 * Lida com o envio do formulário para adicionar um novo serviço ao array do profissional.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    if (!profissionalRef) {
        alert("Erro: Referência do profissional não encontrada.");
        return;
    }

    const nome = document.getElementById('nome-servico').value;
    const descricao = document.getElementById('descricao-servico').value;
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value);
    
    // Cria um novo objeto de serviço com um ID único baseado na data atual
    const novoServico = { 
        id: `serv_${Date.now()}`, // Cria um ID único
        nome, 
        descricao, 
        preco, 
        duracao,
        visivelNaVitrine: true // Padrão: visível
    };

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        // 1. Pega o documento do profissional para ler a lista de serviços atual.
        const docSnap = await getDoc(profissionalRef);
        const servicosAtuais = (docSnap.exists() && docSnap.data().servicos) ? docSnap.data().servicos : [];

        // 2. Adiciona o novo serviço à lista.
        const novaListaDeServicos = [...servicosAtuais, novoServico];

        // 3. Atualiza o documento do profissional com a lista completa.
        await updateDoc(profissionalRef, {
            servicos: novaListaDeServicos
        });

        Toastify({
            text: "Serviço salvo com sucesso!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        setTimeout(() => { window.location.href = 'servicos.html'; }, 2000);

    } catch (error) {
        console.error("Erro ao salvar o serviço: ", error);
        Toastify({ 
            text: "Erro ao salvar o serviço.", 
            duration: 3000, 
            gravity: "top", 
            position: "right", 
            style: { background: "#dc3545" } 
        }).showToast();
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}
