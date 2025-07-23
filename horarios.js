/**
 * horarios.js
 * * Gere a página "Meus Horários", permitindo ao empresário
 * * carregar e salvar os seus horários de atendimento no Firestore.
 */

import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-horarios');
const diasDaSemana = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

let uid;

onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    carregarHorarios(uid);
    form.addEventListener('submit', handleFormSubmit);
  } else {
    window.location.href = 'login.html';
  }
});

/**
 * Carrega os horários salvos do Firestore e preenche o formulário.
 * @param {string} userId - O ID do utilizador autenticado.
 */
async function carregarHorarios(userId) {
  try {
    const horariosRef = doc(db, "users", userId, "configuracoes", "horarios");
    const docSnap = await getDoc(horariosRef);

    if (docSnap.exists()) {
      const horarios = docSnap.data();
      diasDaSemana.forEach(dia => {
        if (horarios[dia]) {
          document.getElementById(`${dia}-inicio`).value = horarios[dia].inicio;
          document.getElementById(`${dia}-fim`).value = horarios[dia].fim;
          document.getElementById(`${dia}-ativo`).checked = horarios[dia].ativo;
        }
      });
    } else {
      console.log("Nenhum horário configurado. A usar valores padrão.");
    }
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
  }
}

/**
 * Lida com o envio do formulário para salvar os horários.
 * @param {Event} event - O evento de submit.
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  const btnSalvar = form.querySelector('button[type="submit"]');
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A salvar...';

  const horariosData = {};
  diasDaSemana.forEach(dia => {
    horariosData[dia] = {
      inicio: document.getElementById(`${dia}-inicio`).value,
      fim: document.getElementById(`${dia}-fim`).value,
      ativo: document.getElementById(`${dia}-ativo`).checked
    };
  });

  try {
    const horariosRef = doc(db, "users", uid, "configuracoes", "horarios");
    await setDoc(horariosRef, horariosData);
    alert("Horários salvos com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar horários:", error);
    alert("Ocorreu um erro ao salvar os horários.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar Horários';
  }
}
