// ======================================================================
// Arquivo: server.js (VERSÃO FINAL COM VALIDAÇÃO COMPLETA)
// ======================================================================

const express = require('express');
const mercadopago = require('mercadopago');
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

mercadopago.configure({
    access_token: 'SEU_ACCESS_TOKEN_DO_MERCADO_PAGO_AQUI'
});

// "Tabela de Preços" segura no servidor. Esta é a fonte da verdade para os cálculos.
const configuracaoPrecos = {
    precoBase: 59.90,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
        { de: 3, ate: 10, valor: 29.90 },
        { de: 11, ate: 50, valor: 24.90 },
    ]
};

// Função de cálculo segura NO SERVIDOR
function calcularPrecoNoServidor(totalFuncionarios) {
    if (totalFuncionarios <= configuracaoPrecos.funcionariosInclusos) {
        return configuracaoPrecos.precoBase;
    }
    let total = configuracaoPrecos.precoBase;
    for (const faixa of configuracaoPrecos.faixasDePrecoExtra) {
        const inicioDaFaixa = faixa.de;
        if (totalFuncionarios >= inicioDaFaixa) {
            const fimDaFaixa = faixa.ate;
            const funcionariosNestaFaixa = Math.min(totalFuncionarios, fimDaFaixa) - Math.max(configuracaoPrecos.funcionariosInclusos, inicioDaFaixa) + 1;
            if(funcionariosNestaFaixa > 0) {
                const funcionariosJaCobrados = Math.max(0, inicioDaFaixa - configuracaoPrecos.funcionariosInclusos -1)
                total += (funcionariosNestaFaixa - funcionariosJaCobrados) * faixa.valor;
            }
        }
    }
    return total;
}


// ENDPOINT 1: Informa ao front-end o status da empresa
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


// ENDPOINT 2: Cria a preferência de pagamento
app.post('/create-preference', async (req, res) => {
    try {
        const { userId, planoEscolhido } = req.body;

        if (!userId || !planoEscolhido || !planoEscolhido.totalFuncionarios) {
            return res.status(400).json({ error: 'Dados insuficientes.' });
        }

        // Recalcula o preço no servidor baseado no plano ESCOLHIDO para garantir segurança
        const precoCalculadoNoServidor = calcularPrecoNoServidor(planoEscolhido.totalFuncionarios);
        const descricaoDoItem = `Plano Pronti para até ${planoEscolhido.totalFuncionarios} funcionário(s)`;

        // Gera o pagamento com o valor do plano escolhido.
        const preference = {
            items: [{
                title: descricaoDoItem,
                unit_price: parseFloat(precoCalculadoNoServidor.toFixed(2)),
                quantity: 1,
            }],
            back_urls: {
                success: `https://seusite.com/sucesso.html`, // Altere para seu site
                failure: `https://seusite.com/pagamento.html`, // Altere para seu site
                pending: `https://seusite.com/pagamento.html`, // Altere para seu site
            },
            auto_return: 'approved'
        };
        
        const response = await mercadopago.preferences.create(preference);
        res.json({ init_point: response.body.init_point });

    } catch (error) {
        console.error("Erro no servidor ao criar preferência:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});


const PORT = 4242;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}!`));
