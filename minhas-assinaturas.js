import { db, auth } from './vitrini-firebase.js';
import { collection, query, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Função utilitária para obter o empresaId mais robusto
function obterEmpresaId() {
    let empresaId = null;
    try {
        const url = new URL(window.location.href);
        const empresaParam = url.searchParams.get('empresa');
        if (empresaParam) {
            empresaId = empresaParam;
            localStorage.setItem('empresaAtivaId', empresaId); // mantém localStorage sempre atualizado
        }
    } catch {}
    if (!empresaId) {
        empresaId = localStorage.getItem('empresaAtivaId');
    }
    return empresaId;
}

// Função para garantir usuário pronto via Firebase Auth
function esperarUsuarioAutenticado() {
    return new Promise(resolve => {
        if (auth.currentUser) return resolve(auth.currentUser);
        const unsub = auth.onAuthStateChanged(user => {
            unsub();
            resolve(user);
        });
    });
}

export async function montarPainelMinhasAssinaturas(divAlvo) {
    divAlvo.innerHTML = "Carregando assinaturas...";
    const [empresaId, user] = await Promise.all([
        obterEmpresaId(),
        esperarUsuarioAutenticado()
    ]);
    if (!empresaId || !user) {
        divAlvo.innerHTML = "<p>Empresa ou usuário não definidos.</p>";
        return;
    }

    const assinaturasRef = collection(db, "empresarios", empresaId, "clientes", user.uid, "assinaturas");
    const q = query(assinaturasRef);
    const snap = await getDocs(q);

    if (snap.empty) {
        divAlvo.innerHTML = "<p>Você não possui assinaturas.</p>";
        return;
    }

    divAlvo.innerHTML = "";
    snap.forEach(doc => {
        const a = doc.data();
        const status = a.status === "ativo" && a.dataFim && a.dataFim.toDate ? 
            (a.dataFim.toDate() > new Date() ? "ATIVA" : "VENCIDA") 
            : "VENCIDA";
        const item = document.createElement('div');
        item.className = 'card-assinatura';
        item.innerHTML = `
            <b>${a.planoNome || a.planoId}</b><br>
            Status: <b>${status}</b><br>
            Validade até: <span>${a.dataFim?.toDate ? a.dataFim.toDate().toLocaleDateString('pt-BR') : '---'}</span>
        `;
        divAlvo.appendChild(item);
    });
}
