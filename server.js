// ======================================================================
// Arquivo: server.js (VERSÃO LIMPA, SEM MERCADO PAGO, SEM STRIPE)
// ======================================================================

const express = require('express');
const admin = require('firebase-admin');
const app = express();

// --- INICIALIZAÇÃO DO FIREBASE ADMIN ---
// Lembre-se de ter o seu arquivo serviceAccountKey.json na mesma pasta
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
// -----------------------------------------

app.use(express.static('public')); // Para servir seus arquivos HTML, CSS, JS
app.use(express.json());

// ======================================================================
// ENDPOINT: Informa ao front-end o status da empresa (exemplo de uso)
// ======================================================================
app.post('/get-status-empresa', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'ID do usuário não fornecido.' });

        const empresasRef = db.collection('empresarios');
        const snapshot = await empresasRef.where('donoId', '==', userId).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Empresa não encontrada.' });
        }
        
        const empresaDoc = snapshot.docs[0];
        const empresaData = empresaDoc.data();

        let numeroParaValidacao;

        // A fonte da verdade é o campo 'usuariosLicenciados' que você edita no painel admin
        if (empresaData.usuariosLicenciados !== undefined) {
            numeroParaValidacao = empresaData.usuariosLicenciados;
        } else {
            // Se o campo não existir, usamos a contagem real como um fallback seguro.
            const profCollectionRef = db.collection('empresarios', empresaDoc.id, 'profissionais');
            const profSnap = await profCollectionRef.get();
            numeroParaValidacao = profSnap.size;
        }

        res.json({ licencasNecessarias: numeroParaValidacao });

    } catch (error) {
        console.error("Erro ao buscar status da empresa:", error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ======================================================================
// ENDPOINT: CRUD DE SERVIÇOS (exemplo de endpoints)
// ======================================================================

// Buscar todos os serviços de uma empresa
app.get('/empresas/:empresaId/servicos', async (req, res) => {
    try {
        const { empresaId } = req.params;
        const servicosRef = db.collection('empresarios').doc(empresaId).collection('servicos');
        const snapshot = await servicosRef.get();
        const servicos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(servicos);
    } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        res.status(500).json({ error: "Erro ao buscar serviços." });
    }
});

// Criar novo serviço
app.post('/empresas/:empresaId/servicos', async (req, res) => {
    try {
        const { empresaId } = req.params;
        const dados = req.body;
        const servicosRef = db.collection('empresarios').doc(empresaId).collection('servicos');
        const docRef = await servicosRef.add(dados);
        res.json({ success: true, id: docRef.id });
    } catch (error) {
        console.error("Erro ao criar serviço:", error);
        res.status(500).json({ error: "Erro ao criar serviço." });
    }
});

// Editar serviço existente
app.put('/empresas/:empresaId/servicos/:servicoId', async (req, res) => {
    try {
        const { empresaId, servicoId } = req.params;
        const dados = req.body;
        const servicosRef = db.collection('empresarios').doc(empresaId).collection('servicos').doc(servicoId);
        await servicosRef.update(dados);
        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao editar serviço:", error);
        res.status(500).json({ error: "Erro ao editar serviço." });
    }
});

// Excluir serviço
app.delete('/empresas/:empresaId/servicos/:servicoId', async (req, res) => {
    try {
        const { empresaId, servicoId } = req.params;
        const servicosRef = db.collection('empresarios').doc(empresaId).collection('servicos').doc(servicoId);
        await servicosRef.delete();
        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        res.status(500).json({ error: "Erro ao excluir serviço." });
    }
});

// ======================================================================

const PORT = 4242;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}!`));
