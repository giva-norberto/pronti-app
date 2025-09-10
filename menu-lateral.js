import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

async function updateMenuWithPermissions(papel) {
    // esconde tudo
    document.querySelectorAll('.menu-func, .menu-dono, .menu-admin, .menu-permissoes')
        .forEach(el => el.style.display = 'none');

    // menus básicos por papel
    if (papel === 'funcionario') document.querySelectorAll('.menu-func').forEach(el => el.style.display = 'flex');
    if (papel === 'dono') document.querySelectorAll('.menu-dono').forEach(el => el.style.display = 'flex');
    if (papel === 'admin') document.querySelectorAll('.menu-dono, .menu-admin, .menu-permissoes').forEach(el => el.style.display = 'flex');

    // pega permissões do Firestore
    try {
        const ref = doc(db, "configuracoesGlobais", "permissoes");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const permissoes = snap.data(); // { agenda: { dono: true, funcionario: false }, ... }

        Object.entries(permissoes).forEach(([menu, roles]) => {
            if (roles[papel] === true) {
                const el = document.querySelector(`[data-menu="${menu}"]`);
                if (el) el.style.display = 'flex';
            }
        });
    } catch(e) {
        console.error("Erro ao buscar permissões:", e);
    }
}

// exemplo de inicialização
auth.onAuthStateChanged(async user => {
    if (!user) return window.location.href = "login.html";

    let papel = "funcionario";
    if (user.uid === ADMIN_UID) papel = "admin";

    // Se você tiver perfil de dono
    // if (perfil.ehDono) papel = "dono";

    await updateMenuWithPermissions(papel);
});
