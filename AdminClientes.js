// ======================================================================
// Arquivo: admin-clientes-logic.js (VERSÃO FINAL COM DEBUG)
// ======================================================================

// Importa as dependências do Firebase
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
const conteudoDiv = document.getElementById('conteudo-admin');
let currentData = []; 

// Função para renderizar o HTML
function render(html) {
    if (conteudoDiv) {
        conteudoDiv.innerHTML = html;
    }
}

// Funções de ação (bloquear, excluir, etc.)
async function toggleBloqueio(empresaId, novoStatus, button) {
    console.log("toggleBloqueio chamado", { empresaId, novoStatus });
    const acao = novoStatus ? 'bloquear' : 'desbloquear';
    if (!confirm(`Tem certeza que deseja ${acao} esta empresa e todos os seus funcionários?`)) return;
    
    const originalText = button.textContent;
    button.textContent = 'Aguarde...';
    button.disabled = true;

    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        await updateDoc(empresaRef, { bloqueado: novoStatus });

        const profCollectionRef = collection(db, "empresarios", empresaId, "profissionais");
        const profSnap = await getDocs(profCollectionRef);
        console.log("Profissionais encontrados:", profSnap.docs.length);
        const updates = profSnap.docs.map(p => updateDoc(p.ref, { bloqueado: novoStatus }));
        await Promise.all(updates);

        const empresaIndex = currentData.findIndex(e => e.uid === empresaId);
        if (empresaIndex > -1) {
            currentData[empresaIndex].bloqueado = novoStatus;
            currentData[empresaIndex].funcionarios.forEach(f => f.bloqueado = novoStatus);
            renderizarDados(currentData);
        }
        console.log("Status atualizado com sucesso:", empresaId, novoStatus);
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Não foi possível atualizar o status da empresa.");
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function excluirEmpresa(empresaId, button) {
    console.log("excluirEmpresa chamado", { empresaId });
    if (!confirm("ATENÇÃO: Esta ação é irreversível. Deseja realmente EXCLUIR esta empresa e todos os seus funcionários?")) return;
    
    const originalText = button.textContent;
    button.textContent = 'Excluindo...';
    button.disabled = true;

    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        const profCollectionRef = collection(db, "empresarios", empresaId, "profissionais");
        const profSnap = await getDocs(profCollectionRef);
        console.log("Profissionais encontrados para exclusão:", profSnap.docs.length);
        
        const deletes = profSnap.docs.map(p => deleteDoc(p.ref));
        await Promise.all(deletes);
        
        await deleteDoc(empresaRef);
        
        currentData = currentData.filter(e => e.uid !== empresaId);
        renderizarDados(currentData);
        alert('Empresa excluída com sucesso!');
        console.log("Empresa excluída:", empresaId);
    } catch (error) {
        console.error("Erro ao excluir empresa:", error);
        alert("Não foi possível excluir a empresa.");
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function salvarDiasTeste(empresaId, button) {
    console.log("salvarDiasTeste chamado", { empresaId });
    const input = document.getElementById(`trial-input-${empresaId}`);
    const novoValor = parseInt(input.value, 10);
    if (isNaN(novoValor) || novoValor < 0) {
        alert("Por favor, insira um número válido de dias.");
        return;
    }

    const originalText = button.textContent;
    button.textContent = '...';
    button.disabled = true;

    try {
        const empresaRef = doc(db, "empresarios", empresaId);
        await updateDoc(empresaRef, { freeEmDias: novoValor });
        
        const empresaIndex = currentData.findIndex(e => e.uid === empresaId);
        if (empresaIndex > -1) {
            currentData[empresaIndex].freeEmDias = novoValor;
        }
        alert('Dias de teste atualizados com sucesso!');
        console.log("Dias de teste atualizados:", empresaId, novoValor);
    } catch (error) {
        console.error("Erro ao salvar dias de teste:", error);
        alert("Não foi possível salvar os dias de teste.");
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

conteudoDiv.addEventListener('click', function(event) {
    const target = event.target;
    const empresaId = target.dataset.id;
    if (!empresaId) return;

    if (target.classList.contains('btn-block') || target.classList.contains('btn-unblock')) {
        const novoStatus = target.classList.contains('btn-block');
        toggleBloqueio(empresaId, novoStatus, target);
    } else if (target.classList.contains('btn-delete')) {
        excluirEmpresa(empresaId, target);
    } else if (target.classList.contains('btn-save-trial')) {
        salvarDiasTeste(empresaId, target);
    }
});

// Função para renderizar a tabela de dados
function renderizarDados(empresas) {
    console.log("renderizarDados chamado. Total empresas:", empresas.length);
    currentData = empresas;
    let htmlFinal = '<h2>Gestão de Empresas e Funcionários</h2>';
    if (empresas.length === 0) {
        htmlFinal += '<p>Nenhuma empresa encontrada.</p>';
    } else {
        htmlFinal += empresas.map(empresa => `
            <div class="empresa">
                <div class="empresa-header">
                    <div>
                        <div><strong>Empresa:</strong> ${empresa.nome || empresa.email || empresa.uid}</div>
                        <div><strong>Status:</strong> <span style="color: ${empresa.bloqueado ? '#dc2626' : '#10b981'}">${empresa.bloqueado ? 'Bloqueada' : 'Ativa'}</span></div>
                    </div>
                    <div class="button-group">
                        <button data-id="${empresa.uid}" class="btn-delete">Excluir</button>
                        <button data-id="${empresa.uid}" class="${empresa.bloqueado ? 'btn-unblock' : 'btn-block'}">
                            ${empresa.bloqueado ? 'Desbloquear' : 'Bloquear'}
                        </button>
                    </div>
                </div>
                
                <div class="trial-management">
                    <strong>Dias de Teste Grátis:</strong>
                    <input type="number" class="trial-input" id="trial-input-${empresa.uid}" value="${empresa.freeEmDias === undefined ? 15 : empresa.freeEmDias}">
                    <button data-id="${empresa.uid}" class="btn-save-trial">Salvar</button>
                </div>

                <div style="margin-top: 16px;">
                    <strong>Funcionários:</strong>
                    <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
                        <thead><tr style="background: #f3f4f6;"><th>Nome</th><th>Email</th><th>Status</th></tr></thead>
                        <tbody>
                            ${(empresa.funcionarios && empresa.funcionarios.length > 0)
                                ? empresa.funcionarios.map(f => `
                                    <tr class="${f.bloqueado ? 'blocked' : ''}">
                                        <td>${f.nome || '-'}</td>
                                        <td>${f.email || '-'}</td>
                                        <td><span style="color: ${f.bloqueado ? '#dc2626' : '#10b981'}">${f.bloqueado ? 'Bloqueado' : 'Ativo'}</span></td>
                                    </tr>
                                `).join('')
                                : '<tr><td colspan="3" style="text-align: center; color: #aaa;">Nenhum funcionário</td></tr>'
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('');
    }
    render(htmlFinal);
}

// Função principal para carregar os dados
async function carregarDados() {
    console.log("carregarDados iniciado");
    render('<div class="loading">Carregando dados das empresas...</div>');
    try {
        const empresasCollectionRef = collection(db, "empresarios");
        const snap = await getDocs(empresasCollectionRef);
        console.log("Número de empresas encontradas:", snap.docs.length);
        
        const empresasComFuncionarios = await Promise.all(snap.docs.map(async (empresaDoc) => {
            const empresa = { uid: empresaDoc.id, ...empresaDoc.data() };
            const profCollectionRef = collection(db, "empresarios", empresa.uid, "profissionais");
            const profSnap = await getDocs(profCollectionRef);
            console.log(`Empresa ${empresa.uid} tem ${profSnap.docs.length} profissionais`);
            empresa.funcionarios = profSnap.docs.map(p => ({ id: p.id, ...p.data() }));
            return empresa;
        }));
        
        renderizarDados(empresasComFuncionarios);
    } catch (error) {
        render(`<div class="restricted" style="color: red;"><strong>Erro ao carregar dados:</strong> ${error.message}</div>`);
        console.error("Erro detalhado ao carregar dados:", error);
    }
}

// Ponto de entrada: verifica a autenticação do administrador
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged disparado", user);
    if (!user) {
        render('<div class="restricted">Acesso negado. Por favor, faça o login.</div>');
        console.log("Usuário não logado");
        return;
    }
    console.log("UID logado:", user.uid);
    if (user.uid !== ADMIN_UID) {
        render(`<div class="restricted">Acesso restrito. Apenas administradores. (Seu UID: ${user.uid})</div>`);
        console.log("UID não autorizado:", user.uid);
        return;
    }
    console.log("Acesso concedido ao administrador");
    await carregarDados();
});

// Adiciona listener para o botão de logout no menu lateral
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        console.log("Logout iniciado");
        signOut(auth).then(() => {
            console.log("Logout concluído");
            window.location.href = 'login.html';
        });
    });
}
