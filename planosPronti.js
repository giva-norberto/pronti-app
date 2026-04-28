// ======================================================================
// 📁 Arquivo: planosPronti.js
// 🎯 Objetivo:
// Sincronizar (criar/atualizar) todos os planos no Firestore
// a partir da configuração local (PLANOS_PRONTI)
// ======================================================================


// 🔌 Importa instância do Firestore já configurada
import { db } from "./firebase-config.js";

// 🔥 Funções do Firestore para criar/atualizar documentos
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// 📦 Importa a fonte de verdade dos planos (arquivo versionado no GitHub)
import { PLANOS_PRONTI } from "./planos-pronti.js";


// ======================================================================
// 🚀 FUNÇÃO PRINCIPAL: sincronizarPlanos
// ======================================================================
// Percorre todos os planos definidos no arquivo local
// e envia (ou atualiza) no Firestore na coleção "planosPronti"
// ======================================================================
async function sincronizarPlanos() {
    try {
        console.log("🚀 Iniciando sincronização de planos...");

        // 🔁 Loop em todos os planos definidos no arquivo local
        for (const plano of PLANOS_PRONTI) {

            // 📍 Referência do documento no Firestore
            // Exemplo: planosPronti/plano_1
            const ref = doc(db, "planosPronti", plano.id);

            // 💾 Cria ou sobrescreve o documento com os dados do plano
            await setDoc(ref, {
                nome: plano.nome, // Nome do plano (ex: "Plano Básico")
                limiteFuncionarios: plano.limiteFuncionarios, // Quantidade máxima de usuários
                preco: plano.preco, // Valor mensal do plano
                linkMP: plano.linkMP, // Link de pagamento Mercado Pago
                updatedAt: new Date() // Data da última atualização
            });

            // 🧾 Log individual por plano (útil para debug)
            console.log(`✅ Plano ${plano.id} atualizado`);
        }

        // 🎉 Feedback visual para o admin
        alert("🔥 Planos sincronizados com sucesso!");

    } catch (error) {
        // ❌ Tratamento de erro
        console.error("❌ Erro ao sincronizar planos:", error);
        alert("Erro ao sincronizar planos");
    }
}


// ======================================================================
// 🌐 EXPOSIÇÃO GLOBAL
// ======================================================================
// Torna a função acessível no HTML (ex: botão onclick)
// ======================================================================
window.sincronizarPlanos = sincronizarPlanos;
