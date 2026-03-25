import { db, auth } from './vitrini-firebase.js';
import { collection, query, getDocs, where } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Função utilitária para obter o empresaId mais robusto (URL > localStorage)
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

/**
 * EXIBE SOMENTE AS ASSINATURAS ATIVAS
 */
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
    const q = query(assinaturasRef); // buscando todas do usuário na empresa
    const snap = await getDocs(q);

    divAlvo.innerHTML = "";
    let achouAtiva = false;

    snap.forEach(doc => {
        const a = doc.data();
        const isAtiva =
            a.status === "ativo"
            && a.dataFim
            && a.dataFim.toDate
            && a.dataFim.toDate() > new Date();
        if (!isAtiva) return; // Só mostra ativas

        achouAtiva = true;
        const item = document.createElement('div');
        item.className = 'card-assinatura';
        item.innerHTML = `
            <b>${a.planoNome || a.planoId}</b><br>
            Status: <b>ATIVA</b><br>
            Validade até: <span>${a.dataFim?.toDate ? a.dataFim.toDate().toLocaleDateString('pt-BR') : '---'}</span>
        `;
        divAlvo.appendChild(item);
    });

    if (!achouAtiva) {
        divAlvo.innerHTML = "<p>Você não possui assinaturas ativas.</p>";
    }
}

/**
 * CHECA SE USUÁRIO JÁ TEM ASSINATURA ATIVA DESSE PLANO (para bloquear duplicidade)
 * Uso: await existeAssinaturaAtivaDoPlano(empresaId, user.uid, planoId)
 * Retorna: true se já existe, false se pode criar
 */
export async function existeAssinaturaAtivaDoPlano(empresaId, userId, planoId) {
    const assinaturasRef = collection(db, "empresarios", empresaId, "clientes", userId, "assinaturas");
    // Filtra por planoId, status ativo
    const q = query(
        assinaturasRef,
        where("planoId", "==", planoId),
        where("status", "==", "ativo")
    );
    const snap = await getDocs(q);
    let algumaAtiva = false;
    snap.forEach(doc => {
        const a = doc.data();
        if(
            a.dataFim
            && a.dataFim.toDate
            && a.dataFim.toDate() > new Date()
        ) {
            algumaAtiva = true;
        }
    });
    return algumaAtiva;
}
