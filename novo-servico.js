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
let userUid = null;

// Obtém o empresaId da empresa ativa do localStorage.
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

// Busca a empresa do usuário logado como dono.
async function getEmpresaDoUsuario(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return null;
}

// Extrai o id do serviço da URL (se em edição)
function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Preenche o formulário com dados do serviço
function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco !== undefined ? servico.preco : '';
    document.getElementById('duracao-servico').value = servico.duracao !== undefined ? servico.duracao : '';
}

// Checa se usuário é dono da empresa
function usuarioEDono(empresa, uid) {
    return empresa && empresa.donoId === uid;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    userUid = user.uid;
    empresaId = getEmpresaIdAtiva();
    const empresa = await getEmpresaDoUsuario(user.uid);

    if (!empresaId) {
        alert("Atenção: Nenhuma empresa ativa selecionada. Complete seu cadastro ou selecione uma empresa.");
        if(form) form.querySelector('button[type=\"submit\"]').disabled = true;
        if (btnExcluir) btnExcluir.style.display = 'none';
        return;
    }

    isDono = empresa && usuarioEDono(empresa, user.uid);

    servicoId = getIdFromUrl();
    if (servicoId) {
        const tituloForm = document.querySelector('.form-card h1');
        if (tituloForm) tituloForm.textContent = 'Editar Serviço';
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            servicoEditando = { id: servicoSnap.id, ...servicoSnap.data() };
            preencherFormulario(servicoEditando);
        }
    }

    if (!isDono && !servicoId) {
        alert("Acesso Negado: Apenas o dono da empresa pode criar novos serviços.");
        if(form) form.querySelector('button[type=\"submit\"]').disabled = true;
    }

    if (btnExcluir) {
        if (servicoEditando && isDono) {
            btnExcluir.style.display = 'block';
        } else {
            btnExcluir.style.display = 'none';
        }
    }
});

// ======================================================================
//          CORREÇÃO: ouvintes de evento fora do onAuthStateChanged
// ======================================================================
if (form) form.addEventListener('submit', handleFormSubmit);
if (btnExcluir) btnExcluir.addEventListener('click', handleServicoExcluir);
// ======================================================================

async function handleFormSubmit(e) {
    e.preventDefault();

    // Diagnóstico: log empresaId e userUid
    // console.log("empresaId", empresaId, "userUid", userUid);

    if (!empresaId) {
        alert("Erro: Empresa não identificada. Tente recarregar a página.");
        return;
    }
    
    if (!isDono && !servicoEditando) {
        alert("Acesso Negado: Apenas o dono pode criar um novo serviço.");
        return;
    }

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        alert("Atenção: Preencha todos os campos obrigatórios corretamente.");
        return;
    }

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        if (servicoEditando) {
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, { nome, descricao, preco, duracao });
        } else {
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, { 
                nome, 
                descricao, 
                preco, 
                duracao, 
                visivelNaVitrine: true 
            });
        }

        alert(servicoEditando ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!");
        window.location.href = 'servicos.html';
    } catch (err) {
        alert(`Ocorreu um erro ao salvar o serviço: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoEditando) return;
    
    const confirmado = confirm("Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        alert("Serviço excluído com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        alert(`Ocorreu um erro ao excluir o serviço: ${err.message}`);
    }
}
