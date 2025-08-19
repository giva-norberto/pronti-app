import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Sua config do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const formNovoCliente = document.getElementById('form-cliente');
const inputNome = document.getElementById('nome-cliente');
const inputTelefone = document.getElementById('telefone-cliente');
const inputEmail = document.getElementById('email-cliente');
const btnSalvar = formNovoCliente ? formNovoCliente.querySelector('.btn-submit') : null;

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

async function getEmpresaIdDoDono(uid) {
  const empresQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
  const snapshot = await getDocs(empresQ);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

function inicializarPaginaNovoCliente(empresaId) {
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

// Garante autenticação e inicializa o app
onAuthStateChanged(auth, async (user) => {
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
