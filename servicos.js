// ... imports e utilitários como antes ...

async function carregarServicosDoFirebase() {
    if (!empresaId) {
        listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
        return;
    }
    listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';
    try {
        const servicosCol = collection(db, "empresarios", empresaId, "servicos");
        const snap = await getDocs(servicosCol);
        const servicos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarServicos(servicos);
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
    }
}

async function excluirServico(servicoIdParaExcluir) {
    const confirmado = await showCustomConfirm("Confirmar Exclusão", "Tem certeza que deseja excluir este serviço? Esta ação é permanente.");
    if (!confirmado) return;

    try {
        // Só o dono pode excluir; ajuste se quiser permitir outros
        const servicoRef = doc(db, "empresarios", empresaId, "servicos", servicoIdParaExcluir);
        await deleteDoc(servicoRef);
        alert("Serviço excluído com sucesso!");
        carregarServicosDoFirebase();
    } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        alert("Ocorreu um erro ao excluir o serviço.");
    }
}

// ... o resto permanece igual, mas removendo as referências ao array do profissional ...

// PONTO DE PARTIDA
let empresaId = null;
onAuthStateChanged(auth, async (user) => {
    if (user) {
        empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            carregarServicosDoFirebase();
        } else {
            listaServicosDiv.innerHTML = '<p style="color:red;">Empresa não encontrada.</p>';
        }
    } else {
        window.location.href = 'login.html';
    }
});
