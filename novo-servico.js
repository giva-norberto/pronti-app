import { 
    doc, getDoc, updateDoc, deleteDoc, 
    collection, query, where, getDocs, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db, auth } from "./firebase-config.js"; 

const form = document.getElementById('form-servico');
const btnExcluir = document.getElementById('btn-excluir-servico'); 
let empresaId = null;
let servicoId = null;
let servicoEditando = null;
let isDono = false;
let isAdmin = false;
let userUid = null;

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // Igual às suas regras

// ====== MODAL PRONTI PARA CONFIRMAÇÃO E ALERTA ======
function prontiAlert(msg, callback) {
    showProntiModal(msg, [{ text: "OK", className: "pronti-btn pronti-btn-ok", onClick: callback }]);
}

function prontiConfirm(msg, onOk, onCancel) {
    showProntiModal(msg, [
        { text: "Cancelar", className: "pronti-btn pronti-btn-cancel", onClick: onCancel },
        { text: "Confirmar", className: "pronti-btn pronti-btn-ok", onClick: onOk }
    ]);
}

function showProntiModal(msg, actions) {
    let modal = document.getElementById('pronti-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pronti-modal';
        modal.className = 'pronti-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
          <div class="pronti-modal-content">
            <span id="pronti-modal-close" class="pronti-modal-close">&times;</span>
            <div id="pronti-modal-message"></div>
            <div id="pronti-modal-actions"></div>
          </div>
        `;
        document.body.appendChild(modal);
        const style = document.createElement('style');
        style.textContent = `
.pronti-modal { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(44,54,80,0.25); display:flex; align-items:center; justify-content:center; z-index:9999; }
.pronti-modal-content { background:#fff; border-radius:10px; padding:32px; text-align:center; max-width:350px; box-shadow:0 6px 24px #0002; position:relative; }
.pronti-modal-close { position:absolute; right:16px; top:12px; font-size:22px; cursor:pointer; color:#666;}
.pronti-modal-actions { margin-top:28px; display:flex; gap:16px; justify-content:center; }
.pronti-btn { border:none; border-radius:6px; padding:9px 22px; font-weight:bold; cursor:pointer; font-size:16px;}
.pronti-btn-ok { background:#4f46e5; color:#fff; }
.pronti-btn-cancel { background:#e53e3e; color:#fff; }
        `;
        document.head.appendChild(style);
    }
    const msgDiv = modal.querySelector('#pronti-modal-message');
    const actionsDiv = modal.querySelector('#pronti-modal-actions');
    msgDiv.innerHTML = msg;
    actionsDiv.innerHTML = '';
    actions.forEach(act => {
        const btn = document.createElement('button');
        btn.textContent = act.text;
        btn.className = act.className;
        btn.onclick = () => {
            modal.style.display = 'none';
            setTimeout(() => { if (act.onClick) act.onClick(); }, 100);
        };
        actionsDiv.appendChild(btn);
    });
    modal.style.display = 'flex';
    modal.querySelector('#pronti-modal-close').onclick = () => { modal.style.display = 'none'; };
}
// =====================================================

function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

function limparEmpresaAtiva() {
    localStorage.removeItem("empresaAtivaId");
}

async function buscaEmpresasDoUsuario(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco !== undefined ? servico.preco : '';
    document.getElementById('duracao-servico').value = servico.duracao !== undefined ? servico.duracao : '';
    // Adiciona categoria se existir (opcional)
    if (document.getElementById('categoria-servico')) {
        document.getElementById('categoria-servico').value = servico.categoria || '';
    }
}

function usuarioEDono(empresa, uid) {
    return empresa && empresa.donoId === uid;
}

function redirecionaSeSemEmpresa() {
    prontiAlert("Atenção: Nenhuma empresa ativa selecionada. Complete seu cadastro ou selecione uma empresa.", () => {
        if(form) form.querySelector('button[type="submit"]').disabled = true;
        if(btnExcluir) btnExcluir.style.display = 'none';
        window.location.href = 'selecionar-empresa.html';
    });
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    userUid = user.uid;
    isAdmin = userUid === ADMIN_UID;

    empresaId = getEmpresaIdAtiva();

    if (!empresaId) {
        const empresas = await buscaEmpresasDoUsuario(userUid);
        if (empresas.length === 0) {
            prontiAlert("Você ainda não possui nenhuma empresa cadastrada. Cadastre uma empresa para continuar.", () => {
                window.location.href = 'cadastro-empresa.html';
            });
            return;
        }
        if (empresas.length === 1) {
            localStorage.setItem("empresaAtivaId", empresas[0].id);
            empresaId = empresas[0].id;
        } else {
            redirecionaSeSemEmpresa();
            return;
        }
    }

    let empresa = null;
    const empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
    if (empresaSnap.exists()) {
        empresa = { id: empresaSnap.id, ...empresaSnap.data() };
        // Para debug/log mobile
        // console.log("Usuário autenticado:", userUid, "Empresa ativa:", empresaId, "É admin:", isAdmin);
        // console.log("Dono da empresa ativa (donoId):", empresa.donoId);
    } else {
        console.warn("Empresa ativa não encontrada no Firestore!");
        prontiAlert("Erro: empresa ativa não encontrada! Refaça o cadastro da empresa ou selecione uma empresa existente.", () => {
            limparEmpresaAtiva();
            window.location.href = 'selecionar-empresa.html';
        });
        return;
    }

    isDono = usuarioEDono(empresa, userUid);

    servicoId = getIdFromUrl();
    if (servicoId) {
        const tituloForm = document.querySelector('.form-card h1');
        if (tituloForm) tituloForm.textContent = 'Editar Serviço';
        if (empresaId && servicoId) {
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            const servicoSnap = await getDoc(servicoRef);
            if (servicoSnap.exists()) {
                servicoEditando = { id: servicoSnap.id, ...servicoSnap.data() };
                preencherFormulario(servicoEditando);
            } else {
                prontiAlert("Serviço não encontrado!");
            }
        }
    }

    if (!isDono && !isAdmin && !servicoId) {
        prontiAlert("Acesso Negado: Apenas o dono da empresa ou o admin podem criar novos serviços.", () => {
            if(form) form.querySelector('button[type="submit"]').disabled = true;
        });
    }

    if (btnExcluir) {
        if (servicoEditando && (isDono || isAdmin)) {
            btnExcluir.style.display = 'block';
        } else {
            btnExcluir.style.display = 'none';
        }
    }
});

if (form) form.addEventListener('submit', handleFormSubmit);
if (btnExcluir) btnExcluir.addEventListener('click', handleServicoExcluir);

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!empresaId) {
        redirecionaSeSemEmpresa();
        return;
    }
    
    if (!isDono && !isAdmin && !servicoEditando) {
        prontiAlert("Acesso Negado: Apenas o dono ou admin podem criar um novo serviço.");
        return;
    }

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);
    // Categoria é opcional
    const categoriaInput = document.getElementById('categoria-servico');
    const categoria = categoriaInput ? categoriaInput.value.trim() : undefined;

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        prontiAlert("Atenção: Preencha todos os campos obrigatórios corretamente.");
        return;
    }

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        if (servicoEditando) {
            if (!empresaId || !servicoId) throw new Error("Dados de identificação do serviço incompletos.");
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            // Só envia o campo categoria se foi preenchido
            let updateData = { nome, descricao, preco, duracao };
            if (categoria !== undefined) updateData.categoria = categoria;
            await updateDoc(servicoRef, updateData);
        } else {
            if (!empresaId) throw new Error("Empresa ativa não definida.");
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            let newData = { 
                nome, 
                descricao, 
                preco, 
                duracao, 
                visivelNaVitrine: true 
            };
            if (categoria) newData.categoria = categoria;
            await addDoc(servicosCol, newData);
        }

        prontiAlert(servicoEditando ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!", () => {
            window.location.href = 'servicos.html';
        });
    } catch (err) {
        console.error("Erro ao salvar serviço:", err);
        prontiAlert(`Ocorreu um erro ao salvar o serviço: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if ((!isDono && !isAdmin) || !servicoEditando) return;
    
    prontiConfirm(
        "Tem certeza que deseja excluir este serviço? Esta ação é permanente.",
        async () => {
            try {
                if (!empresaId || !servicoId) throw new Error("Dados de identificação do serviço incompletos.");
                const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
                await deleteDoc(servicoRef);
                prontiAlert("Serviço excluído com sucesso.", () => {
                    window.location.href = 'servicos.html';
                });
            } catch (err) {
                console.error("Erro ao excluir serviço:", err);
                prontiAlert(`Ocorreu um erro ao excluir o serviço: ${err.message}`);
            }
        },
        () => { /* Cancelado */ }
    );
}
