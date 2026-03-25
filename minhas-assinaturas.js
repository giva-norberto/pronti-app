import { db, auth } from './vitrini-firebase.js';
import { collection, query, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Função para mostrar as assinaturas
export async function montarPainelMinhasAssinaturas(divAlvo) {
    const user = auth.currentUser;
    const empresaId = localStorage.getItem("empresaAtivaId");
    if (!empresaId || !user) {
        divAlvo.innerHTML = "<p>Empresa ou usuário não definidos.</p>";
        return;
    }
    divAlvo.innerHTML = "Carregando assinaturas...";
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
