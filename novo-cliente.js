import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const formNovoCliente = document.getElementById('form-novo-cliente');
const inputNome = document.getElementById('nome-cliente');
const inputTelefone = document.getElementById('telefone-cliente');
const btnSalvar = document.getElementById('btn-salvar-cliente');

let empresaId = null;

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

function inicializarPaginaNovoCliente() {
  if (!formNovoCliente || !inputNome || !btnSalvar) {
    console.log("Algum elemento não foi encontrado no DOM.");
    return;
  }

  formNovoCliente.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log("Formulário enviado!"); // Debug
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
      const nome = inputNome.value.trim();
      const telefone = inputTelefone ? inputTelefone.value.trim() : "";

      if (!nome) {
        mostrarToast("O nome do cliente é obrigatório.", "var(--cor-perigo)");
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Cliente";
        return;
      }

      if (!empresaId) {
        mostrarToast("Empresa não encontrada para este usuário!", "var(--cor-perigo)");
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Cliente";
        return;
      }

      const clientesCollection = collection(db, "empresarios", empresaId, "clientes");
      await addDoc(clientesCollection, {
        nome,
        telefone,
        criadoEm: new Date()
      });

      mostrarToast("Cliente cadastrado com sucesso!", "var(--cor-sucesso)");
      formNovoCliente.reset();
    } catch (error) {
      console.error("Erro ao cadastrar cliente:", error);
      mostrarToast("Erro ao cadastrar cliente.", "var(--cor-perigo)");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Cliente";
    }
  });
}

async function getEmpresaIdDoDono(uid) {
  const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
  const snapshot = await getDocs(empresQ);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    empresaId = await getEmpresaIdDoDono(user.uid);
    if (empresaId) {
      inicializarPaginaNovoCliente();
    } else if (formNovoCliente) {
      formNovoCliente.innerHTML = "<p style='color:red;'>Não foi possível encontrar uma empresa associada a este utilizador.</p>";
    }
  } else {
    window.location.href = 'login.html';
  }
});
