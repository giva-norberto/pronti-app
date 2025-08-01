/**
 * servicos.js (VERSÃO FINAL - GERENCIAMENTO DE EMPRESA)
 *
 * Lógica Principal:
 * 1. Encontra a empresa e o perfil profissional do usuário logado (dono).
 * 2. Lê o campo 'servicos' (que é uma lista/array) de dentro do documento do profissional.
 * 3. Renderiza essa lista na tela.
 * 4. As ações de Excluir e Atualizar Visibilidade modificam a lista em memória
 * e depois salvam a lista inteira de volta no Firebase com 'updateDoc'.
 */

import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
import { showAlert, showCustomConfirm } from "./vitrini-utils.js"; // Usando nossos Cards

const db = getFirestore(app);
const auth = getAuth(app);
const listaServicosDiv = document.getElementById('lista-servicos');

let currentUser = null;
let empresaId = null;
let profissionalRef = null; // [NOVO] Referência direta ao documento do profissional

/**
 * Busca o ID da empresa com base no ID do dono.
 * @param {string} uid - O UID do usuário logado.
 * @returns {string|null} O ID da empresa ou nulo.
 */
async function getEmpresaIdDoDono(uid) {
    if (!uid) return null;
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

/**
 * [MODIFICADO] Carrega e renderiza a LISTA de serviços do documento do profissional.
 */
async function carregarErenderizarServicos() {
    if (!profissionalRef) {
        listaServicosDiv.innerHTML = '<p style="color:red;">Não foi possível encontrar o perfil profissional.</p>';
        return;
    }
    listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

    try {
        const docSnap = await getDoc(profissionalRef);

        if (!docSnap.exists() || !docSnap.data().servicos || docSnap.data().servicos.length === 0) {
            listaServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>';
            return;
        }

        const servicos = docSnap.data().servicos;
        listaServicosDiv.innerHTML = ''; // Limpa a lista antes de renderizar
        
        // Ordena os serviços por nome para uma melhor visualização
        servicos.sort((a, b) => a.nome.localeCompare(b.nome));

        servicos.forEach(servico => {
            const isVisible = servico.visivelNaVitrine !== false; // Padrão é visível
            const el = document.createElement('div');
            el.className = 'servico-item';
            // Seus estilos inline foram mantidos para consistência
            el.style.cssText = 'padding: 8px 12px; margin-bottom: 10px; font-size: 0.9rem; border: 1px solid #ddd; border-radius: 6px; background-color: #fafafa; display: flex; justify-content: space-between; align-items: center;';

            el.innerHTML = `
                <div class="item-info">
                    <h3>${servico.nome}</h3>
                    <p><strong>Preço:</strong> R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</p>
                    <p><strong>Duração:</strong> ${servico.duracao} minutos</p>
                </div>
                <div class="item-acoes">
                    <div class="acao-visibilidade">
                        <label class="switch-label">Ativo na Vitrine</label>
                        <label class="switch">
                            <input type="checkbox" class="toggle-visibilidade" data-id="${servico.id}" ${isVisible ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <button class="btn-editar" data-id="${servico.id}">Editar</button>
                    <button class="btn-excluir" data-id="${servico.id}">Excluir</button>
                </div>
            `;
            listaServicosDiv.appendChild(el);
        });

    } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    }
}

/**
 * [MODIFICADO] Exclui um serviço da LISTA e atualiza o documento.
 * @param {string} servicoId - O ID local do serviço a ser excluído.
 */
async function excluirServico(servicoId) {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Você tem certeza? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        const docSnap = await getDoc(profissionalRef);
        if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");

        const servicosAtuais = docSnap.data().servicos || [];
        // Filtra a lista, mantendo todos os serviços EXCETO o que vai ser excluído
        const novaListaDeServicos = servicosAtuais.filter(s => s.id !== servicoId);

        await updateDoc(profissionalRef, { servicos: novaListaDeServicos });
        
        await showAlert("Sucesso", "Serviço excluído com sucesso.");
        carregarErenderizarServicos(); // Recarrega a lista da tela
    } catch (error) {
        console.error("Erro ao excluir serviço: ", error);
        await showAlert("Erro", "Erro ao excluir serviço.");
    }
}

/**
 * [MODIFICADO] Atualiza a visibilidade de um serviço na LISTA e atualiza o documento.
 * @param {string} servicoId - O ID local do serviço a ser atualizado.
 * @param {boolean} visivel - O novo estado de visibilidade.
 */
async function atualizarVisibilidade(servicoId, visivel) {
    try {
        const docSnap = await getDoc(profissionalRef);
        if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");

        const servicosAtuais = docSnap.data().servicos || [];
        // Mapeia a lista, encontra o serviço pelo ID e atualiza seu campo de visibilidade
        const novaListaDeServicos = servicosAtuais.map(s => {
            if (s.id === servicoId) {
                return { ...s, visivelNaVitrine: visivel };
            }
            return s;
        });

        await updateDoc(profissionalRef, { servicos: novaListaDeServicos });
        // Não precisa de alerta para uma ação pequena como esta, a mudança visual já é o feedback.
    } catch (error) {
        console.error("Erro ao atualizar visibilidade:", error);
        await showAlert("Erro", "Erro ao alterar visibilidade.");
        carregarErenderizarServicos(); // Recarrega para reverter a mudança visual do toggle em caso de erro
    }
}

// --- INICIALIZAÇÃO E EVENTOS ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        empresaId = await getEmpresaIdDoDono(user.uid);
        
        if (empresaId) {
            // Define a referência ao documento do profissional (o dono) uma vez
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", currentUser.uid);
            // Carrega os serviços assim que a página abre
            carregarErenderizarServicos();
        } else {
            listaServicosDiv.innerHTML = '<p>Empresa não encontrada. Por favor, complete seu cadastro na página "Meu Perfil".</p>';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Delegação de eventos para a lista de serviços
listaServicosDiv.addEventListener('click', (event) => {
    const target = event.target;
    const servicoId = target.dataset.id;
    if (!servicoId) return;

    if (target.classList.contains('btn-editar')) {
        // Redireciona para a página de edição, passando o ID do serviço
        window.location.href = `editar-servico.html?id=${servicoId}`;
    }

    if (target.classList.contains('btn-excluir')) {
        excluirServico(servicoId);
    }
});

listaServicosDiv.addEventListener('change', (event) => {
    const target = event.target;
    if (target.classList.contains('toggle-visibilidade')) {
        const servicoId = target.dataset.id;
        const isVisible = target.checked;
        atualizarVisibilidade(servicoId, isVisible);
    }
});
