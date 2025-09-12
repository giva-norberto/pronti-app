/**
 * Arquivo de Cloud Functions para o backend do sistema de pagamentos Pronti.
 * CORREÇÃO FINAL: A inicialização do Mercado Pago foi movida para dentro das funções
 * para evitar erros de inicialização do contêiner.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURAÇÃO DE CORS ---
const whitelist = ["https://prontiapp.com.br", "https://prontiapp.vercel.app", "http://localhost:3000"];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido por CORS'));
    }
  }
};
const corsHandler = cors(corsOptions);

// --- FUNÇÃO AUXILIAR PARA INICIALIZAR O MERCADO PAGO ---
// Esta função garante que a configuração só é lida quando a função é executada.
function getMercadoPagoClient() {
    const mpToken = functions.config().mercadopago?.token;
    if (!mpToken) {
        functions.logger.error("FATAL: O token de acesso do Mercado Pago não está configurado!");
        return null;
    }
    return new MercadoPagoConfig({ accessToken: mpToken });
}

// =================================================================================
// LÓGICA DE CÁLCULO DE PREÇO
// =================================================================================
const configuracaoPrecos = {
    precoBase: 59.90,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
        { de: 3, ate: 10, valor: 29.90 },
        { de: 11, ate: 50, valor: 24.90 },
    ]
};
function calcularPreco(totalFuncionarios) {
    if (totalFuncionarios <= 0) return 0;
    if (totalFuncionarios <= configuracaoPrecos.funcionariosInclusos) return configuracaoPrecos.precoBase;
    let precoTotal = configuracaoPrecos.precoBase;
    const funcionariosExtras = totalFuncionarios - configuracaoPrecos.funcionariosInclusos;
    let funcionariosJaPrecificados = 0;
    for (const faixa of configuracaoPrecos.faixasDePrecoExtra) {
        const funcionariosNaFaixa = (faixa.ate - faixa.de) + 1;
        const extrasNestaFaixa = Math.min(funcionariosExtras - funcionariosJaPrecificados, funcionariosNaFaixa);
        if (extrasNestaFaixa > 0) {
            precoTotal += extrasNestaFaixa * faixa.valor;
            funcionariosJaPrecificados += extrasNestaFaixa;
        }
        if (funcionariosJaPrecificados >= funcionariosExtras) break;
    }
    return Number(precoTotal.toFixed(2));
}

// =================================================================================
// ENDPOINT 1: getStatusEmpresa
// =================================================================================
exports.getStatusEmpresa = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }
        try {
            const { userId } = req.body;
            if (!userId) return res.status(400).json({ error: 'ID do usuário não fornecido.' });
            const funcionariosSnapshot = await db.collection('empresas').doc(userId).collection('funcionarios').get();
            const licencasNecessarias = funcionariosSnapshot.size;
            return res.status(200).json({ licencasNecessarias });
        } catch (error) {
            console.error("Erro em getStatusEmpresa:", error);
            return res.status(500).json({ error: 'Erro interno ao buscar dados da empresa.' });
        }
    });
});

// =================================================================================
// ENDPOINT 2: createPreference
// =================================================================================
exports.createPreference = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }
        try {
            // Inicializa o cliente do MP aqui dentro
            const client = getMercadoPagoClient();
            if (!client) {
                return res.status(500).json({ error: 'Erro de configuração do servidor.' });
            }

            const { userId, planoEscolhido } = req.body;
            if (!userId || !planoEscolhido || !planoEscolhido.totalFuncionarios) return res.status(400).json({ error: 'Dados inválidos.' });
            
            const userRecord = await admin.auth().getUser(userId);
            const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
            if (precoFinal <= 0) return res.status(400).json({ error: 'Plano inválido.' });
            
            const notificationUrl = `https://us-central1-pronti-app-37cae.cloudfunctions.net/receberWebhookMercadoPago`;
            const subscriptionData = {
                reason: `Assinatura Pronti - Plano ${planoEscolhido.totalFuncionarios} licenças`,
                auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: precoFinal, currency_id: "BRL" },
                back_url: "https://prontiapp.com.br/pagamento-confirmado",
                payer_email: userRecord.email,
                notification_url: notificationUrl
            };
            
            const preapproval = new Preapproval(client);
            const response = await preapproval.create({ body: subscriptionData });
            
            await db.collection("empresas").doc(userId).collection("assinatura").doc("dados").set({
                mercadoPagoAssinaturaId: response.id, status: "pendente", planoContratado: planoEscolhido.totalFuncionarios, valorPago: precoFinal,
                dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            
            return res.status(200).json({ init_point: response.init_point });
        } catch (error) {
            console.error("Erro em createPreference:", error);
            return res.status(500).json({ error: 'Erro ao criar preferência de pagamento.' });
        }
    });
});

// =================================================================================
// ENDPOINT 3: receberWebhookMercadoPago
// =================================================================================
exports.receberWebhookMercadoPago = functions.https.onRequest(async (req, res) => {
    console.log("Webhook recebido:", req.body);
    const { id, type } = req.body;
    if (type === "preapproval") {
        try {
            // Inicializa o cliente do MP aqui dentro
            const client = getMercadoPagoClient();
            if (!client) {
                return res.status(500).send("Erro de configuração interna.");
            }

            const preapproval = new Preapproval(client);
            const subscription = await preapproval.get({ id: id });
            
            const assinaturaId = subscription.id;
            const statusMP = subscription.status;
            
            const query = db.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", assinaturaId);
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                console.warn(`Webhook: Assinatura com ID ${assinaturaId} não encontrada.`);
                return res.status(200).send("OK");
            }
            
            let novoStatus = statusMP === "authorized" ? "ativa" : (statusMP === "cancelled" ? "cancelada" : (statusMP === "paused" ? "pausada" : "desconhecido"));
            
            for (const doc of snapshot.docs) {
                await doc.ref.update({ status: novoStatus, ultimoStatusMP: statusMP, ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp() });
            }
            
            console.log(`Assinatura ${assinaturaId} atualizada para ${novoStatus}.`);
        } catch (error) {
            console.error("Erro ao processar webhook:", error);
            return res.status(500).send("Erro interno");
        }
    }
    return res.status(200).send("OK");
});
