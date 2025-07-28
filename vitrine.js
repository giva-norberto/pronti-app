import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Utilitários DOM
const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");
const nomeElemento = document.getElementById("nome-negocio");
const descElemento = document.getElementById("descricao-negocio");
const imagemElemento = document.getElementById("foto-perfil");
const listaServicos = document.getElementById("lista-servicos");
const gradeHorarios = document.getElementById("grade-horarios");
const btnConfirmar = document.getElementById("btn-confirmar-agendamento");
const inputNome = document.getElementById("input-nome");
const inputTelefone = document.getElementById("input-telefone");
const inputData = document.getElementById("input-data");
const notificacao = document.getElementById("notificacao");

let servicoSelecionado = null;
let horarioSelecionado = null;

// Carrega perfil público
async function carregarPerfil() {
  const docRef = doc(db, `users/${uid}/publicProfile/profile`);
  const snap = await getDocs(query(collection(db, `users/${uid}/publicProfile`), where("__name__", "==", "profile")));
  snap.forEach((doc) => {
    const data = doc.data();
    nomeElemento.textContent = data.nomeNegocio || "Nome do negócio";
    descElemento.textContent = data.descricao || "";
    if (data.fotoURL) imagemElemento.src = data.fotoURL;
  });
}

// Carrega serviços
async function carregarServicos() {
  const ref = collection(db, `users/${uid}/servicos`);
  const snapshot = await getDocs(ref);
  listaServicos.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const btn = document.createElement("button");
    btn.className = "btn-servico";
    btn.textContent = data.nome + " - " + data.preco?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    btn.onclick = () => {
      document.querySelectorAll(".btn-servico").forEach((el) => el.classList.remove("selecionado"));
      btn.classList.add("selecionado");
      servicoSelecionado = { id: docSnap.id, ...data };
    };
    listaServicos.appendChild(btn);
  });
}

// Carrega horários
async function carregarHorarios() {
  const ref = collection(db, `users/${uid}/horarios`);
  const snapshot = await getDocs(ref);
  gradeHorarios.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const btn = document.createElement("button");
    btn.className = "btn-horario";
    btn.textContent = data.horario;
    btn.onclick = () => {
      document.querySelectorAll(".btn-horario").forEach((el) => el.classList.remove("selecionado"));
      btn.classList.add("selecionado");
      horarioSelecionado = data.horario;
    };
    gradeHorarios.appendChild(btn);
  });
}

// Agendar
async function confirmarAgendamento() {
  if (!servicoSelecionado || !horarioSelecionado || !inputData.value || !inputNome.value || !inputTelefone.value) {
    alert("Preencha todos os campos e selecione um serviço e horário.");
    return;
  }

  const agendamento = {
    servico: servicoSelecionado.nome,
    preco: servicoSelecionado.preco,
    horario: horarioSelecionado,
    data: inputData.value,
    nomeCliente: inputNome.value,
    telefoneCliente: inputTelefone.value,
    criadoEm: serverTimestamp(),
  };

  await addDoc(collection(db, `users/${uid}/agendamentos`), agendamento);

  servicoSelecionado = null;
  horarioSelecionado = null;
  document.querySelectorAll(".selecionado").forEach((el) => el.classList.remove("selecionado"));
  inputNome.value = "";
  inputTelefone.value = "";
  inputData.value = "";

  mostrarNotificacao("Agendamento realizado com sucesso!", false);
}

function mostrarNotificacao(msg, erro = false) {
  notificacao.textContent = msg;
  notificacao.className = "notification-message";
  if (erro) notificacao.classList.add("error");

  notificacao.style.display = "block";
  setTimeout(() => {
    notificacao.style.opacity = 1;
    setTimeout(() => {
      notificacao.style.opacity = 0;
      setTimeout(() => (notificacao.style.display = "none"), 500);
    }, 2000);
  }, 50);
}

// Inicializa ao carregar
window.addEventListener("DOMContentLoaded", async () => {
  if (!uid) {
    alert("UID não encontrado na URL.");
    return;
  }
  await carregarPerfil();
  await carregarServicos();
  await carregarHorarios();

  btnConfirmar.addEventListener("click", confirmarAgendamento);
});
