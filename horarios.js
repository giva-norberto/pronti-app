/**
 * horarios.js (VERSÃO CORRIGIDA E ALINHADA COM A ESTRUTURA 'empresarios')
 *
 * Lógica Principal:
 * 1. Identifica o dono logado e a sua 'empresaId'.
 * 2. Carrega e salva os horários no documento do profissional correto,
 * que está em 'empresarios/{empresaId}/profissionais/{donoId}'.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('form-horarios');
const diasDaSemana = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

let profissionalRef = null; // Guardará a referência para o documento do profissional

/**
 * Função auxiliar para encontrar o ID da empresa com base no ID do dono.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

// Ponto de partida: verifica o login antes de fazer qualquer coisa.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            // CORREÇÃO: A referência agora aponta para o documento do profissional (o dono)
            profissionalRef = doc(db, "empresarios", empresaId, "profissionais", user.uid);
            
            if (form) {
                carregarHorarios();
                form.addEventListener('submit', handleFormSubmit);
            }
        } else {
            alert("Empresa não encontrada. Por favor, complete o seu perfil primeiro.");
        }
    } else {
        window.location.href = 'login.html';
    }
});


/**
 * CORREÇÃO: Carrega os horários salvos do documento do profissional.
 */
async function carregarHorarios() {
    if (!profissionalRef) return;
    try {
        const docSnap = await getDoc(profissionalRef);

        if (docSnap.exists() && docSnap.data().horarios) {
            const horarios = docSnap.data().horarios; // Pega o objeto 'horarios'
            diasDaSemana.forEach(dia => {
                if (horarios[dia]) {
                    const inputInicio = document.getElementById(`${dia}-inicio`);
                    const inputFim = document.getElementById(`${dia}-fim`);
                    const checkAtivo = document.getElementById(`${dia}-ativo`);

                    if (inputInicio && inputFim && checkAtivo) {
                        inputInicio.value = horarios[dia].inicio;
                        inputFim.value = horarios[dia].fim;
                        checkAtivo.checked = horarios[dia].ativo;
                    }
                }
            });
        } else {
            console.log("Nenhum horário configurado. Usando valores padrão.");
        }
    } catch (error) {
        console.error("Erro ao carregar horários:", error);
    }
}

/**
 * CORREÇÃO: Salva os horários como um campo 'horarios' no documento do profissional.
 * @param {Event} event - O evento de submit.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    if (!profissionalRef) {
        alert("Erro: não foi possível encontrar o perfil para salvar.");
        return;
    }

    const btnSalvar = form.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    const horariosData = {};
    diasDaSemana.forEach(dia => {
        horariosData[dia] = {
            inicio: document.getElementById(`${dia}-inicio`).value,
            fim: document.getElementById(`${dia}-fim`).value,
            ativo: document.getElementById(`${dia}-ativo`).checked
        };
    });

    try {
        // CORREÇÃO: Usa 'setDoc' com 'merge: true' para atualizar ou criar o campo 'horarios'
        // sem apagar outros dados do profissional (como a lista de serviços).
        await setDoc(profissionalRef, { horarios: horariosData }, { merge: true });
        alert("Horários salvos com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar horários:", error);
        alert("Ocorreu um erro ao salvar os horários.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Horários';
    }
}
