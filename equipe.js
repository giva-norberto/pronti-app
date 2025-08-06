/**
 * equipe.js - Sistema de gerenciamento de equipe
 * Corrigido: placeholder de foto não usa emoji para evitar erros de carregamento em branco.
 * Também mantém a lógica para dono e funcionários.
 */

// Verificar se todos os elementos HTML existem
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

    let todosEncontrados = true;
    for (const elemento of Object.values(elementos)) {
        if (!elemento) {
            todosEncontrados = false;
            break;
        }
    }

    return { elementos, todosEncontrados };
}

// Verificar se o Firebase está disponível
function verificarFirebase() {
    try {
        import('./firebase-config.js').then(({ db, auth, storage }) => {
            if (db && auth && storage) {
                inicializarSistemaEquipe(db, auth, storage);
            } else {
                mostrarErroFirebase();
            }
        }).catch(() => {
            mostrarErroFirebase();
        });
    } catch {
        mostrarErroFirebase();
    }
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

    if (!todosEncontrados) {
        return;
    }

    let empresaId = null;
    let unsubProfissionais = null;

    const { 
        collection, 
        addDoc, 
        onSnapshot, 
        query, 
        where, 
        getDocs, 
        serverTimestamp, 
        updateDoc, 
        doc: docRef 
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const { 
        ref, 
        uploadBytes, 
        getDownloadURL 
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");

    const { 
        onAuthStateChanged 
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

    // Função: cria ou atualiza o dono com nome/foto do usuário (Google/Firebase Auth)
    async function getEmpresaIdDoDono(uid, user) {
        const empresariosRef = collection(db, "empresarios");
        const q = query(empresariosRef, where("donoId", "==", uid));

        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const empresaDoc = snapshot.docs[0];
                const empresaId = empresaDoc.id;
                const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
                const profissionaisSnap = await getDocs(profissionaisRef);
                const donoDoc = profissionaisSnap.docs.find(doc => doc.data().ehDono === true);

                const nomeDono = (user && user.displayName) ? user.displayName : "Dono";
                const fotoUrl = (user && user.photoURL) ? user.photoURL : "";

                if (!donoDoc) {
                    // Cadastra o dono se não existir
                    await addDoc(profissionaisRef, {
                        nome: nomeDono,
                        fotoUrl: fotoUrl,
                        ehDono: true,
                        horarios: {},
                        criadoEm: serverTimestamp()
                    });
                } else {
                    // Atualiza nome/foto se estiver diferente do Google/Firebase Auth
                    const data = donoDoc.data();
                    if (data.nome !== nomeDono || data.fotoUrl !== fotoUrl) {
                        const donoRef = docRef(db, "empresarios", empresaId, "profissionais", donoDoc.id);
                        await updateDoc(donoRef, {
                            nome: nomeDono,
                            fotoUrl: fotoUrl
                        });
                    }
                }
                return empresaId;
            }

            const novaEmpresa = {
                donoId: uid,
                nome: "Minha Empresa",
                criadaEm: serverTimestamp(),
            };

            const docSnapshot = await addDoc(empresariosRef, novaEmpresa);
            return docSnapshot.id;
        } catch {
            return null;
        }
    }

    function iniciarListenerDaEquipe() {
        try {
            const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
            const q = query(profissionaisRef);
            
            unsubProfissionais = onSnapshot(q, (snapshot) => {
                // Sempre mostra o dono em primeiro na lista
                let equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                equipe.sort((a, b) => (b.ehDono ? 1 : 0) - (a.ehDono ? 1 : 0));
                renderizarEquipe(equipe);
            }, () => {
                // Erro no listener, pode adicionar tratamento se quiser
            });
        } catch {
            // Erro ao iniciar listener
        }
    }

    function renderizarEquipe(equipe) {
        if (!elementos['lista-profissionais-painel']) return;
        
        elementos['lista-profissionais-painel'].innerHTML = "";
        
        if (equipe.length === 0) {
            elementos['lista-profissionais-painel'].innerHTML = 
                `<p>Nenhum profissional na equipe ainda. Clique em "Adicionar Profissional" para começar.</p>`;
            return;
        }
        
        equipe.forEach(profissional => {
            const div = document.createElement("div");
            div.className = "profissional-card";
            // Corrigido: placeholder de imagem padrão sem emoji
            div.innerHTML = `
                <div class="profissional-foto">
                    <img src="${profissional.fotoUrl || "https://via.placeholder.com/60x60?text=User"}" 
                         alt="Foto de ${profissional.nome}"
                         onerror="this.src='https://via.placeholder.com/60x60?text=User'">
                </div>
                <div class="profissional-info">
                    <span class="profissional-nome">${profissional.nome}</span>
                    <span class="profissional-status">${profissional.ehDono ? 'Dono' : 'Funcionário'}</span>
                </div>
            `;
            elementos['lista-profissionais-painel'].appendChild(div);
        });
    }

    function adicionarListenersDeEvento() {
        if (elementos['btn-add-profissional']) {
            elementos['btn-add-profissional'].addEventListener("click", () => {
                if (!empresaId) {
                    alert("Não foi possível identificar a sua empresa. Por favor, recarregue a página.");
                    return;
                }
                
                if (elementos['form-add-profissional']) {
                    elementos['form-add-profissional'].reset();
                }
                
                if (elementos['modal-add-profissional']) {
                    elementos['modal-add-profissional'].style.display = "flex";
                }
            });
        }

        if (elementos['btn-cancelar-profissional']) {
            elementos['btn-cancelar-profissional'].addEventListener("click", () => {
                if (elementos['modal-add-profissional']) {
                    elementos['modal-add-profissional'].style.display = "none";
                }
            });
        }

        if (elementos['form-add-profissional']) {
            elementos['form-add-profissional'].addEventListener("submit", async (e) => {
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

                // Novo profissional NÃO possui campo servicos, pois agora será uma subcoleção!
                const novoProfissional = {
                    nome,
                    fotoUrl: fotoURL,
                    ehDono: false,
                    horarios: {},
                    criadoEm: serverTimestamp()
                };

                try {
                    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
                    await addDoc(profissionaisRef, novoProfissional);
                    
                    if (elementos['modal-add-profissional']) {
                        elementos['modal-add-profissional'].style.display = "none";
                    }
                } catch (error) {
                    alert("Erro ao adicionar profissional: " + error.message);
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Salvar Profissional";
                }
            });
        }
    }

    // Chamada: passa o user do Auth para usar displayName/photoURL do dono
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaId = await getEmpresaIdDoDono(user.uid, user);
            
            if (empresaId) {
                iniciarListenerDaEquipe();
                
                if (elementos['btn-add-profissional']) {
                    elementos['btn-add-profissional'].disabled = false;
                }
                
                adicionarListenersDeEvento();
            } else {
                if (elementos['lista-profissionais-painel']) {
                    elementos['lista-profissionais-painel'].innerHTML = `
                        <div style="color: red; padding: 20px; border: 1px solid red; border-radius: 5px;">
                            <h4>❌ Empresa não encontrada</h4>
                            <p>Não foi possível encontrar a sua empresa.</p>
                            <p>Por favor, vá à página "Meu Perfil" e clique em "Salvar Todas as Configurações".</p>
                        </div>
                    `;
                }
                
                if (elementos['btn-add-profissional']) {
                    elementos['btn-add-profissional'].disabled = true;
                }
            }
        } else {
            window.location.href = "login.html";
        }
    });
}

// Inicializar quando o DOM estiver carregado
window.addEventListener("DOMContentLoaded", () => {
    verificarFirebase();
});
