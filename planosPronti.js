import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { PLANOS_PRONTI } from "./planos-pronti.js";

async function sincronizarPlanos() {
    try {
        console.log("🚀 Iniciando sincronização de planos...");

        for (const plano of PLANOS_PRONTI) {
            const ref = doc(db, "planosPronti", plano.id);

            await setDoc(ref, {
                nome: plano.nome,
                limiteFuncionarios: plano.limiteFuncionarios,
                preco: plano.preco,
                linkMP: plano.linkMP,
                updatedAt: new Date()
            });

            console.log(`✅ Plano ${plano.id} atualizado`);
        }

        alert("🔥 Planos sincronizados com sucesso!");

    } catch (error) {
        console.error("❌ Erro ao sincronizar planos:", error);
        alert("Erro ao sincronizar planos");
    }
}

window.sincronizarPlanos = sincronizarPlanos;
