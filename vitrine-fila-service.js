import { db } from './vitrini-firebase.js';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const FilaService = {
    // Evita disparos duplos usando uma trava de processamento simples
    isProcessing: false,

    async entrarNaLista(dadosAgendamento, usuario, preferencias) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const filaRef = collection(db, "fila_agendamentos");
            
            const novoRegistro = {
                clienteId: usuario.uid,
                clienteNome: usuario.displayName || "Cliente",
                clienteToken: localStorage.getItem('fcm_token') || null, // Para o Push
                profissionalId: dadosAgendamento.profissional.id,
                profissionalNome: dadosAgendamento.profissional.nome,
                servicos: dadosAgendamento.servicos.map(s => ({ id: s.id, nome: s.nome, duracao: s.duracao })),
                preferencias: preferencias, // { turno: 'manha', observacao: '' }
                status: "aguardando",
                criadoEm: new Date().toISOString()
            };

            const docRef = await addDoc(filaRef, novoRegistro);
            console.log("✅ Inserido na fila com ID:", docRef.id);
            return { sucesso: true, id: docRef.id };

        } catch (error) {
            console.error("❌ Erro ao inserir na fila:", error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    },

    async buscarProximoDaFila(profissionalId, duracaoNecessaria) {
        // Lógica para encontrar quem está esperando por esse tempo vago
        const q = query(
            collection(db, "fila_agendamentos"),
            where("profissionalId", "==", profissionalId),
            where("status", "==", "aguardando"),
            orderBy("criadoEm", "asc"),
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
};
