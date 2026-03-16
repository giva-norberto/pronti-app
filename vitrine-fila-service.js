async entrarNaLista(state, usuario, preferencias) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
        // ✅ PROTEÇÃO: Verifica se o profissional existe antes de ler o ID
        const profissional = state.agendamento?.profissional;
        if (!profissional || !profissional.id) {
            throw new Error("Profissional não identificado no estado da aplicação.");
        }

        const servicos = state.agendamento?.servicos || [];
        const filaRef = collection(db, "fila_agendamentos");

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
            preferencias: preferencias,
            status: "aguardando",
            empresaId: state.empresaId || localStorage.getItem("empresaAtivaId"),
            criadoEm: new Date().toISOString()
        };

        const docRef = await addDoc(filaRef, novoRegistro);
        return { sucesso: true, id: docRef.id };

    } catch (error) {
        console.error("❌ Erro ao inserir na fila:", error.message);
        throw error;
    } finally {
        this.isProcessing = false;
    }
}
