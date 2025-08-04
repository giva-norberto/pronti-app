/**
 * equipe.js
 * Lógica dedicada para gerenciar a equipe de profissionais.
 */

import { getFirestore, collection, addDoc, onSnapshot, query, where, getDocs, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "./firebase-config.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// ELEMENTOS DO DOM
const btnAddProfissional = document.getElementById('btn-add-profissional');
const modalAddProfissional = document.getElementById('modal-add-profissional');
const formAddProfissional = document.getElementById('form-add-profissional');
const btnCancelarProfissional = document.getElementById('btn-cancelar-profissional');
const listaProfissionaisPainel = document.getElementById('lista-profissionais-painel');

// VARIÁVEL DE ESTADO
let empresaId = null;
let unsubProfissionais = null;

async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

if (btnAddProfissional) {
    btnAddProfissional.addEventListener('click', () => {
        if (!empresaId) {
            alert("Não foi possível identificar a empresa. Recarregue a página.");
            return;
        }
        if(formAddProfissional) formAddProfissional.reset();
        if(modalAddProfissional) modalAddProfissional.style.display = 'flex';
    });
}

if (btnCancelarProfissional) {
    btnCancelarProfissional.addEventListener('click', () => {
        if(modalAddProfissional) modalAddProfissional.style.display = 'none';
    });
}

function iniciarListenerDaEquipe() {
    if (!empresaId || !listaProfissionaisPainel) return;
    if (unsubProfissionais) unsubProfissionais();
    const profissionaisRef = collection(db, 'empresarios', empresaId, 'profissionais');
    unsubProfissionais = onSnapshot(profissionaisRef, (snapshot) => {
        if(snapshot.empty) {
            listaProfissionaisPainel.innerHTML = '<p>Nenhum profissional na equipe ainda.</p>';
            return;
        }
        const profissionais = snapshot.docs.map(doc => doc.data());
        renderizarEquipe(profissionais);
    });
}

/**
 * [CORRIGIDO] Renderiza a lista de profissionais usando .map().join('').
 * @param {Array} equipe - A lista de profissionais para desenhar.
 */
function renderizarEquipe(equipe) {
    if (!listaProfissionaisPainel) return;
    listaProfissionaisPainel.innerHTML = equipe.map(profissional => `
        <div class="profissional-card">
            <img src="${profissional.fotoUrl || 'https://placehold.co/40x40'}" alt="Foto de ${profissional.nome}">
            <span class="profissional-nome">${profissional.nome}</span>
        </div>
    `).join('');
}

if (formAddProfissional) {
    formAddProfissional.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        const nome = document.getElementById('nome-profissional').value.trim();
        const fotoFile = document.getElementById('foto-profissional').files[0];

        if (!nome) {
            alert("O nome do profissional é obrigatório.");
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Salvar Profissional";
            return;
        }

        let fotoURL = '';
        if (fotoFile) {
            try {
                const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
                await uploadBytes(storageRef, fotoFile);
                fotoURL = await getDownloadURL(storageRef);
            } catch (error) {
                console.error("Erro ao fazer upload da foto:", error);
                alert("Erro ao enviar a imagem.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Salvar Profissional";
                return;
            }
        }

        const novoProfissional = {
            nome,
            fotoUrl: fotoURL,
            ehDono: false,
            servicos: [],
            horarios: {},
            criadoEm: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'empresarios', empresaId, 'profissionais'), novoProfissional);
            if(modalAddProfissional) modalAddProfissional.style.display = 'none';
        } catch (error) {
            console.error("Erro ao adicionar profissional:", error);
            alert("Erro ao adicionar profissional.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Salvar Profissional";
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            iniciarListenerDaEquipe();
        } else if (listaProfissionaisPainel) {
            listaProfissionaisPainel.innerHTML = "<p>Empresa não encontrada. Salve seu perfil primeiro.</p>";
        }
    } else {
        if (window.location.pathname !== '/login.html') {
             window.location.href = 'login.html';
        }
    }
});
