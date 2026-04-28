import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
const conteudoDiv = document.getElementById('conteudo-admin');

let empresasCache = [];
let planosCache = [];
let telaAtual = "empresas";

// =====================================================
// RENDER
// =====================================================
function render(html) {
    if (conteudoDiv) conteudoDiv.innerHTML = html;
}

// =====================================================
// TROCA DE TELAS (FORÇADO)
// =====================================================
async function abrirEmpresas() {
    telaAtual = "empresas";
    await carregarEmpresas();
    renderEmpresas();
}

async function abrirPlanos() {
    telaAtual = "planos";
    await listarPlanos();
}

// =====================================================
// EMPRESAS
// =====================================================
async function carregarEmpresas() {
    const snap = await getDocs(collection(db, "empresarios"));

    empresasCache = await Promise.all(snap.docs.map(async d => {
        const empresa = { uid: d.id, ...d.data() };

        const profSnap = await getDocs(
            collection(db, "empresarios", empresa.uid, "profissionais")
        );

        empresa.funcionarios = profSnap.docs.map(p => p.data());
        return empresa;
    }));
}

function renderEmpresas() {
    let html = `
        <div style="margin-bottom:20px;">
            <button onclick="abrirEmpresas()" style="font-weight:bold;">Empresas</button>
            <button onclick="abrirPlanos()">Planos Pronti</button>
        </div>

        <h2>Gestão de Empresas</h2>
    `;

    if (empresasCache.length === 0) {
        html += `<div style="color:#888;">Nenhuma empresa encontrada.</div>`;
    } else {
        html += empresasCache.map(e => {
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

    render(html);
}

// =====================================================
// PLANOS (CORRIGIDO)
// =====================================================
async function listarPlanos() {
    const snap = await getDocs(collection(db, "planosPronti"));

    planosCache = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));

    let html = `
        <div style="margin-bottom:20px;">
            <button onclick="abrirEmpresas()">Empresas</button>
            <button onclick="abrirPlanos()" style="font-weight:bold;">Planos Pronti</button>
        </div>

        <h2>Planos Pronti</h2>

        <input id="percentual" placeholder="% aumento">
        <button onclick="aplicarAumento()">Aplicar</button>
    `;

    if (planosCache.length === 0) {
        html += `<div style="color:#888;">Nenhum plano cadastrado</div>`;
    } else {
        html += planosCache.map(p => `
            <div style="margin-bottom:10px;">
                <b>${p.nome}</b> (${p.limiteFuncionarios})<br>

                Preço:
                <input type="number" id="preco-${p.id}" value="${p.preco}">

                <button onclick="salvarPlano('${p.id}')">Salvar</button>
            </div>
        `).join('');
    }

    render(html);
}

// =====================================================
// AÇÕES
// =====================================================
async function salvarLicencas(empresaId) {
    const input = document.getElementById(`license-input-${empresaId}`);
    const valor = parseInt(input.value);

    await updateDoc(doc(db, "empresarios", empresaId), {
        usuariosLicenciados: valor
    });

    alert("Licenças atualizadas");
}

async function salvarPlano(planoId) {
    const input = document.getElementById(`preco-${planoId}`);
    const valor = parseFloat(input.value);

    await updateDoc(doc(db, "planosPronti", planoId), {
        preco: valor
    });

    alert("Plano atualizado!");
    await listarPlanos();
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
    await listarPlanos();
}

// =====================================================
// BLOQUEIO / EXCLUIR (mantido)
// =====================================================
async function toggleBloqueio(empresaId, novoStatus, button) {
    const acao = novoStatus ? 'bloquear' : 'desbloquear';
    if (!confirm(`Tem certeza que deseja ${acao} esta empresa?`)) return;

    const originalText = button.textContent;
    button.textContent = 'Aguarde...';
    button.disabled = true;

    try {
        await updateDoc(doc(db, "empresarios", empresaId), {
            bloqueado: novoStatus
        });

        await carregarEmpresas();
        renderEmpresas();

    } catch (e) {
        alert("Erro ao atualizar status.");
    }

    button.textContent = originalText;
    button.disabled = false;
}

// =====================================================
// LOGIN
// =====================================================
function inicializarPainelAdmin() {
    onAuthStateChanged(auth, async (user) => {
        if (user && user.uid === ADMIN_UID) {
            await carregarEmpresas();
            renderEmpresas();
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
window.abrirEmpresas = abrirEmpresas;
window.abrirPlanos = abrirPlanos;
