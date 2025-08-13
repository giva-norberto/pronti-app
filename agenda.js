import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    const listaAgendamentosEl = document.getElementById("lista-agendamentos");
    const inputDataEl = document.getElementById("data-agenda");
    const filtroProfissionalEl = document.getElementById("filtro-profissional");
    let empresaIdGlobal = null;
    let todosProfissionais = [];

    async function getEmpresaIdDoDono(uid) {
        console.log("Buscando empresa para o dono com UID:", uid); // Log de depuração
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.error("Nenhuma empresa encontrada para este UID.");
            return null;
        }
        console.log("Empresa encontrada:", snapshot.docs[0].id);
        return snapshot.docs[0].id;
    }
    
    async function buscarProfissionais(empresaId) {
        const q = query(collection(db, "empresarios", empresaId, "profissionais"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // ... (demais funções permanecem as mesmas)

    function popularFiltroProfissionais() {
        if (!filtroProfissionalEl) return;
        filtroProfissionalEl.innerHTML = '<option value="todos">Todos os Profissionais</option>';
        todosProfissionais.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nome;
            filtroProfissionalEl.appendChild(option);
        });
    }

    // ... (demais funções permanecem as mesmas)

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            empresaIdGlobal = await getEmpresaIdDoDono(user.uid);
            if (empresaIdGlobal) {
                if (inputDataEl && !inputDataEl.value) {
                    const hoje = new Date();
                    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
                    inputDataEl.value = hoje.toISOString().split("T")[0];
                }
                
                todosProfissionais = await buscarProfissionais(empresaIdGlobal);
                // ESTA É A LINHA MAIS IMPORTANTE PARA O DIAGNÓSTICO
                console.log("Profissionais encontrados para o filtro:", todosProfissionais);
                
                popularFiltroProfissionais();
                
                inputDataEl.addEventListener("change", atualizarAgenda);
                filtroProfissionalEl.addEventListener("change", atualizarAgenda);
                
                atualizarAgenda();
            } else {
                document.body.innerHTML = '<h1>Acesso negado. Você não é o dono de uma empresa. Verifique os dados no Firestore.</h1>';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    // Colar aqui o restante das funções que não foram alteradas:
    // async function concluirAgendamento...
    // async function cancelarAgendamento...
    // async function atualizarAgenda...
    // function renderizarAgendamentos...
});
