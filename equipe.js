/**
 * equipe.js (VERSÃO DE TESTE DEFINITIVO)
 */
import { getFirestore, collection, addDoc, onSnapshot, query, where, getDocs, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebase-config.js";

window.addEventListener('DOMContentLoaded', () => {
    const db = getFirestore(app);
    const storage = getStorage(app);
    const auth = getAuth(app);

    const btnAddProfissional = document.getElementById('btn-add-profissional');
    const modalAddProfissional = document.getElementById('modal-add-profissional');
    const formAddProfissional = document.getElementById('form-add-profissional');
    const btnCancelarProfissional = document.getElementById('btn-cancelar-profissional');
    const listaProfissionaisPainel = document.getElementById('lista-profissionais-painel');

    let empresaId = null;
    let unsubProfissionais = null;

    async function getEmpresaIdDoDono(uid) {
        console.log("DEBUG: A procurar pela empresa do dono com UID:", uid); // PONTO A
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        
        console.log("DEBUG: Consulta executada. Documentos encontrados:", snapshot.size); // PONTO B

        if (snapshot.empty) return null;
        return snapshot.docs[0].id;
    }

    if (btnAddProfissional) {
        btnAddProfissional.addEventListener('click', () => {
            console.log("DEBUG: Botão 'Adicionar' clicado. O empresaId atual é:", empresaId); // PONTO C
            if (!empresaId) {
                alert("Não foi possível identificar a sua empresa. Por favor, recarregue a página ou verifique se o seu perfil foi salvo corretamente.");
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
            renderizarEquipe(snapshot.docs.map(doc => doc.data()));
        });
    }

    function renderizarEquipe(equipe) {
        if (!listaProfissionaisPainel) return;
        listaProfissionaisPainel.innerHTML = '';
        if (equipe.length === 0) {
            listaProfissionaisPainel.innerHTML = '<p>Nenhum profissional na equipe ainda.</p>';
            return;
        }
        equipe.forEach(profissional => {
            const div = document.createElement('div');
            div.className = 'profissional-card';
            div.innerHTML = `
                <img src="${profissional.fotoUrl || 'https://placehold.co/40x40'}" alt="Foto de ${profissional.nome}">
                <span class="profissional-nome">${profissional.nome}</span>
            `;
            listaProfissionaisPainel.appendChild(div);
        });
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
        console.log("--- DEBUG INICIAL ---");
        if (user) {
            console.log("DEBUG: Usuário está logado com UID:", user.uid);
            empresaId = await getEmpresaIdDoDono(user.uid);
            console.log("DEBUG: ID da empresa encontrado:", empresaId);
            
            if (empresaId) {
                iniciarListenerDaEquipe();
                if(btnAddProfissional) btnAddProfissional.disabled = false;
            } else {
                if (listaProfissionaisPainel) listaProfissionaisPainel.innerHTML = "<p>Empresa não encontrada. Salve seu perfil primeiro.</p>";
                if(btnAddProfissional) btnAddProfissional.disabled = true;
            }
        } else {
            console.log("DEBUG: Nenhum usuário logado. Redirecionando...");
            if (window.location.pathname.includes('/painel/')) { // Adapte se necessário
                 window.location.href = '/login.html';
            }
        }
        console.log("--- FIM DO DEBUG INICIAL ---");
    });
});
