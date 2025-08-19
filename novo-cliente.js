import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Função genérica para mostrar toast (ou alert fallback)
function mostrarToast(texto, cor) {
  if (typeof Toastify !== "undefined") {
    Toastify({
      text: texto,
      duration: 4000,
      gravity: "top",
      position: "right",
      style: { background: cor, color: "white" }
    }).showToast();
  } else {
    alert(texto);
  }
}

// Busca o ID da empresa pelo dono autenticado
async function getEmpresaIdDoDono(uid) {
  const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
  const snapshot = await getDocs(empresQ);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

// Inicializa listeners e submissão do formulário
function inicializarPaginaNovoCliente(empresaId) {
  const formNovoCliente = document.getElementById('form-cliente');
  const inputNome = document.getElementById('nome-cliente');
  const inputTelefone = document.getElementById('telefone-cliente');
  const inputEmail = document.getElementById('email-cliente');
  const btnSalvar = formNovoCliente ? formNovoCliente.querySelector('.btn-submit') : null;

  if (!formNovoCliente || !inputNome || !btnSalvar) {
    console.log("Algum elemento não foi encontrado no DOM.");
    return;
  }

  formNovoCliente.addEventListener('submit', async (event) => {
    event.preventDefault();
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
      const nome = inputNome.value.trim();
      const telefone = inputTelefone ? inputTelefone.value.trim() : "";
      const email = inputEmail ? inputEmail.value.trim() : "";

      if (!nome) {
        mostrarToast("O nome do cliente é obrigatório.", "#ef4444");
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Cliente";
        return;
      }

      if (!empresaId) {
        mostrarToast("Empresa não encontrada para este usuário!", "#ef4444");
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Cliente";
        return;
      }

      const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
      await addDoc(clientesCollection, {
        nome,
        telefone,
        email,
        criadoEm: new Date().toISOString()
      });

      mostrarToast("Cliente cadastrado com sucesso!", "#22c55e");
      formNovoCliente.reset();
      setTimeout(() => {
        window.location.href = "clientes.html";
      }, 1200);
    } catch (error) {
      console.error("Erro ao cadastrar cliente:", error);
      mostrarToast("Erro ao cadastrar cliente.", "#ef4444");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Cliente";
    }
  });
}

// Monitora autenticação e inicia o fluxo
onAuthStateChanged(auth, async (user) => {
  const formNovoCliente = document.getElementById('form-cliente');
  if (user) {
    const empresaId = await getEmpresaIdDoDono(user.uid);
    if (empresaId) {
      inicializarPaginaNovoCliente(empresaId);
    } else if (formNovoCliente) {
      formNovoCliente.innerHTML = "<p style='color:red;'>Não foi possível encontrar uma empresa associada a este usuário.</p>";
    }
  } else {
    window.location.href = 'login.html';
  }
});
