/**
 * equipe.js - Sistema de gerenciamento de equipe
 */
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    getDocs,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    db,
    auth,
    storage
} from "./firebase-config.js";

// Verificar se o Firebase foi inicializado corretamente
if (!db || !auth || !storage) {
    console.error("❌ Firebase não foi inicializado corretamente!");
    alert("Erro de configuração do Firebase. Verifique o console para mais detalhes.");
}

window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Carregando sistema de equipe...");

    const btnAddProfissional = document.getElementById('btn-add-profissional');
    const modalAddProfissional = document.getElementById('modal-add-profissional');
    const formAddProfissional = document.getElementById('form-add-profissional');
    const btnCancelarProfissional = document.getElementById('btn-cancelar-profissional');
    const listaProfissionaisPainel = document.getElementById('lista-profissionais-painel');

    let empresaId = null;
    let unsubProfissionais = null;

    async function getEmpresaIdDoDono(uid) {
        console.log("🔍 Buscando empresa para o usuário:", uid);
        const empresariosRef = collection(db, "empresarios");
        const q = query(empresariosRef, where("donoId", "==", uid));

        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                console.log("✅ Empresa encontrada:", snapshot.docs[0].id);
                return snapshot.docs[0].id;
            }

            // Nenhuma empresa encontrada — criar uma nova
            console.warn("⚠️ Nenhuma empresa encontrada. Criando uma nova...");
            const novaEmpresa = {
                donoId: uid,
                nome: "Minha Empresa",
                criadaEm: serverTimestamp(),
            };

            const docRef = await addDoc(empresariosRef, novaEmpresa);
            console.log("✅ Nova empresa criada com ID:", docRef.id);
            return docRef.id;
        } catch (error) {
            console.error("❌ Erro ao buscar ou criar empresa:", error);
            return null;
        }
    }

    function iniciarListenerDaEquipe() {
        try {
            const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
            const q = query(profissionaisRef);
            unsubProfissionais = onSnapshot(q, (snapshot) => {
                const equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log("📥 Profissionais atualizados:", equipe);
                renderizarEquipe(equipe);
            });
        } catch (e) {
            console.error("❌ Erro ao iniciar listener da equipe:", e);
        }
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
                console.log("➕ Botão adicionar profissional clicado");
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
                console.log("❌ Cancelar adicionar profissional");
                if (modalAddProfissional) modalAddProfissional.style.display = 'none';
            });
        }

        if (formAddProfissional) {
            formAddProfissional.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log("💾 Salvando novo profissional...");
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
                        console.log("📸 Fazendo upload da foto...");
                        const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
                        await uploadBytes(storageRef, fotoFile);
                        fotoURL = await getDownloadURL(storageRef);
                        console.log("✅ Foto enviada com sucesso!");
                    } catch (error) {
                        console.error("❌ Erro no upload da foto:", error);
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
                    if (!empresaId) {
                        throw new Error("empresaId inválido. Não é possível adicionar profissional.");
                    }
                    const profissionaisRef = collection(db, 'empresarios', empresaId, 'profissionais');
                    await addDoc(profissionaisRef, novoProfissional);
                    console.log("✅ Profissional adicionado com sucesso!");
                    if (modalAddProfissional) modalAddProfissional.style.display = 'none';
                } catch (error) {
                    console.error("❌ Erro ao adicionar profissional:", error);
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
            console.log("👤 Usuário autenticado:", user.uid);
            empresaId = await getEmpresaIdDoDono(user.uid);
            if (empresaId) {
                iniciarListenerDaEquipe();
                if (btnAddProfissional) btnAddProfissional.disabled = false;
                adicionarListenersDeEvento();
            } else {
                if (listaProfissionaisPainel) {
                    listaProfissionaisPainel.innerHTML = `<p style="color: red;"><b>Ação Necessária:</b> Não foi possível encontrar a sua empresa. Por favor, vá à página "Meu Perfil" e clique em "Salvar Todas as Configurações" uma vez para garantir que o seu perfil de dono está corretamente registado.</p>`;
                }
                if (btnAddProfissional) btnAddProfissional.disabled = true;
            }
        } else {
            console.log("❌ Usuário não autenticado, redirecionando...");
            window.location.href = 'login.html';
        }
    });
});
