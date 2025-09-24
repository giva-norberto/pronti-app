// ======================================================================
// ARQUIVO: promocoes.js 
// ======================================================================

import { collection, doc, addDoc, onSnapshot, query, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
// Reutilize seus helpers!
import { showAlert } from "./vitrini-utils.js";

// --- Mapeamento do DOM ---
const formPromocao = document.getElementById('form-promocao');
const selectServico = document.getElementById('servico-promo');
const listaPromocoesDiv = document.getElementById('lista-promocoes');

// --- Variáveis de Estado ---
let empresaId = localStorage.getItem("empresaAtivaId") || null;

// --- Inicialização ---
onAuthStateChanged(auth, (user) => {
    if (user && empresaId) {
        carregarServicosNoSelect();
        iniciarListenerDePromocoes();
    } else {
        window.location.href = 'login.html';
    }
});

// --- Funções Principais ---

// 1. Carrega seus serviços da empresa para popular o <select>
async function carregarServicosNoSelect() {
    const servicosRef = collection(db, "empresarios", empresaId, "servicos");
    const snapshot = await getDocs(servicosRef);
    
    snapshot.forEach(doc => {
        const servico = { id: doc.id, ...doc.data() };
        const option = document.createElement('option');
        option.value = servico.id;
        option.textContent = servico.nome; // Exibe o nome do serviço
        selectServico.appendChild(option);
    });
}

// 2. Ouve em tempo real as promoções salvas e as exibe
function iniciarListenerDePromocoes() {
    const promocoesRef = collection(db, "empresarios", empresaId, "precos_especiais");
    const q = query(promocoesRef);

    onSnapshot(q, (snapshot) => {
        const promocoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarPromocoes(promocoes);
    });
}

// 3. Renderiza a lista de promoções
function renderizarPromocoes(promocoes) {
    if (promocoes.length === 0) {
        listaPromocoesDiv.innerHTML = "<p>Nenhuma promoção cadastrada.</p>";
        return;
    }
    // Lógica para criar o HTML da lista de promoções com um botão de excluir
    // (muito similar à sua função renderizarServicos)
    listaPromocoesDiv.innerHTML = promocoes.map(promo => {
        // Obter o nome do serviço ou "Todos os serviços"
        // Formatar o desconto
        // Criar o card com o botão de excluir
        return `
            <div class="promocao-card">
                <p><strong>Serviço:</strong> ${promo.servicoId || 'Todos os serviços'}</p>
                <p><strong>Dia:</strong> ${formatarDiaSemana(promo.diaSemana)}</p>
                <p><strong>Desconto:</strong> ${formatarDesconto(promo)}</p>
                <button class="btn-excluir-promo" data-id="${promo.id}">Excluir</button>
            </div>
        `;
    }).join('');
}


// 4. Salva a nova promoção quando o formulário é enviado
formPromocao.addEventListener('submit', async (e) => {
    e.preventDefault();

    const servicoId = document.getElementById('servico-promo').value;
    
    const novaPromocao = {
        servicoId: servicoId === 'todos' ? null : servicoId,
        diaSemana: parseInt(document.getElementById('dia-semana').value, 10),
        tipoDesconto: document.getElementById('tipo-desconto').value,
        valor: parseFloat(document.getElementById('valor-desconto').value),
        ativo: true,
        criadoEm: new Date() // Firestore vai converter para Timestamp
    };

    try {
        const promocoesRef = collection(db, "empresarios", empresaId, "precos_especiais");
        await addDoc(promocoesRef, novaPromocao);
        formPromocao.reset();
        showAlert("Sucesso!", "Promoção salva com sucesso.");
    } catch (error) {
        console.error("Erro ao salvar promoção:", error);
        showAlert("Erro", "Não foi possível salvar a promoção.");
    }
});

// 5. Listener para os botões de excluir na lista
listaPromocoesDiv.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-excluir-promo')) {
        const promoId = e.target.dataset.id;
        if (confirm("Tem certeza que deseja excluir esta promoção?")) {
            const promoRef = doc(db, "empresarios", empresaId, "precos_especiais", promoId);
            await deleteDoc(promoRef);
        }
    }
});

// Funções auxiliares (formatarDiaSemana, formatarDesconto, etc.)
// ...
