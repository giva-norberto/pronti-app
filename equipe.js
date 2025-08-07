/**
 * equipe.js - Sistema de gerenciamento de equipe
 * Utiliza o CSS geral do Pronti (classes como equipe-lista, equipe-btn-novo, profissional-card etc)
 * Modal de perfil do profissional, clique no card abre modal de perfil com abas
 */

function verificarElementosHTML() {
    const elementos = {
        'btn-add-profissional': document.getElementById('btn-add-profissional'),
        'modal-add-profissional': document.getElementById('modal-add-profissional'),
        'form-add-profissional': document.getElementById('form-add-profissional'),
        'btn-cancelar-profissional': document.getElementById('btn-cancelar-profissional'),
        'lista-profissionais-painel': document.getElementById('lista-profissionais-painel'),
        'nome-profissional': document.getElementById('nome-profissional'),
        'foto-profissional': document.getElementById('foto-profissional')
    };

    let todosEncontrados = Object.values(elementos).every(e => !!e);
    return { elementos, todosEncontrados };
}

function verificarFirebase() {
    import('./firebase-config.js').then(({ db, auth, storage }) => {
        if (db && auth && storage) {
            inicializarSistemaEquipe(db, auth, storage);
        } else {
            mostrarErroFirebase();
        }
    }).catch(mostrarErroFirebase);
}

function mostrarErroFirebase() {
    const painel = document.getElementById('lista-profissionais-painel');
    if (painel) {
        painel.innerHTML = `
            <div style="color: red; padding: 20px; border: 1px solid red; border-radius: 5px;">
                <h4>❌ Erro de Configuração do Firebase</h4>
                <p>O arquivo <code>firebase-config.js</code> não foi encontrado ou não está configurado corretamente.</p>
                <p>Por favor, verifique se:</p>
                <ul>
                    <li>O arquivo <code>firebase-config.js</code> existe</li>
                    <li>As credenciais do Firebase estão corretas</li>
                    <li>O projeto Firebase está ativo</li>
                </ul>
            </div>
        `;
    }
}

