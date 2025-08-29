import { 
    doc, getDoc, setDoc, updateDoc, deleteDoc, 
    collection, query, where, getDocs, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// ATUALIZADO: Usando a configuração centralizada
import { db, auth } from "./firebase-config.js"; 
// ATUALIZADO: Usando as funções de UI do ficheiro correto
import { mostrarAlerta, mostrarConfirmacao } from "./vitrini-ui.js"; 

const form = document.getElementById('form-servico');
// O botão de excluir é procurado no HTML, se existir
const btnExcluir = document.getElementById('btn-excluir-servico'); 
let empresaId = null;
let servicoId = null;
let servicoEditando = null;
let isDono = false;

// Obtém o empresaId da empresa ativa do localStorage.
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

// Busca a empresa do usuário logado como dono OU na qual ele é profissional.
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
    
    empresaId = getEmpresaIdAtiva();
    const empresa = await getEmpresaDoUsuario(user.uid);

    if (!empresaId) {
        await mostrarAlerta("Atenção", "Nenhuma empresa ativa selecionada. Complete seu cadastro ou selecione uma empresa.");
        form.querySelector('button[type="submit"]').disabled = true;
        if (btnExcluir) btnExcluir.style.display = 'none';
        return;
    }

    isDono = empresa && usuarioEDono(empresa, user.uid);

    servicoId = getIdFromUrl();
    if (servicoId) {
        document.querySelector('.form-card h1').textContent = 'Editar Serviço';
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        const servicoSnap = await getDoc(servicoRef);
        if (servicoSnap.exists()) {
            servicoEditando = { id: servicoSnap.id, ...servicoSnap.data() };
            preencherFormulario(servicoEditando);
        }
    }

    // Só dono pode criar novo serviço
    if (!isDono && !servicoId) {
        await mostrarAlerta("Acesso Negado", "Apenas o dono da empresa pode criar novos serviços.");
        form.querySelector('button[type="submit"]').disabled = true;
    }

    // Botão de exclusão só aparece se está editando E usuário é dono
    if (btnExcluir) {
        if (servicoEditando && isDono) {
            btnExcluir.style.display = 'block'; // Mostra o botão
            btnExcluir.addEventListener('click', handleServicoExcluir);
        } else {
            btnExcluir.style.display = 'none';
        }
    }

    form.addEventListener('submit', handleFormSubmit);
});

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!empresaId) {
        await mostrarAlerta("Erro", "Empresa não identificada. Tente recarregar a página.");
        return;
    }
    
    if (!isDono && !servicoEditando) {
        await mostrarAlerta("Acesso Negado", "Apenas o dono pode criar um novo serviço.");
        return;
    }

    const nome = document.getElementById('nome-servico').value.trim();
    const descricao = document.getElementById('descricao-servico').value.trim();
    const preco = parseFloat(document.getElementById('preco-servico').value);
    const duracao = parseInt(document.getElementById('duracao-servico').value, 10);

    if (!nome || isNaN(preco) || isNaN(duracao) || preco < 0 || duracao <= 0) {
        await mostrarAlerta("Dados Inválidos", "Preencha todos os campos obrigatórios corretamente.");
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

        await mostrarAlerta("Sucesso!", servicoEditando ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!");
        window.location.href = 'servicos.html';
    } catch (err) {
        await mostrarAlerta("Erro", `Ocorreu um erro ao salvar o serviço: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if (!isDono || !servicoEditando) return;
    
    const confirmado = await mostrarConfirmacao("Excluir Serviço", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        await mostrarAlerta("Serviço Excluído", "O serviço foi removido com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        await mostrarAlerta("Erro", `Ocorreu um erro ao excluir o serviço: ${err.message}`);
    }
}
