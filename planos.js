import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

// Elementos do DOM
const listaPlanosDiv = document.getElementById('lista-de-planos');
const btnNovoPlano = document.querySelector('.btn-novo');

// Variáveis de estado
let empresaId = null;
let isDono = false;

// Função para pegar empresa ativa do localStorage
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

// Inicialização e autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            empresaId = getEmpresaIdAtiva();
            if (!empresaId) {
                if (listaPlanosDiv) listaPlanosDiv.innerHTML = '<p style="color:red;">Nenhuma empresa ativa selecionada.</p>';
                return;
            }

            const empresaRef = doc(db, "empresarios", empresaId);
            const empresaSnap = await getDoc(empresaRef);
            if (empresaSnap.exists()) {
                const adminUID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
                isDono = (empresaSnap.data().donoId === user.uid) || (user.uid === adminUID);
            } else {
                listaPlanosDiv.innerHTML = '<p style="color:red;">Empresa ativa não encontrada.</p>';
                return;
            }

            // Aqui você pode controlar visibilidade de botões se necessário
            if (btnNovoPlano) {
                btnNovoPlano.style.display = isDono ? 'inline-flex' : 'none';
            }

            // Inicie carregamento dos planos normalmente
            carregarPlanos(empresaId);

        } catch (error) {
            console.error("Erro durante a inicialização:", error);
            if (listaPlanosDiv) listaPlanosDiv.innerHTML = `<p style="color:red;">Ocorreu um erro crítico ao carregar os planos.</p>`;
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Sua função carregarPlanos(empresaId) continua igual!
