/**
 * equipe-melhorado.js - Sistema de gerenciamento de equipe com debug melhorado
 */

// Função para debug detalhado
function debugLog(message, data = null) {
    console.log(`[EQUIPE DEBUG] ${message}`, data || '');
}

// Verificar se todos os elementos HTML existem
function verificarElementosHTML() {
    debugLog("🔍 Verificando elementos HTML...");
    
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
    for (const [id, elemento] of Object.entries(elementos)) {
        if (elemento) {
            debugLog(`✅ Elemento encontrado: ${id}`);
        } else {
            debugLog(`❌ Elemento NÃO encontrado: ${id}`);
            todosEncontrados = false;
        }
    }

    return { elementos, todosEncontrados };
}

// Verificar se o Firebase está disponível
function verificarFirebase() {
    debugLog("🔥 Verificando Firebase...");
    
    try {
        // Tentar importar dinamicamente
        import('./firebase-config.js').then(({ db, auth, storage }) => {
            if (db && auth && storage) {
                debugLog("✅ Firebase configurado corretamente");
                inicializarSistemaEquipe(db, auth, storage);
            } else {
                debugLog("❌ Firebase não configurado corretamente");
                mostrarErroFirebase();
            }
        }).catch(error => {
            debugLog("❌ Erro ao importar firebase-config.js:", error);
            mostrarErroFirebase();
        });
    } catch (error) {
        debugLog("❌ Erro geral do Firebase:", error);
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
    debugLog("🚀 Inicializando sistema de equipe...");
    
    const { elementos, todosEncontrados } = verificarElementosHTML();
    
    if (!todosEncontrados) {
        debugLog("❌ Nem todos os elementos HTML foram encontrados. Abortando inicialização.");
        return;
    }

    let empresaId = null;
    let unsubProfissionais = null;

    // Importar funções do Firestore dinamicamente
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
        debugLog("🔍 Buscando empresa para o usuário:", uid);
        const empresariosRef = collection(db, "empresarios");
        const q = query(empresariosRef, where("donoId", "==", uid));

        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                debugLog("✅ Empresa encontrada:", snapshot.docs[0].id);
                return snapshot.docs[0].id;
            }

            debugLog("⚠️ Nenhuma empresa encontrada. Criando uma nova...");
            const novaEmpresa = {
                donoId: uid,
                nome: "Minha Empresa",
                criadaEm: serverTimestamp(),
            };

            const docRef = await addDoc(empresariosRef, novaEmpresa);
            debugLog("✅ Nova empresa criada com ID:", docRef.id);
            return docRef.id;
        } catch (error) {
            debugLog("❌ Erro ao buscar ou criar empresa:", error);
            return null;
        }
    }

    function iniciarListenerDaEquipe() {
        try {
            debugLog("📡 Iniciando listener da equipe para empresa:", empresaId);
            const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
            const q = query(profissionaisRef);
            
            unsubProfissionais = onSnapshot(q, (snapshot) => {
                const equipe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                debugLog("📥 Profissionais atualizados:", equipe);
                renderizarEquipe(equipe);
            }, (error) => {
                debugLog("❌ Erro no listener da equipe:", error);
            });
        } catch (e) {
            debugLog("❌ Erro ao iniciar listener da equipe:", e);
        }
    }

    function renderizarEquipe(equipe) {
        debugLog("🎨 Renderizando equipe:", equipe);
        
        if (!elementos['lista-profissionais-painel']) {
            debugLog("❌ Painel de profissionais não encontrado");
            return;
        }
        
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
        
        debugLog("✅ Equipe renderizada com sucesso");
    }

    function adicionarListenersDeEvento() {
        debugLog("🎯 Adicionando listeners de evento...");
        
        // Botão adicionar profissional
        if (elementos['btn-add-profissional']) {
            elementos['btn-add-profissional'].addEventListener("click", () => {
                debugLog("➕ Botão adicionar profissional clicado");
                
                if (!empresaId) {
                    debugLog("❌ empresaId não definido");
                    alert("Não foi possível identificar a sua empresa. Por favor, recarregue a página.");
                    return;
                }
                
                if (elementos['form-add-profissional']) {
                    elementos['form-add-profissional'].reset();
                }
                
                if (elementos['modal-add-profissional']) {
                    elementos['modal-add-profissional'].style.display = "flex";
                    debugLog("✅ Modal exibido");
                } else {
                    debugLog("❌ Modal não encontrado");
                }
            });
            debugLog("✅ Listener do botão adicionar configurado");
        }

        // Botão cancelar
        if (elementos['btn-cancelar-profissional']) {
            elementos['btn-cancelar-profissional'].addEventListener("click", () => {
                debugLog("❌ Cancelar adicionar profissional");
                if (elementos['modal-add-profissional']) {
                    elementos['modal-add-profissional'].style.display = "none";
                }
            });
            debugLog("✅ Listener do botão cancelar configurado");
        }

        // Formulário
        if (elementos['form-add-profissional']) {
            elementos['form-add-profissional'].addEventListener("submit", async (e) => {
                e.preventDefault();
                debugLog("💾 Salvando novo profissional...");
                
                const btnSubmit = e.target.querySelector("button[type='submit']");
                btnSubmit.disabled = true;
                btnSubmit.textContent = "Salvando...";

                const nome = elementos['nome-profissional'].value.trim();
                const fotoFile = elementos['foto-profissional'].files[0];
                
                debugLog("📝 Dados do formulário:", { nome, temFoto: !!fotoFile });
                
                if (!nome) {
                    alert("O nome do profissional é obrigatório.");
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Salvar Profissional";
                    return;
                }

                let fotoURL = "";
                if (fotoFile) {
                    try {
                        debugLog("📸 Fazendo upload da foto...");
                        const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
                        await uploadBytes(storageRef, fotoFile);
                        fotoURL = await getDownloadURL(storageRef);
                        debugLog("✅ Foto enviada com sucesso:", fotoURL);
                    } catch (error) {
                        debugLog("❌ Erro no upload da foto:", error);
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

                debugLog("💾 Salvando profissional:", novoProfissional);

                try {
                    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
                    await addDoc(profissionaisRef, novoProfissional);
                    debugLog("✅ Profissional adicionado com sucesso!");
                    
                    if (elementos['modal-add-profissional']) {
                        elementos['modal-add-profissional'].style.display = "none";
                    }
                } catch (error) {
                    debugLog("❌ Erro ao adicionar profissional:", error);
                    alert("Erro ao adicionar profissional: " + error.message);
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Salvar Profissional";
                }
            });
            debugLog("✅ Listener do formulário configurado");
        }
    }

    // Monitorar autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            debugLog("👤 Usuário autenticado:", user.uid);
            empresaId = await getEmpresaIdDoDono(user.uid);
            
            if (empresaId) {
                debugLog("🏢 Empresa identificada:", empresaId);
                iniciarListenerDaEquipe();
                
                if (elementos['btn-add-profissional']) {
                    elementos['btn-add-profissional'].disabled = false;
                }
                
                adicionarListenersDeEvento();
            } else {
                debugLog("❌ Não foi possível identificar a empresa");
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
            debugLog("❌ Usuário não autenticado, redirecionando...");
            window.location.href = "login.html";
        }
    });
}

// Inicializar quando o DOM estiver carregado
window.addEventListener("DOMContentLoaded", () => {
    debugLog("🌟 DOM carregado, iniciando verificações...");
    verificarFirebase();
});