async function inicializarSistemaEquipe(db, auth, storage) {
    const { elementos, todosEncontrados } = verificarElementosHTML();
    if (!todosEncontrados) return;

    let empresaId = null;
    let todosServicos = [];

    const { 
        collection, addDoc, onSnapshot, query, where, getDocs, serverTimestamp, updateDoc, doc: docRef
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

    async function getEmpresaIdDoDono(uid, user) {
        const empresariosRef = collection(db, "empresarios");
        const q = query(empresariosRef, where("donoId", "==", uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const empresaDoc = snapshot.docs[0];
            const empresaId = empresaDoc.id;
            const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
            const profissionaisSnap = await getDocs(profissionaisRef);

            let donoDoc = profissionaisSnap.docs.find(doc => doc.data().ehDono === true);
            const nomeDono = (user && user.displayName) ? user.displayName : "Dono";
            const fotoUrl = (user && user.photoURL) ? user.photoURL : "";

            if (!donoDoc) {
                await addDoc(profissionaisRef, {
                    nome: nomeDono,
                    fotoUrl: fotoUrl,
                    ehDono: true,
                    horarios: {},
                    criadoEm: serverTimestamp()
                });
            } else {
                const data = donoDoc.data();
                if (data.nome !== nomeDono || data.fotoUrl !== fotoUrl) {
                    const donoRef = docRef(db, "empresarios", empresaId, "profissionais", donoDoc.id);
                    await updateDoc(donoRef, { nome: nomeDono, fotoUrl: fotoUrl });
                }
            }
            return empresaId;
        }
        return null;
    }

    async function carregarTodosServicosDaEmpresa(empresaId) {
        const servicosRef = collection(db, "empresarios", empresaId, "servicos");
        const snap = await getDocs(servicosRef);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.visivelNaVitrine !== false);
    }

    function iniciarListenerDaEquipe() {
        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const q = query(profissionaisRef);
        onSnapshot(q, (snapshot) => {
            let equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Remove duplicidade de nomes do dono
            const nomesDono = equipe.filter(p => p.ehDono).map(p => p.nome);
            equipe = equipe.filter((p, i, arr) =>
                p.ehDono ||
                !nomesDono.includes(p.nome) ||
                arr.findIndex(o => o.nome === p.nome && o.ehDono) === i
            );
            // Dono sempre por último (visual)
            equipe.sort((a, b) => (b.ehDono ? 1 : 0) - (a.ehDono ? 1 : 0));
            renderizarEquipe(equipe);
        });
    }

    function renderizarEquipe(equipe) {
        const painel = elementos['lista-profissionais-painel'];
        if (!painel) return;
        painel.innerHTML = "";
        if (equipe.length === 0) {
            painel.innerHTML = `
                <div class="empty-state">
                    <h3>Nenhum profissional na equipe ainda.</h3>
                    <p>Clique em "Adicionar Profissional" para começar.</p>
                </div>
            `;
            return;
        }
        equipe.forEach(profissional => {
            const div = document.createElement("div");
            div.className = "profissional-card";
            div.innerHTML = `
                <div class="profissional-foto">
                    <img src="${profissional.fotoUrl || "https://placehold.co/60x60?text=User"}"
                         alt="Foto de ${profissional.nome}"
                         onerror="this.onerror=null;this.src='https://placehold.co/60x60?text=User';">
                </div>
                <div class="profissional-info">
                    <span class="profissional-nome">${profissional.nome}</span>
                    <span class="profissional-status">${profissional.ehDono ? 'Dono' : 'Funcionário'}</span>
                </div>
                <button class="btn equipe-btn-novo btn-perfil-profissional" style="margin-left:auto;">
                    👤 Perfil
                </button>
            `;
            div.querySelector('.btn-perfil-profissional').onclick = () => {
                if (!window.abrirModalPerfilProfissional) {
                    alert("Não foi possível abrir o modal de perfil. Verifique se o arquivo modal-perfil-profissional.js está carregado.");
                    return;
                }
                if (!todosServicos || todosServicos.length === 0) {
                    alert("Nenhum serviço cadastrado para a empresa.");
                    return;
                }
                window.abrirModalPerfilProfissional(profissional, todosServicos, empresaId, (tipo, servicosAtualizados, profissionalAtual) => {
                    // Callback se quiser salvar dados
                });
            };
            painel.appendChild(div);
        });
    }

    function adicionarListenersDeEvento() {
        elementos['btn-add-profissional']?.addEventListener("click", () => {
            elementos['form-add-profissional']?.reset();
            elementos['modal-add-profissional']?.classList.add("show");
        });
        elementos['btn-cancelar-profissional']?.addEventListener("click", () => {
            elementos['modal-add-profissional']?.classList.remove("show");
        });
        elementos['form-add-profissional']?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btnSubmit = elementos['form-add-profissional'].querySelector('.btn-submit');
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Salvando...";
            const nome = elementos['nome-profissional'].value.trim();
            const fotoFile = elementos['foto-profissional'].files[0];
            if (!nome) {
                alert("O nome do profissional é obrigatório.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Salvar Profissional";
                return;
            }
            let fotoURL = "";
            if (fotoFile) {
                try {
                    const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
                    await uploadBytes(storageRef, fotoFile);
                    fotoURL = await getDownloadURL(storageRef);
                } catch (error) {
                    alert("Erro ao enviar a imagem: " + error.message);
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Salvar Profissional";
                    return;
                }
            }
            // Impede adicionar funcionário com mesmo nome do dono
            const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
            const profissionaisSnap = await getDocs(profissionaisRef);
            const jaEhDono = profissionaisSnap.docs.find(doc => {
                const data = doc.data();
                return data.ehDono && data.nome.trim().toLowerCase() === nome.toLowerCase();
            });
            if (jaEhDono) {
                alert("Já existe um dono com esse nome. Escolha um nome diferente para o funcionário.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Salvar Profissional";
                return;
            }
            const novoProfissional = {
                nome,
                fotoUrl: fotoURL,
                ehDono: false,
                horarios: {},
                criadoEm: serverTimestamp()
            };
            try {
                await addDoc(profissionaisRef, novoProfissional);
                elementos['modal-add-profissional']?.classList.remove("show");
            } catch (error) {
                alert("Erro ao adicionar profissional: " + error.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Salvar Profissional";
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaId = await getEmpresaIdDoDono(user.uid, user);
            if (empresaId) {
                todosServicos = await carregarTodosServicosDaEmpresa(empresaId);
                iniciarListenerDaEquipe();
                elementos['btn-add-profissional'].disabled = false;
                adicionarListenersDeEvento();
            } else {
                elementos['lista-profissionais-painel'].innerHTML = `
                    <div style="color: red; padding: 20px; border: 1px solid red; border-radius: 5px;">
                        <h4>❌ Empresa não encontrada</h4>
                        <p>Não foi possível encontrar a sua empresa.</p>
                        <p>Por favor, vá à página "Meu Perfil" e clique em "Salvar Todas as Configurações".</p>
                    </div>
                `;
                elementos['btn-add-profissional'].disabled = true;
            }
        } else {
            window.location.href = "login.html";
        }
    });
}

window.addEventListener("DOMContentLoaded", verificarFirebase);
