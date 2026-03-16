import { db } from './vitrini-firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const FilaService = {
    isProcessing: false,

    async entrarNaLista(state, usuario, preferencias) {
        // 1. Trava de duplicidade
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 2. Validação rigorosa dos dados (Blindagem)
            const profissional = state.agendamento?.profissional;
            if (!profissional || !profissional.id) {
                throw new Error("Dados do profissional incompletos no estado.");
            }

            const servicos = state.agendamento?.servicos || [];
            const filaRef = collection(db, "fila_agendamentos");

            // 3. Montagem do documento para o Firestore
            const novoRegistro = {
                clienteId: usuario.uid,
                clienteNome: usuario.displayName || "Cliente",
                clienteEmail: usuario.email,
                fcmToken: localStorage.getItem('fcm_token') || null, 
                profissionalId: profissional.id,
                profissionalNome: profissional.nome,
                servicos: servicos.map(s => ({ 
                    id: s.id, 
                    nome: s.nome, 
                    duracao: s.duracao 
                })),
                preferencias: preferencias, // Ex: { turno: 'Manhã' }
                status: "aguardando",
                empresaId: state.empresaId || localStorage.getItem("empresaAtivaId"),
                criadoEm: new Date().toISOString()
            };

            const docRef = await addDoc(filaRef, novoRegistro);
            console.log("✅ Sucesso! ID na fila:", docRef.id);
            return { sucesso: true, id: docRef.id };

        } catch (error) {
            console.error("❌ Erro no FilaService:", error.message);
            throw error;
        } finally {
            // 4. Libera o processamento
            this.isProcessing = false;
        }
    }
};
