import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { showAlert } from "./vitrini-utils.js";

const form = document.getElementById('form-servico');
let profissionalRef = null;
let servicoEditando = null; // Armazena o serviço em edição

/**
 * Função auxiliar para encontrar o ID da empresa com base no ID do dono.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

/**
 * Função para pegar o id do serviço da URL
 */
function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Preenche o formulário com os dados do serviço
 */
function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco || '';
    document.getElementById('duracao-servico').value = servico.duracao || '';
}

// Executa a lógica depois de confirmar que o usuário está logado.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);

            // Cria o documento do profissional se não existir
            const docSnap = await getDoc(profissionalRef);
            if (!docSnap.exists()) {
                await setDoc(profissionalRef, { servicos: [] });
            }

            // Se está em modo edição, preenche o formulário
            const idServico = getIdFromUrl();
            if (idServico) {
                const servicos = docSnap.data().servicos || [];
                servicoEditando = servicos.find(s => String(s.id) === idServico);
                if (servicoEditando) {
                    preencherFormulario(servicoEditando);
                }
            }

            form.addEventListener('submit', handleFormSubmit);
        } else {
            await showAlert("Atenção", "Empresa não encontrada. Por favor, complete seu cadastro na página 'Meu Perfil' primeiro.");
            form.querySelector('button[type=\"submit\"]').disabled = true;
        }
    } else {
        window.location.href = 'login.html';
    }
});

/**
 * Lida com o envio do formulário para adicionar ou editar um serviço do profissional.
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
        await showAlert("Atenção", "Por favor, preencha todos os campos obrigatórios corretamente.");
        return;
    }
    
    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        const docSnap = await getDoc(profissionalRef);
        const servicosAtuais = (docSnap.exists() && docSnap.data().servicos) ? docSnap.data().servicos : [];

        let novaListaDeServicos;
        if (servicoEditando) {
            // EDIÇÃO: atualiza o serviço existente
            novaListaDeServicos = servicosAtuais.map(s => {
                if (String(s.id) === String(servicoEditando.id)) {
                    return {
                        ...s,
                        nome,
                        descricao,
                        preco,
                        duracao
                    };
                }
                return s;
            });
        } else {
            // NOVO: adiciona serviço novo
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

        await updateDoc(profissionalRef, {
            servicos: novaListaDeServicos
        });

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
