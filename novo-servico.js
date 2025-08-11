import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { showAlert } from "./vitrini-utils.js";

const form = document.getElementById('form-servico');
const btnExcluir = document.getElementById('btn-excluir-servico');
let empresaId = null;
let servicoId = null;
let servicoEditando = null;
let isDono = false;
let userUid = null;

/**
 * Busca a empresa do usuário logado como dono OU na qual ele é profissional.
 */
async function getEmpresaDoUsuario(uid) {
    // Dono
    let q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    let snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    // Profissional
    q = query(collection(db, "empresarios"), where("profissionaisUids", "array-contains", uid));
    snapshot = await getDocs(q);
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    return null;
}

/**
 * Extrai o id do serviço da URL (se em edição)
 */
function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Preenche o formulário com dados do serviço
 */
function preencherFormulario(servico) {
    document.getElementById('nome-servico').value = servico.nome || '';
    document.getElementById('descricao-servico').value = servico.descricao || '';
    document.getElementById('preco-servico').value = servico.preco || '';
    document.getElementById('duracao-servico').value = servico.duracao || '';
}

/**
 * Checa se usuário é dono da empresa
 */
function usuarioEDono(empresa, uid) {
    return empresa.donoId === uid;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    userUid = user.uid;
    const empresa = await getEmpresaDoUsuario(user.uid);
    if (!empresa) {
        await showAlert("Atenção", "Empresa não encontrada. Complete seu cadastro.");
        form.querySelector('button[type="submit"]').disabled = true;
        if (btnExcluir) btnExcluir.style.display = 'none';
        return;
    }
    empresaId = empresa.id;
    isDono = usuarioEDono(empresa, user.uid);

    servicoId = getIdFromUrl();
    if (servicoId) {
        // Busca serviço na coleção global
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            servicoEditando = { id: servicoSnap.id, ...servicoSnap.data() };
            preencherFormulario(servicoEditando);
        }
    }

    // Só dono pode criar novo serviço
    if (!isDono && !servicoId) {
        await showAlert("Atenção", "Apenas o dono pode criar um novo serviço.");
        form.querySelector('button[type="submit"]').disabled = true;
    }

    // Botão de exclusão só aparece se está editando E usuário é dono
    if (btnExcluir) {
        if (servicoEditando && isDono) {
            btnExcluir.style.display = '';
            btnExcluir.addEventListener('click', handleServicoExcluir);
        } else {
            btnExcluir.style.display = 'none';
        }
    }

    form.addEventListener('submit', handleFormSubmit);
});

async function handleFormSubmit(e) {
    e.preventDefault();
    // Só permite criar se for dono
    if (!isDono && !servicoEditando) return;

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        await showAlert("Atenção", "Preencha todos os campos obrigatórios corretamente.");
        return;
    }

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        if (servicoEditando) {
            // Atualiza serviço global (dono ou profissional)
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, { nome, descricao, preco, duracao });
        } else {
            // Cria novo serviço global (apenas dono) — CORREÇÃO AQUI:
            const servicosCol = collection(db, "empresarios", empresaId, "servicos");
            await addDoc(servicosCol, { nome, descricao, preco, duracao, visivelNaVitrine: true });
        }

        await showAlert("Sucesso!", servicoEditando ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao salvar serviço:", err);
        await showAlert("Erro", "Ocorreu um erro ao salvar o serviço.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoEditando) return;
    if (!confirm("Tem certeza que deseja excluir este serviço? Esta ação é permanente.")) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        await showAlert("Serviço excluído", "O serviço foi removido com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao excluir serviço:", err);
        await showAlert("Erro", "Ocorreu um erro ao excluir o serviço.");
    }
}
