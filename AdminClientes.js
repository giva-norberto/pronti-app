import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
const conteudoDiv = document.getElementById('conteudo-admin');

let empresasCache = [];
let planosCache = [];
let telaAtual = "empresas"; // valores: 'empresas' ou 'planos'

// RENDER GERAL
function render(html) {
    if (conteudoDiv) {
        conteudoDiv.innerHTML = html;
    }
    // Adiciona os eventos dos botões do topo
    const btnEmpresas = document.getElementById("btn-empresas");
    const btnPlanos = document.getElementById("btn-planos");
    if (btnEmpresas) btnEmpresas.onclick = renderEmpresas;
    if (btnPlanos) btnPlanos.onclick = listarPlanos;
}

// ------------ EMPRESAS -------------

async function carregarEmpresas() {
    const snap = await getDocs(collection(db, "empresarios"));
    empresasCache = await Promise.all(snap.docs.map(async d => {
        const empresa = { uid: d.id, ...d.data() };
        const profSnap = await getDocs(collection(db, "empresarios", empresa.uid, "profissionais"));
        empresa.funcionarios = profSnap.docs.map(p => p.data());
        return empresa;
    }));
}

function renderEmpresas() {
    telaAtual = "empresas";
    let html = `
        <div style="margin-bottom:20px;">
            <button id="btn-empresas" style="font-weight:bold;">Empresas</button>
            <button id="btn-planos">Planos Pronti</button>
        </div>
        <h2>Gestão de Empresas</h2>
    `;
    if (empresasCache.length === 0) {
        html += '<div style="color:#888;">Nenhuma empresa encontrada.</div>';
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

// ------------ PLANOS -------------

async function listarPlanos() {
    telaAtual = "planos";
    const snap = await getDocs(collection(db, "planosPronti"));
    planosCache = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));

    let html = `
        <div style="margin-bottom:20px;">
            <button id="btn-empresas">Empresas</button>
            <button id="btn-planos" style="font-weight:bold;">Planos Pronti</button>
        </div>
        <h2>Planos Pronti</h2>
        <div style="margin-bottom:12px;">
            <input id="percentual" placeholder="% aumento" style="width:90px;">
            <button onclick="aplicarAumento()">Aplicar</button>
        </div>
    `;

    if (planosCache.length === 0) {
        html += `<div style="padding:14px;color:#888;">Nenhum plano cadastrado no sistema!</div>`;
    } else {
        html += planosCache.map(p => `
            <div style="margin-bottom:12px;padding:10px 0;border-bottom:1px solid #eee;">
                <b>${p.nome}</b> (${p.limiteFuncionarios} funcionário${p.limiteFuncionarios > 1 ? 's' : ''})<br>
                Preço: <input type="number" id="preco-${p.id}" value="${p.preco}" style="width:90px;"> 
                <button onclick="salvarPlano('${p.id}')">Salvar</button>
                <span style="font-size:0.95em;color:#555;margin-left:10px;">
                    <a href="${p.linkMP}" target="_blank">Link Mercado Pago</a>
                </span>
            </div>
        `).join('');
    }
    render(html);
}

// --------- AÇÕES EXISTENTES ---------

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

// ----------- BLOQUEIO/EXCLUIR --------

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
        const updates = profSnap.docs.map(p =>
            updateDoc(p.ref, { bloqueado: novoStatus })
        );
        await Promise.all(updates);
        await carregarEmpresas();
        renderEmpresas();
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

        await carregarEmpresas();
        renderEmpresas();
    } catch (error) {
        alert("Erro ao excluir.");
    }
}

// ----------- CARREGAMENTO / AUTH -------------

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

// ----------- GLOBAL -----------
window.salvarPlano = salvarPlano;
window.aplicarAumento = aplicarAumento;
window.salvarLicencas = salvarLicencas;
