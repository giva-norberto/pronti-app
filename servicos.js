// servicos.js (VERSÃO FINAL ALINHADA COM O FIREBASE)

// 1. IMPORTS: Importamos tudo o que precisamos do Firebase e dos nossos arquivos de utilidades.
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js"; // Certifique-se que este caminho está correto
import { showCustomConfirm } from "./vitrini-utils.js"; // Importamos nosso modal bonito
// Removi 'showAlert' pois não estava sendo usado, mas pode adicionar de volta se precisar

// =================================================================================
// INICIALIZAÇÃO E ESTADO
// =================================================================================
const db = getFirestore(app);
const auth = getAuth(app);
const listaServicosDiv = document.getElementById('lista-servicos');

let profissionalRef = null; // Guardará a referência para o documento do profissional no Firestore

// =================================================================================
// FUNÇÕES DE LÓGICA
// =================================================================================

/**
 * Encontra o ID da empresa associada a um ID de dono (usuário).
 */
async function getEmpresaIdDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.error("Nenhuma empresa encontrada para o dono com UID:", uid);
        return null;
    }
    return snapshot.docs[0].id;
}

/**
 * Formata um número para o padrão de moeda BRL.
 */
function formatarPreco(preco) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

/**
 * Renderiza a lista de serviços na tela a partir de um array de dados.
 * @param {Array} servicos - A lista de serviços a ser exibida.
 */
function renderizarServicos(servicos) {
    if (!servicos || servicos.length === 0) {
        listaServicosDiv.innerHTML = `<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>`;
        return;
    }

    // Ordena os serviços em ordem alfabética pelo nome.
    servicos.sort((a, b) => a.nome.localeCompare(b.nome));

    listaServicosDiv.innerHTML = servicos.map(servico => `
        <div class="servico-card">
            <div class="servico-header">
                <h3 class="servico-titulo">${servico.nome}</h3>
                <span class="servico-categoria">${servico.categoria}</span>
            </div>
            <p class="servico-descricao">${servico.descricao}</p>
            <div class="servico-footer">
                <div>
                    <span class="servico-preco">${formatarPreco(servico.preco)}</span>
                    <span class="servico-duracao"> • ${servico.duracao} min</span>
                </div>
                <div class="servico-acoes">
                    <button class="btn-acao btn-editar" data-id="${servico.id}">Editar</button>
                    <button class="btn-acao btn-excluir" data-id="${servico.id}">Excluir</button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Carrega os dados do profissional do Firestore e chama a função para renderizar os serviços.
 */
async function carregarServicosDoFirebase() {
    if (!profissionalRef) {
        listaServicosDiv.innerHTML = '<p style="color:red;">Perfil profissional não encontrado. Verifique seu cadastro.</p>';
        return;
    }
    listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

    try {
        const docSnap = await getDoc(profissionalRef);
        if (docSnap.exists()) {
            const servicos = docSnap.data().servicos || [];
            renderizarServicos(servicos);
        } else {
            listaServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado.</p>';
        }
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    }
}

/**
 * Exclui um serviço do array de serviços no documento do profissional no Firestore.
 * @param {string} servicoIdParaExcluir - O ID do serviço a ser removido.
 */
async function excluirServico(servicoIdParaExcluir) {
    // 1. Usa o modal bonito para confirmar
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        // 2. Pega os dados mais recentes do documento
        const docSnap = await getDoc(profissionalRef);
        if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");

        const servicosAtuais = docSnap.data().servicos || [];

        // 3. Cria a nova lista sem o serviço excluído
        const novaListaDeServicos = servicosAtuais.filter(s => String(s.id) !== servicoIdParaExcluir);

        // 4. Salva (atualiza) a lista de volta no Firestore
        await updateDoc(profissionalRef, { servicos: novaListaDeServicos });

        alert("Serviço excluído com sucesso!");
        carregarServicosDoFirebase(); // Recarrega a lista da tela
    } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        alert("Ocorreu um erro ao excluir o serviço.");
    }
}

// =================================================================================
// PONTO DE PARTIDA E EVENT LISTENERS
// =================================================================================

// Monitora se o utilizador está logado. Todo o fluxo começa aqui.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            // Se encontrarmos a empresa, definimos a referência para o documento do profissional
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
            carregarServicosDoFirebase(); // E carregamos os serviços
        } else {
            listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada. Por favor, complete seu cadastro.</p>';
        }
    } else {
        // Se não há utilizador logado, redireciona para a página de login
        window.location.href = 'login.html';
    }
});

// Adiciona um único "escutador" para a lista inteira, que gerencia os cliques nos botões.
listaServicosDiv.addEventListener('click', function(e) {
    const target = e.target.closest('.btn-acao');
    if (!target) return;

    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('btn-editar')) {
        // Redireciona para a página de edição, passando o ID do serviço na URL
        window.location.href = `novo-servico.html?id=${id}`;
    }

    if (target.classList.contains('btn-excluir')) {
        // Chama a função de exclusão
        excluirServico(id);
    }
});
