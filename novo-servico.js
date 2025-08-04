/**
 * novo-servico.js (VERSÃO FINAL - COM ALERTAS PADRONIZADOS)
 */

import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
// [MODIFICADO] Importando nosso sistema de alertas
import { showAlert } from "./vitrini-utils.js";

const db = getFirestore(app);
const auth = getAuth(app);
const form = document.getElementById('form-servico');

let profissionalRef = null;

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
            await showAlert("Atenção", "Empresa não encontrada. Por favor, complete seu cadastro na página 'Meu Perfil' primeiro.");
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
        await showAlert("Erro", "Referência do profissional não encontrada.");
        return;
    }

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao)) {
        await showAlert("Atenção", "Por favor, preencha todos os campos obrigatórios corretamente.");
        return;
    }
    
    const novoServico = { 
        id: `serv_${Date.now()}`,
        nome, 
        descricao, 
        preco, 
        duracao,
        visivelNaVitrine: true
    };

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        const docSnap = await getDoc(profissionalRef);
        const servicosAtuais = (docSnap.exists() && docSnap.data().servicos) ? docSnap.data().servicos : [];

        const novaListaDeServicos = [...servicosAtuais, novoServico];

        await updateDoc(profissionalRef, {
            servicos: novaListaDeServicos
        });

        // [MODIFICADO] Trocado Toastify por showAlert
        await showAlert("Sucesso!", "Serviço salvo com sucesso!");
        // O setTimeout não é mais necessário, pois o usuário precisa clicar "OK" no alerta
        window.location.href = 'servicos.html';

    } catch (error) {
        console.error("Erro ao salvar o serviço: ", error);
        // [MODIFICADO] Trocado Toastify por showAlert
        await showAlert("Erro ao Salvar", "Ocorreu um erro ao salvar o serviço. Por favor, tente novamente.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}
