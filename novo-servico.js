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

// Obtém o empresaId da empresa ativa do localStorage.
function getEmpresaIdAtiva() {
    return localStorage.getItem("empresaAtivaId") || null;
}

// Limpa empresa ativa do localStorage
function limparEmpresaAtiva() {
    localStorage.removeItem("empresaAtivaId");
}

// Busca todas as empresas do usuário logado como dono
async function buscaEmpresasDoUsuario(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
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

// Redireciona para selecionar/cadastrar empresa
function redirecionaSeSemEmpresa() {
    alert("Atenção: Nenhuma empresa ativa selecionada. Complete seu cadastro ou selecione uma empresa.");
    if(form) form.querySelector('button[type="submit"]').disabled = true;
    if(btnExcluir) btnExcluir.style.display = 'none';
    window.location.href = 'selecionar-empresa.html';
}

// Fluxo principal ao autenticar
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    userUid = user.uid;
    isAdmin = userUid === ADMIN_UID;

    empresaId = getEmpresaIdAtiva();

    // Se não há empresa ativa, busca empresas do usuário (auto-seleção se só uma)
    if (!empresaId) {
        const empresas = await buscaEmpresasDoUsuario(userUid);
        if (empresas.length === 0) {
            alert("Você ainda não possui nenhuma empresa cadastrada. Cadastre uma empresa para continuar.");
            window.location.href = 'cadastro-empresa.html';
            return;
        }
        if (empresas.length === 1) {
            // Só uma empresa, seleciona automaticamente
            localStorage.setItem("empresaAtivaId", empresas[0].id);
            empresaId = empresas[0].id;
        } else {
            // Mais de uma empresa: vai para seleção
            redirecionaSeSemEmpresa();
            return;
        }
    }

    // Busca o documento da empresa ativa
    let empresa = null;
    const empresaSnap = await getDoc(doc(db, "empresarios", empresaId));
    if (empresaSnap.exists()) {
        empresa = { id: empresaSnap.id, ...empresaSnap.data() };
        console.log("Usuário autenticado:", userUid, "Empresa ativa:", empresaId, "É admin:", isAdmin);
        console.log("Dono da empresa ativa (donoId):", empresa.donoId);
    } else {
        console.warn("Empresa ativa não encontrada no Firestore!");
        alert("Erro: empresa ativa não encontrada! Refaça o cadastro da empresa ou selecione uma empresa existente.");
        limparEmpresaAtiva();
        window.location.href = 'selecionar-empresa.html';
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
                alert("Serviço não encontrado!");
            }
        }
    }

    // Só permite criar se for dono OU admin
    if (!isDono && !isAdmin && !servicoId) {
        alert("Acesso Negado: Apenas o dono da empresa ou o admin podem criar novos serviços.");
        if(form) form.querySelector('button[type="submit"]').disabled = true;
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

    console.log("SUBMIT - empresaId:", empresaId, "UID:", userUid, "isDono:", isDono, "isAdmin:", isAdmin);

    if (!empresaId) {
        redirecionaSeSemEmpresa();
        return;
    }
    
    if (!isDono && !isAdmin && !servicoEditando) {
        alert("Acesso Negado: Apenas o dono ou admin podem criar um novo serviço.");
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
            if (!empresaId || !servicoId) throw new Error("Dados de identificação do serviço incompletos.");
            const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
            await updateDoc(servicoRef, { nome, descricao, preco, duracao });
        } else {
            if (!empresaId) throw new Error("Empresa ativa não definida.");
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
        console.error("Erro ao salvar serviço:", err);
        alert(`Ocorreu um erro ao salvar o serviço: ${err.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Serviço";
    }
}

async function handleServicoExcluir(e) {
    e.preventDefault();
    if ((!isDono && !isAdmin) || !servicoEditando) return;
    
    const confirmado = confirm("Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        if (!empresaId || !servicoId) throw new Error("Dados de identificação do serviço incompletos.");
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoId);
        await deleteDoc(servicoRef);
        alert("Serviço excluído com sucesso.");
        window.location.href = 'servicos.html';
    } catch (err) {
        console.error("Erro ao excluir serviço:", err);
        alert(`Ocorreu um erro ao excluir o serviço: ${err.message}`);
    }
}
