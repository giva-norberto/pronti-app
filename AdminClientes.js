import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
const conteudoDiv = document.getElementById('conteudo-admin');

let currentData = [];
let abaAtual = "empresas";
let planosCache = [];

// =====================================================
// RENDER BASE
// =====================================================
function render(html) {
    if (conteudoDiv) {
        conteudoDiv.innerHTML = html;
    }
}

// =====================================================
// AÇÕES EXISTENTES (SEM ALTERAÇÃO)
// =====================================================

async function toggleBloqueio(empresaId, novoStatus, button) {
    const acao = novoStatus ? 'bloquear' : 'desbloquear';
    if (!confirm(`Tem certeza que deseja ${acao} esta empresa?`)) return;

    const originalText = button.textContent;
    button.textContent = 'Aguarde...';
    button.disabled = true;

    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        await updateDoc(empresaRef, { bloqueado: novoStatus });

        const profCollectionRef = collection(db, "empresarios", empresaId, "profissionais");
        const profSnap = await getDocs(profCollectionRef);
        const updates = profSnap.docs.map(p => updateDoc(p.ref, { bloqueado: novoStatus }));
        await Promise.all(updates);

        carregarDados();
    } catch (error) {
        alert("Erro ao atualizar status.");
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function excluirEmpresa(empresaId, button) {
    if (!confirm("Deseja excluir esta empresa?")) return;

    button.textContent = 'Excluindo...';
    button.disabled = true;

    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const profCollectionRef = collection(db, "empresarios", empresaId, "profissionais");
        const profSnap = await getDocs(profCollectionRef);

        const deletes = profSnap.docs.map(p => deleteDoc(p.ref));
        await Promise.all(deletes);

        await deleteDoc(empresaRef);
        carregarDados();
    } catch (error) {
        alert("Erro ao excluir.");
    }
}

async function salvarLicencas(empresaId) {
    const input = document.getElementById(`license-input-${empresaId}`);
    const valor = parseInt(input.value);

    await updateDoc(doc(db, "empresarios", empresaId), {
        usuariosLicenciados: valor
    });

    alert("Licenças atualizadas");
}

// =====================================================
// 🔥 PLANOS PRONTI
// =====================================================

async function carregarPlanos() {
    const snap = await getDocs(collection(db, "planosPronti"));
    planosCache = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    renderizarDados(currentData);
}

async function salvarPlano(planoId) {
    const input = document.getElementById(`preco-${planoId}`);
    const valor = parseFloat(input.value);

    await updateDoc(doc(db, "planosPronti", planoId), {
        preco: valor
    });

    alert("Plano atualizado!");
}

async function aplicarAumento() {
    const percentual = parseFloat(document.getElementById("percentual").value);

    for (const plano of planosCache) {
        const novo = plano.preco * (1 + percentual / 100);

        await updateDoc(doc(db, "planosPronti", plano.id), {
            preco: parseFloat(novo.toFixed(2))
        });
    }

    alert("Aumento aplicado!");
    carregarPlanos();
}

// =====================================================
// RENDER COM ABAS
// =====================================================

function renderizarDados(empresas) {
    currentData = empresas;

    let html = `
        <div style="margin-bottom:20px;">
            <button id="tab-empresas">Empresas</button>
            <button id="tab-planos">Planos Pronti</button>
        </div>
    `;

    if (abaAtual === "empresas") {
        html += '<h2>Gestão de Empresas</h2>';

        html += empresas.map(e => {
            const total = e.funcionarios?.length || 0;
            const lic = e.usuariosLicenciados || total;

            return `
                <div style="margin-bottom:10px;">
                    <strong>${e.nome || e.email}</strong><br>
                    Funcionários: ${total}<br>

                    Licenças:
                    <input type="number" id="license-input-${e.uid}" value="${lic}">
                    <button onclick="salvarLicencas('${e.uid}')">Salvar</button>
                </div>
            `;
        }).join('');
    }

    if (abaAtual === "planos") {
        html += `
            <h2>Planos Pronti</h2>

            <input id="percentual" placeholder="% aumento">
            <button onclick="aplicarAumento()">Aplicar</button>
        `;

        html += planosCache.map(p => `
            <div>
                ${p.nome} (${p.limiteFuncionarios})
                <input type="number" id="preco-${p.id}" value="${p.preco}">
                <button onclick="salvarPlano('${p.id}')">Salvar</button>
            </div>
        `).join('');
    }

    render(html);

    // =====================================================
    // 🔥 CORREÇÃO PRINCIPAL (AQUI ESTAVA O BUG)
    // =====================================================

    setTimeout(() => {
        const tabEmpresas = document.getElementById("tab-empresas");
        const tabPlanos = document.getElementById("tab-planos");

        if (tabEmpresas) {
            tabEmpresas.onclick = () => {
                abaAtual = "empresas";
                renderizarDados(currentData);
            };
        }

        if (tabPlanos) {
            tabPlanos.onclick = async () => {
                abaAtual = "planos";
                await carregarPlanos();
            };
        }
    }, 0);
}

// =====================================================
// CARREGAMENTO
// =====================================================

async function carregarDados() {
    render("Carregando...");

    const snap = await getDocs(collection(db, "empresarios"));

    const dados = await Promise.all(snap.docs.map(async docu => {
        const empresa = { uid: docu.id, ...docu.data() };

        const profSnap = await getDocs(collection(db, "empresarios", empresa.uid, "profissionais"));
        empresa.funcionarios = profSnap.docs.map(p => p.data());

        return empresa;
    }));

    renderizarDados(dados);
}

// =====================================================
// AUTH
// =====================================================

function inicializarPainelAdmin() {
    onAuthStateChanged(auth, (user) => {
        if (user && user.uid === ADMIN_UID) {
            carregarDados();
        } else {
            render("Acesso negado");
        }
    });
}

inicializarPainelAdmin();

// =====================================================
// GLOBAL
// =====================================================
window.salvarPlano = salvarPlano;
window.aplicarAumento = aplicarAumento;
window.salvarLicencas = salvarLicencas;
