/**
 * config-vitrine.js
 * * Este script gere a nova página "Minha Vitrine", permitindo ao empresário
 * * controlar quais serviços são exibidos publicamente.
 */

import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const listaServicosContainer = document.getElementById('lista-servicos-vitrine');
const btnPreview = document.getElementById('btn-preview-vitrine');

let uid;

onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    carregarServicosParaConfiguracao(uid);
    configurarBotaoPreview(uid);
  } else {
    window.location.href = 'login.html';
  }
});

/**
 * Carrega todos os serviços do empresário e cria os controlos de visibilidade.
 * @param {string} userId - O ID do utilizador autenticado.
 */
async function carregarServicosParaConfiguracao(userId) {
  if (!listaServicosContainer) return;
  listaServicosContainer.innerHTML = '<p>A carregar os seus serviços...</p>';

  try {
    const servicosUserCollection = collection(db, "users", userId, "servicos");
    const querySnapshot = await getDocs(servicosUserCollection);

    if (querySnapshot.empty) {
      listaServicosContainer.innerHTML = '<p>Você ainda não cadastrou nenhum serviço. Vá para a aba "Serviços" para começar.</p>';
      return;
    }

    listaServicosContainer.innerHTML = '';
    querySnapshot.forEach(doc => {
      const servico = doc.data();
      const servicoId = doc.id;
      
      const item = document.createElement('div');
      item.className = 'servico-item'; // Reutiliza o estilo de item
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';

      // Se o campo não existir, assume-se que o serviço é visível (padrão)
      const isVisible = servico.visivelNaVitrine !== false;

      item.innerHTML = `
        <div>
          <h3>${servico.nome}</h3>
          <p style="margin:0;">Preço: R$ ${parseFloat(servico.preco || 0).toFixed(2)}</p>
        </div>
        <label class="switch">
          <input type="checkbox" data-id="${servicoId}" ${isVisible ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;
      listaServicosContainer.appendChild(item);
    });

    // Adiciona os eventos de clique aos toggles
    adicionarListenersDeToggle(userId);

  } catch (error) {
    console.error("Erro ao carregar serviços para configuração:", error);
    listaServicosContainer.innerHTML = '<p style="color:red;">Erro ao carregar os seus serviços.</p>';
  }
}

/**
 * Adiciona os "ouvintes" de eventos aos botões toggle.
 * @param {string} userId - O ID do utilizador autenticado.
 */
function adicionarListenersDeToggle(userId) {
    listaServicosContainer.querySelectorAll('.switch input[type="checkbox"]').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const servicoId = e.target.dataset.id;
            const isChecked = e.target.checked;

            try {
                const servicoRef = doc(db, "users", userId, "servicos", servicoId);
                // Atualiza o campo 'visivelNaVitrine' no Firestore
                await updateDoc(servicoRef, {
                    visivelNaVitrine: isChecked
                });
                // Poderia adicionar uma notificação de sucesso aqui (Toastify)
            } catch (error) {
                console.error("Erro ao atualizar a visibilidade do serviço:", error);
                alert("Não foi possível alterar a visibilidade do serviço.");
                // Reverte a mudança visual em caso de erro
                e.target.checked = !isChecked;
            }
        });
    });
}

/**
 * Configura o botão de pré-visualização para abrir o link correto.
 * @param {string} userId - O ID do utilizador autenticado.
 */
async function configurarBotaoPreview(userId) {
    if (!btnPreview) return;
    try {
        const perfilRef = doc(db, "users", userId, "publicProfile", "profile");
        const docSnap = await getDoc(perfilRef);
        if (docSnap.exists() && docSnap.data().slug) {
            const slug = docSnap.data().slug;
            const urlCompleta = `vitrine.html?slug=${slug}`;
            btnPreview.addEventListener('click', () => {
                window.open(urlCompleta, '_blank');
            });
        } else {
            btnPreview.textContent = "Preencha seu perfil para pré-visualizar";
            btnPreview.disabled = true;
        }
    } catch (error) {
        console.error("Erro ao configurar o botão de pré-visualização:", error);
    }
}
