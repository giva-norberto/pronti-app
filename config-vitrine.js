/**
 * config-vitrine.js (VERSÃO CORRIGIDA E ALINHADA COM A ESTRUTURA 'empresarios')
 *
 * Lógica Principal:
 * 1. Encontra a empresa ('empresaId') do dono logado.
 * 2. Carrega a lista de serviços do array que está dentro do documento do profissional.
 * 3. Permite ativar/desativar a visibilidade de cada serviço na vitrine.
 * 4. Ao salvar, atualiza o array de serviços inteiro no Firestore.
 */

import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaServicosContainer = document.getElementById('lista-servicos-vitrine');
const btnPreview = document.getElementById('btn-preview-vitrine');

let empresaId = null;
let profissionalRef = null; // Referência para o documento do profissional

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // CORREÇÃO: Primeiro, encontramos a empresa para depois carregar os dados
        const idDaEmpresa = await getEmpresaIdDoDono(user.uid);
        if (idDaEmpresa) {
            empresaId = idDaEmpresa;
            // A referência agora aponta para o documento do profissional (o dono)
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
            carregarServicosParaConfiguracao();
            configurarBotaoPreview();
        } else {
            listaServicosContainer.innerHTML = '<p style="color:red;">Empresa não encontrada. Por favor, complete o seu perfil primeiro.</p>';
        }
    } else {
        window.location.href = 'login.html';
    }
});


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
 * Carrega todos os serviços do empresário a partir do array no documento do profissional.
 */
async function carregarServicosParaConfiguracao() {
    if (!listaServicosContainer || !profissionalRef) return;
    listaServicosContainer.innerHTML = '<p>A carregar os seus serviços...</p>';

    try {
        const docSnap = await getDoc(profissionalRef);

        if (!docSnap.exists() || !docSnap.data().servicos || docSnap.data().servicos.length === 0) {
            listaServicosContainer.innerHTML = '<p>Você ainda não cadastrou nenhum serviço. Vá para a aba "Serviços" para começar.</p>';
            return;
        }

        const servicos = docSnap.data().servicos;
        listaServicosContainer.innerHTML = ''; // Limpa a lista

        servicos.forEach(servico => {
            const isVisible = servico.visivelNaVitrine !== false;
            const item = document.createElement('div');
            item.className = 'servico-item';
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

            item.innerHTML = `
                <div>
                    <h3>${servico.nome}</h3>
                    <p style="margin:0;">Preço: R$ ${parseFloat(servico.preco || 0).toFixed(2)}</p>
                </div>
                <label class="switch">
                    <input type="checkbox" class="toggle-visibilidade" data-id="${servico.id}" ${isVisible ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            listaServicosContainer.appendChild(item);
        });

        adicionarListenersDeToggle();

    } catch (error) {
        console.error("Erro ao carregar serviços para configuração:", error);
        listaServicosContainer.innerHTML = '<p style="color:red;">Erro ao carregar os seus serviços.</p>';
    }
}

/**
 * Adiciona os "ouvintes" de eventos aos botões toggle.
 */
function adicionarListenersDeToggle() {
    listaServicosContainer.querySelectorAll('.toggle-visibilidade').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const servicoId = e.target.dataset.id;
            const isChecked = e.target.checked;
            atualizarVisibilidadeDoServico(servicoId, isChecked);
        });
    });
}

/**
 * CORREÇÃO: Nova função para atualizar a visibilidade de um serviço dentro do array.
 * @param {string} servicoId - O ID do serviço a ser atualizado.
 * @param {boolean} isVisible - O novo estado de visibilidade.
 */
async function atualizarVisibilidadeDoServico(servicoId, isVisible) {
    try {
        // 1. Lê o documento do profissional para obter a lista mais recente de serviços.
        const docSnap = await getDoc(profissionalRef);
        if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");
        
        const servicosAtuais = docSnap.data().servicos || [];

        // 2. Cria uma nova lista, alterando apenas o serviço com o ID correspondente.
        const novaListaDeServicos = servicosAtuais.map(s => {
            if (String(s.id) === servicoId) {
                return { ...s, visivelNaVitrine: isVisible };
            }
            return s;
        });

        // 3. Atualiza o documento no Firestore com a lista (array) inteira modificada.
        await updateDoc(profissionalRef, {
            servicos: novaListaDeServicos
        });
        
        // Opcional: Adicionar uma notificação de sucesso
        // alert("Visibilidade atualizada com sucesso!");

    } catch (error) {
        console.error("Erro ao atualizar a visibilidade do serviço:", error);
        alert("Não foi possível alterar a visibilidade do serviço.");
        // Recarrega a lista para reverter a mudança visual em caso de erro
        carregarServicosParaConfiguracao();
    }
}


/**
 * CORREÇÃO: Configura o botão de pré-visualização para usar o 'empresaId'.
 */
function configurarBotaoPreview() {
    if (!btnPreview || !empresaId) return;

    const urlCompleta = `vitrine.html?empresa=${empresaId}`;
    
    btnPreview.addEventListener('click', () => {
        window.open(urlCompleta, '_blank');
    });
}
