import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const diasContainer = document.getElementById("dias-container");

function gerarCamposHorarios(dadosSalvos = {}) {
  diasContainer.innerHTML = ""; // limpa antes de gerar
  diasSemana.forEach((dia, index) => {
    const id = dia.toLowerCase();
    const diaSalvo = dadosSalvos[id] || {};
    const ativo = diaSalvo.ativo ?? true;
    const inicio = diaSalvo.inicio || "08:00";
    const fim = diaSalvo.fim || "17:00";

    const div = document.createElement("div");
    div.classList.add("dia-semana");
    div.innerHTML = `
      <div class="dia-semana-nome">${dia}</div>
      <div class="horarios-controles">
        <label class="switch">
          <input type="checkbox" id="atendimento-${id}" ${ativo ? "checked" : ""}>
          <span class="slider"></span>
        </label>
        <input type="time" id="inicio-${id}" value="${inicio}">
        <span>às</span>
        <input type="time" id="fim-${id}" value="${fim}">
      </div>
    `;
    diasContainer.appendChild(div);
  });
}

function coletarHorariosDoFormulario() {
  const horarios = {};
  diasSemana.forEach((dia) => {
    const id = dia.toLowerCase();
    horarios[id] = {
      ativo: document.getElementById(`atendimento-${id}`).checked,
      inicio: document.getElementById(`inicio-${id}`).value,
      fim: document.getElementById(`fim-${id}`).value,
    };
  });
  return horarios;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const docRef = doc(db, "users", uid, "publicProfile", "profile");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById("nomeNegocio").value = data.nomeNegocio || "";
      document.getElementById("slug").value = data.slug || "";
      document.getElementById("descricao").value = data.descricao || "";
      document.getElementById("intervalo-atendimento").value = data.intervalo || "30";
      document.getElementById("url-base").textContent = `https://pronti.app.br/${user.uid}/`;

      if (data.logoUrl) {
        document.getElementById("logo-preview").src = data.logoUrl;
      }

      gerarCamposHorarios(data.horarios);
    } else {
      gerarCamposHorarios(); // se não houver dados salvos
    }

    document.getElementById("form-perfil").addEventListener("submit", async (e) => {
      e.preventDefault();

      const nomeNegocio = document.getElementById("nomeNegocio").value;
      const slug = document.getElementById("slug").value;
      const descricao = document.getElementById("descricao").value;
      const intervalo = document.getElementById("intervalo-atendimento").value;
      const horarios = coletarHorariosDoFormulario();

      let logoUrl = document.getElementById("logo-preview").src;
      const logoFile = document.getElementById("logoNegocio").files[0];
      if (logoFile) {
        const storageRef = ref(storage, `users/${uid}/logo.jpg`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      await setDoc(docRef, {
        nomeNegocio,
        slug,
        descricao,
        intervalo,
        horarios,
        logoUrl,
      });

      alert("Dados salvos com sucesso!");
    });

    // Botão copiar link
    const btnCopiar = document.getElementById("btn-copiar-link");
    btnCopiar.addEventListener("click", () => {
      const slug = document.getElementById("slug").value;
      const url = `https://pronti.app.br/${uid}/${slug}`;
      navigator.clipboard.writeText(url);
      alert("Link copiado: " + url);
    });
  } else {
    window.location.href = "login.html";
  }
});
