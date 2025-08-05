/**
 * equipe.js - Sistema de gerenciamento de equipe (sem debug)
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
        serverTimestamp 
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const { 
        ref, 
        uploadBytes, 
        getDownloadURL 
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");

    const { 
        onAuthStateChanged 
    } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

    async function getEmpresaIdDoDono(uid) {
        const empresariosRef = collection(db, "empresarios");
        const q = query(empresariosRef, where("donoId", "==", uid));

        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return snapshot.docs[0].id;
            }

            const novaEmpresa = {
                donoId: uid,
                nome: "Minha Empresa",
                criadaEm: serverTimestamp(),
            };

            const docRef = await addDoc(empresariosRef, novaEmpresa);
            return docRef.id;
        } catch {
            return null;
        }
    }

    function iniciarListenerDaEquipe() {
        try {
            const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
            const q = query(profissionaisRef);
            
            unsubProfissionais = onSnapshot(q, (snapshot) => {
                const equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            div.innerHTML = `
                <div class="profissional-foto">
                    <img src="${profissional.fotoUrl || "https://via.placeholder.com/60x60?text=👤"}" 
                         alt="Foto de ${profissional.nome}"
                         onerror="this.src='https://via.placeholder.com/60x60?text=👤'">
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

                const novoProfissional = {
                    nome,
                    fotoUrl: fotoURL,
                    ehDono: false,
                    servicos: [],
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

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaId = await getEmpresaIdDoDono(user.uid);
            
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
