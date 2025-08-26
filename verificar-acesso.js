// Arquivo: verificar-acesso.js
// Responsabilidade: Verificar o status da assinatura do usuário e redirecioná-lo se necessário.

import { auth, db } from "./vitrini-firebase.js"; // Usando seu arquivo central de conexão
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Função principal que será chamada para proteger as páginas
export async function protegerPagina( ) {
    onAuthStateChanged(auth, async (user) => {
        // Se não há usuário logado, envia para a página de login.
        if (!user) {
            console.log("Nenhum usuário logado, redirecionando para login...");
            window.location.href = 'login.html';
            return;
        }

        // Se o usuário é o admin, ele tem acesso a tudo, não precisa verificar.
        const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";
        if (user.uid === ADMIN_UID) {
            console.log("Administrador detectado. Acesso total concedido.");
            return; 
        }

        try {
            // Busca o documento da empresa/usuário na coleção 'empresarios'
            const empresaRef = doc(db, "empresarios", user.uid);
            const empresaDoc = await getDoc(empresaRef);

            if (!empresaDoc.exists()) {
                console.error("Documento da empresa não encontrado para o usuário:", user.uid);
                // Você pode redirecionar para uma página de erro ou logout aqui
                window.location.href = 'login.html';
                return;
            }

            const dadosEmpresa = empresaDoc.data();

            // Se o usuário já é premium, o acesso é liberado.
            if (dadosEmpresa.isPremium === true) {
                console.log("Usuário Premium. Acesso concedido.");
                return;
            }

            // Lógica de verificação do período de teste
            const diasDeTeste = dadosEmpresa.freeEmDias === undefined ? 15 : dadosEmpresa.freeEmDias;
            const dataCadastro = dadosEmpresa.dataCadastro; // Supondo que você tenha um campo 'dataCadastro'

            if (!dataCadastro) {
                console.error("Campo 'dataCadastro' não encontrado. Não é possível verificar o trial.");
                // Libera o acesso por segurança, mas avisa do erro.
                return;
            }

            const dataCadastroMs = dataCadastro.toMillis();
            const dataAtualMs = new Date().getTime();
            const diasPassados = (dataAtualMs - dataCadastroMs) / (1000 * 60 * 60 * 24);

            // Se os dias de teste acabaram, redireciona para a página de assinatura.
            if (diasPassados > diasDeTeste) {
                console.log(`Período de teste expirado (${diasPassados.toFixed(1)} de ${diasDeTeste} dias). Redirecionando para assinatura...`);
                window.location.href = 'assinatura.html';
            } else {
                console.log(`Usuário em período de teste (${diasPassados.toFixed(1)} de ${diasDeTeste} dias). Acesso concedido.`);
            }

        } catch (error) {
            console.error("Erro ao verificar acesso:", error);
            // Em caso de erro, redireciona para o login por segurança.
            window.location.href = 'login.html';
        }
    });
}
