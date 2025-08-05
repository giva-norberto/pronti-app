// novo-servico.js - Fluxo corrigido para garantir que sempre cria/salva no Firebase
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { showAlert } from "./vitrini-utils.js";

const form = document.getElementById('form-servico');
let profissionalRef = null;
let servicoEditando = null;

/**
 * Busca empresa do usuário logado.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

/**
 * Pega o id do serviço da URL (se em edição).
 */
function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Preenche formulário com dados do serviço em edição.
 */
function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco || '';
    document.getElementById('duracao-servico').value = servico.duracao || '';
}

/**
 * Garante que o campo "servicos" existe no documento do profissional.
 */
async function garantirCampoServicos() {
    const docSnap = await getDoc(profissionalRef);
    if (!docSnap.exists()) {
        // Cria documento do profissional com array vazio + dados mínimos
        await setDoc(profissionalRef, { servicos: [] });
        return [];
    } else if (!docSnap.data().servicos) {
        await updateDoc(profissionalRef, { servicos: [] });
        return [];
    }
    return docSnap.data().servicos || [];
}

// Fluxo principal: só depois do usuário logado!
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const empresaId = await getEmpresaIdDoDono(user.uid);
    if (!empresaId) {
        await showAlert("Atenção", "Empresa não encontrada. Complete seu cadastro na página 'Meu Perfil'.");
        form.querySelector('button[type="submit"]').disabled = true;
        return;
    }

    profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);

    // Garante que existe campo "servicos"
    const servicos = await garantirCampoServicos();

    // Se está em modo edição, preenche o formulário
    const idServico = getIdFromUrl();
    if (idServico) {
        servicoEditando = servicos.find(s => String(s.id) === idServico);
        if (servicoEditando) preencherFormulario(servicoEditando);
    }

    form.addEventListener('submit', handleFormSubmit);
});

/**
 * Envia (cria ou edita) um serviço para o Firebase.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    if (!profissionalRef) {
        await showAlert("Erro", "Referência do profissional não encontrada. Recarregue a página.");
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
        // Sempre busca do banco (garante dados atualizados)
        const docSnap = await getDoc(profissionalRef);
        let servicosAtuais = (docSnap.exists() && docSnap.data().servicos) ? docSnap.data().servicos : [];

        let novaListaDeServicos;
        if (servicoEditando) {
            // EDIÇÃO
            novaListaDeServicos = servicosAtuais.map(s => 
                String(s.id) === String(servicoEditando.id)
                ? { ...s, nome, descricao, preco, duracao }
                : s
            );
        } else {
            // NOVO
            const novoServico = { 
                id: `serv_${Date.now()}`,
                nome, 
                descricao, 
                preco, 
                duracao,
                visivelNaVitrine: true
            };
            novaListaDeServicos = [...servicosAtuais, novoServico];
        }

        await updateDoc(profissionalRef, { servicos: novaListaDeServicos });

        await showAlert("Sucesso!", servicoEditando ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!");
        window.location.href = 'servicos.html';

    } catch (error) {
        console.error("Erro ao salvar o serviço: ", error);
        await showAlert("Erro ao Salvar", "Ocorreu um erro ao salvar o serviço. Por favor, tente novamente.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}
