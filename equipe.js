/**
 * equipe.js (VERSÃO FINAL E DEFINITIVA)
 */
import { collection, addDoc, onSnapshot, query, where, getDocs, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth, storage } from "./firebase-config.js";

window.addEventListener('DOMContentLoaded', () => {
    const btnAddProfissional = document.getElementById('btn-add-profissional');
    const modalAddProfissional = document.getElementById('modal-add-profissional');
    const formAddProfissional = document.getElementById('form-add-profissional');
    const btnCancelarProfissional = document.getElementById('btn-cancelar-profissional');
    const listaProfissionaisPainel = document.getElementById('lista-profissionais-painel');

    let empresaId = null;
    let unsubProfissionais = null;

    async function getEmpresaIdDoDono(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        try {
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                console.error(`BUSCA FALHOU: Nenhum documento em 'empresarios' encontrado com donoId = ${uid}`);
                return null;
            }
            return snapshot.docs[0].id;
        } catch (error) {
            console.error("Erro ao buscar empresa:", error);
            return null;
        }
    }

    function iniciarListenerDaEquipe() {
        if (!empresaId || !listaProfissionaisPainel) return;
        if (unsubProfissionais) unsubProfissionais();

        const profissionaisRef = collection(db, 'empresarios', empresaId, 'profissionais');
        unsubProfissionais = onSnapshot(profissionaisRef, 
            (snapshot) => {
                renderizarEquipe(snapshot.docs.map(doc => doc.data()));
            },
            (error) => {
                console.error("Erro ao escutar profissionais:", error);
                if (listaProfissionaisPainel) {
                    listaProfissionaisPainel.innerHTML = '<p style="color: red;">Erro ao carregar profissionais. Verifique sua conexão.</p>';
                }
            }
        );
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

    function adicionarListenersDeEvento() {
        if (btnAddProfissional) {
            btnAddProfissional.addEventListener('click', () => {
                if (!empresaId) {
                    alert("Não foi possível identificar a sua empresa. Por favor, recarregue a página ou verifique se o seu perfil foi salvo corretamente.");
                    return;
                }
                if (formAddProfissional) formAddProfissional.reset();
                if (modalAddProfissional) modalAddProfissional.style.display = 'flex';
            });
        }

        if (btnCancelarProfissional) {
            btnCancelarProfissional.addEventListener('click', () => {
                if (modalAddProfissional) modalAddProfissional.style.display = 'none';
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
                        console.error("Erro no upload da foto:", error);
                        alert("Erro ao enviar a imagem.");
                        btnSubmit.disabled = false;
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
                    if (modalAddProfissional) modalAddProfissional.style.display = 'none';
                } catch (error) {
                    console.error("Erro ao adicionar profissional:", error);
                    alert("Erro ao adicionar profissional.");
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Salvar Profissional";
                }
            });
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaId = await getEmpresaIdDoDono(user.uid);
            if (empresaId) {
                iniciarListenerDaEquipe();
                if (btnAddProfissional) btnAddProfissional.disabled = false;
                adicionarListenersDeEvento(); // Adiciona os listeners depois de ter o empresaId
            } else {
                if (listaProfissionaisPainel) listaProfissionaisPainel.innerHTML = `<p style="color: red;"><b>Ação Necessária:</b> Não foi possível encontrar a sua empresa. Por favor, vá à página "Meu Perfil" e clique em "Salvar Todas as Configurações" uma vez para garantir que o seu perfil de dono está corretamente registado.</p>`;
                if (btnAddProfissional) btnAddProfissional.disabled = true;
            }
        } else {
            window.location.href = 'login.html';
        }
    });
});
