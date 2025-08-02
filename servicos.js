/**
 * servicos.js
 * * Este arquivo controla toda a lógica da página de gerenciamento de serviços
 * no painel do empresário. Ele é responsável por:
 * - Autenticar o dono da empresa.
 * - Carregar e exibir a lista de serviços a partir do Firestore.
 * - Permitir a edição, exclusão e alteração da visibilidade dos serviços.
 */

// Importa as funções necessárias do Firebase e dos módulos de utilitários.
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";
import { showAlert, showCustomConfirm } from "./vitrini-utils.js"; // showAlert não foi usado, mas mantido. showCustomConfirm é essencial.

// O evento 'DOMContentLoaded' garante que o script só vai rodar depois que a página HTML inteira for carregada.
document.addEventListener('DOMContentLoaded', () => {

    // Inicializa os serviços do Firebase
    const db = getFirestore(app);
    const auth = getAuth(app);

    // Pega o elemento HTML onde a lista de serviços será exibida
    const listaServicosDiv = document.getElementById('lista-servicos');

    // Variáveis de estado para guardar informações importantes enquanto a página está aberta
    let currentUser = null; // Guardará o usuário logado
    let empresaId = null;   // Guardará o ID da empresa do usuário
    let profissionalRef = null; // Guardará a referência para o documento do profissional no Firestore

    /**
     * Encontra o ID da empresa associada a um ID de dono (usuário).
     * @param {string} uid - O ID do usuário dono.
     * @returns {string|null} - O ID da empresa ou nulo se não encontrar.
     */
    async function getEmpresaIdDoDono(uid) {
        if (!uid) return null;
        // Cria uma consulta para buscar na coleção 'empresarios' onde o campo 'donoId' é igual ao uid do usuário logado.
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return snapshot.docs[0].id; // Retorna o ID do primeiro documento encontrado
    }

    /**
     * Carrega os serviços do documento do profissional no Firestore e os exibe na tela.
     */
    async function carregarErenderizarServicos() {
        // Se a referência ao perfil do profissional não foi encontrada, exibe um erro.
        if (!profissionalRef) {
            listaServicosDiv.innerHTML = '<p style="color:red;">Não foi possível encontrar o perfil profissional. Complete seu cadastro em "Meu Perfil".</p>';
            return;
        }
        // Mostra uma mensagem de carregamento enquanto busca os dados.
        listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

        try {
            // Busca o documento do profissional no Firestore.
            const docSnap = await getDoc(profissionalRef);

            // Verifica se o documento existe e se ele contém a lista de serviços.
            if (!docSnap.exists() || !docSnap.data().servicos || docSnap.data().servicos.length === 0) {
                listaServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado. Clique em "Adicionar Novo Serviço" para começar.</p>';
                return;
            }

            // Pega a lista (array) de serviços de dentro do documento.
            const servicos = docSnap.data().servicos;
            listaServicosDiv.innerHTML = ''; // Limpa a área de exibição

            // Ordena os serviços em ordem alfabética pelo nome.
            servicos.sort((a, b) => a.nome.localeCompare(b.nome));

            // Para cada serviço na lista, cria um card HTML e o adiciona na página.
            servicos.forEach(servico => {
                const isVisible = servico.visivelNaVitrine !== false; // Verifica se o serviço deve estar visível
                const el = document.createElement('div');
                el.classList.add('servico-item');
                el.style.cssText = 'padding: 15px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; background-color: #fafafa; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;';

                // Cria o HTML interno do card com os dados do serviço.
                el.innerHTML = `
                    <div class="item-info">
                        <h3>${servico.nome}</h3>
                        <p><strong>Preço:</strong> R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</p>
                        <p><strong>Duração:</strong> ${servico.duracao} minutos</p>
                    </div>
                    <div class="item-acoes" style="display: flex; gap: 10px; align-items: center;">
                        <div class="acao-visibilidade" style="display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <label class="switch-label" style="font-size: 0.8em;">Ativo na Vitrine</label>
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
     * Exclui um serviço da lista (array) dentro do documento do profissional.
     * @param {string} servicoId - O ID do serviço a ser excluído.
     */
    async function excluirServico(servicoId) {
        console.log("Clicou para excluir. O ID é:", servicoId, "e o tipo é:", typeof servicoId);
        
        // Chama o modal personalizado para confirmar a ação com o usuário.
        const confirmado = await showCustomConfirm("Confirmar Exclusão", "Você tem certeza? Esta ação é permanente.");
        
        // Se o usuário clicou em "Cancelar", a função para aqui.
        if (!confirmado) {
            console.log("Ação de exclusão cancelada pelo usuário.");
            return;
        }

        try {
            // Pega a versão mais recente do documento do profissional.
            const docSnap = await getDoc(profissionalRef);
            console.log("Documento do profissional encontrado:", docSnap.exists());
            if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");

            const servicosAtuais = docSnap.data().servicos || [];
            console.log("Serviços atuais antes de excluir:", servicosAtuais);

            // --- AQUI ESTÁ A CORREÇÃO CRÍTICA ---
            // Filtra a lista, mantendo apenas os serviços cujo ID é diferente do que queremos excluir.
            // Comparamos os IDs como Strings para evitar erros de tipo (ex: "123" !== 123).
            const novaListaDeServicos = servicosAtuais.filter(s => String(s.id) !== servicoId);
            
            console.log("Nova lista após o filtro:", novaListaDeServicos);

            // Atualiza o documento no Firestore com a nova lista de serviços (sem o item excluído).
            await updateDoc(profissionalRef, { servicos: novaListaDeServicos });
            
            await showAlert("Sucesso", "Serviço excluído com sucesso.");
            carregarErenderizarServicos(); // Recarrega a lista na tela para refletir a mudança.
        } catch (error) {
            console.error("Erro ao excluir serviço: ", error);
            await showAlert("Erro", "Erro ao excluir serviço.");
        }
    }

    /**
     * Atualiza a propriedade 'visivelNaVitrine' de um serviço específico.
     * @param {string} servicoId - O ID do serviço a ser atualizado.
     * @param {boolean} visivel - O novo estado de visibilidade.
     */
    async function atualizarVisibilidade(servicoId, visivel) {
        try {
            const docSnap = await getDoc(profissionalRef);
            if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");

            const servicosAtuais = docSnap.data().servicos || [];
            // Usa .map() para criar uma nova lista, alterando apenas o serviço com o ID correspondente.
            const novaListaDeServicos = servicosAtuais.map(s => {
                if (String(s.id) === servicoId) {
                    return { ...s, visivelNaVitrine: visivel };
                }
                return s;
            });
            // Atualiza o documento no Firestore com a lista modificada.
            await updateDoc(profissionalRef, { servicos: novaListaDeServicos });
        } catch (error) {
            console.error("Erro ao atualizar visibilidade:", error);
            await showAlert("Erro", "Erro ao alterar visibilidade.");
            carregarErenderizarServicos(); // Recarrega a lista para reverter a mudança visual em caso de erro.
        }
    }

    // Monitora o estado de autenticação do usuário.
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user; // Guarda o usuário logado
            empresaId = await getEmpresaIdDoDono(user.uid);
            
            if (empresaId) {
                // Monta a referência para o documento do profissional específico.
                profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
                carregarErenderizarServicos(); // Carrega os serviços do profissional logado.
            } else {
                listaServicosDiv.innerHTML = '<p>Empresa não encontrada. Por favor, complete seu cadastro na página "Meu Perfil".</p>';
            }
        } else {
            // Se não houver usuário logado, redireciona para a página de login.
            window.location.href = 'login.html';
        }
    });

    // Adiciona um único "escutador de eventos" ao container da lista para gerenciar todos os cliques.
    listaServicosDiv.addEventListener('click', (event) => {
        const target = event.target;
        const servicoId = target.dataset.id;
        if (!servicoId) return; // Se o elemento clicado não tem um data-id, ignora.

        // Se o botão clicado tem a classe 'btn-editar', redireciona para a página de edição.
        if (target.classList.contains('btn-editar')) {
            window.location.href = `editar-servico.html?id=${servicoId}`;
        }

        // Se o botão clicado tem a classe 'btn-excluir', chama a função de exclusão.
        if (target.classList.contains('btn-excluir')) {
            excluirServico(servicoId);
        }
    });

    // Adiciona um "escutador" para o evento 'change' (usado pelo toggle de visibilidade).
    listaServicosDiv.addEventListener('change', (event) => {
        const target = event.target;
        if (target.classList.contains('toggle-visibilidade')) {
            const servicoId = target.dataset.id;
            const isVisible = target.checked;
            atualizarVisibilidade(servicoId, isVisible);
        }
    });

}); // Fim do DOMContentLoaded
