/**
 * Cloud Functions backend para pagamentos Pronti.
 * VERSÃO FINAL: Código 100% compatível com Cloud Functions v2 e uso moderno de secrets.
 */

// CORREÇÃO: Apenas o 'onRequest' é necessário do v2/https.
const { onRequest } = require("firebase-functions/v2/https");

// CORREÇÃO: Removido o import do 'defineString', que é da sintaxe antiga e causava o erro.
// const { defineString } = require('firebase-functions/v2/params');

// Mantemos os outros pacotes que já estavam corretos.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// Inicialização do Firebase Admin (sem alterações).
try { admin.initializeApp(); } catch (e) { console.warn("Firebase Admin já inicializado."); }
const db = admin.firestore();

// CORREÇÃO: A variável 'mercadopagoToken' foi removida. O token será acessado de forma segura dentro das funções.

// Whitelist de domínios e configuração de CORS (sem alterações, já estava correto).
const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000"
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) callback(null, true);
    else callback(new Error('Origem não permitida por CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
// Criamos o handler do CORS uma vez para reutilizar.
const corsHandler = cors(corsOptions);

// CORREÇÃO: Removida a função 'handleCorsPreflight'. O pacote 'cors' já lida
// com as requisições OPTIONS (preflight) automaticamente quando usado da forma correta.

// =================================================================================
// ENDPOINT 1: verificarEmpresa
// =================================================================================
// CORREÇÃO: O nome do secret é passado como uma string "MERCADOPAGO_TOKEN".
exports.verificarEmpresa = onRequest({ region: "us-central1", secrets: ["MERCADOPAGO_TOKEN"] }, (req, res) => {
  // CORREÇÃO: Simplificado o uso do CORS. O handler envolve toda a lógica.
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }
    try {
      const { empresaId } = req.body;
      if (!empresaId) {
        return res.status(400).json({ error: 'ID da empresa inválido ou não fornecido.' });
      }
      const profissionaisSnapshot = await db.collection('empresarios').doc(empresaId).collection('profissionais').get();
      const licencasNecessarias = profissionaisSnapshot.size;
      functions.logger.info(`Sucesso: Empresa ${empresaId} possui ${licencasNecessarias} profissionais.`);
      return res.status(200).json({ licencasNecessarias });
    } catch (error) {
      functions.logger.error("Erro em verificarEmpresa:", error);
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });
});

// =================================================================================
// ENDPOINT 2: createPreference
// =================================================================================
// CORREÇÃO: O nome do secret é passado como uma string "MERCADOPAGO_TOKEN".
exports.createPreference = onRequest({ region: "us-central1", secrets: ["MERCADOPAGO_TOKEN"] }, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido.' });
    }
    try {
      // A função getMercadoPagoClient agora vai funcionar corretamente.
      const client = getMercadoPagoClient();
      if (!client) return res.status(500).json({ error: 'Erro de configuração do servidor.' });
      
      const { userId, planoEscolhido } = req.body;
      if (!userId || !planoEscolhido) {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }
      const userRecord = await admin.auth().getUser(userId);
      const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
      const notificationUrl = "https://us-central1-pronti-app-37c6e.cloudfunctions.net/receberWebhookMercadoPago";
      const subscriptionData = {
        reason: `Assinatura Pronti - Plano ${planoEscolhido.totalFuncionarios} licenças`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: precoFinal,
          currency_id: "BRL"
        },
        back_url: "https://prontiapp.com.br/pagamento-confirmado",
        payer_email: userRecord.email,
        notification_url: notificationUrl
      };
      const preapproval = new Preapproval(client);
      const response = await preapproval.create({ body: subscriptionData });
      await db.collection("empresarios").doc(userId).collection("assinatura").doc("dados").set({
        mercadoPagoAssinaturaId: response.id,
        status: "pendente",
        planoContratado: planoEscolhido.totalFuncionarios,
        valorPago: precoFinal,
        dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.status(200).json({ init_point: response.init_point });
    } catch (error) {
      functions.logger.error("Erro em createPreference:", error);
      return res.status(500).json({ error: 'Erro ao criar preferência de pagamento.' });
    }
  });
});

// =================================================================================
// ENDPOINT 3: receberWebhookMercadoPago
// =================================================================================
// CORREÇÃO: O nome do secret é passado como uma string "MERCADOPAGO_TOKEN".
exports.receberWebhookMercadoPago = onRequest({ region: "us-central1", secrets: ["MERCADOPAGO_TOKEN"] }, (req, res) => {
  // Webhooks não precisam de CORS, mas mantemos o handler para consistência.
  corsHandler(req, res, async () => {
    console.log("Webhook recebido:", req.body);
    const { id, type } = req.body;
    if (type === "preapproval") {
      try {
        const client = getMercadoPagoClient();
        if (!client) return res.status(500).send("Erro de configuração interna.");
        const preapproval = new Preapproval(client);
        const subscription = await preapproval.get({ id: id });
        const assinaturaId = subscription.id;
        const statusMP = subscription.status;
        const query = db.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", assinaturaId);
        const snapshot = await query.get();
        if (snapshot.empty) return res.status(200).send("OK");
        let novoStatus = statusMP === "authorized" ? "ativa"
          : (statusMP === "cancelled" ? "cancelada"
          : (statusMP === "paused" ? "pausada" : "desconhecido"));
        for (const doc of snapshot.docs) {
          await doc.ref.update({
            status: novoStatus,
            ultimoStatusMP: statusMP,
            ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (error) {
        functions.logger.error("Erro ao processar webhook:", error);
        return res.status(500).send("Erro interno");
      }
    }
    return res.status(200).send("OK");
  });
});

// =================================================================================
// FUNÇÕES AUXILIARES
// =================================================================================
function getMercadoPagoClient() {
  // CORREÇÃO FINAL: Acessamos o valor do secret que o Firebase injeta
  // automaticamente nas variáveis de ambiente do processo.
  const mpToken = process.env.MERCADOPAGO_TOKEN;

  if (!mpToken) {
    functions.logger.error("FATAL: O secret MERCADOPAGO_TOKEN não está configurado ou acessível!");
    return null;
  }
  return new MercadoPagoConfig({ accessToken: mpToken });
}

// A função 'calcularPreco' não precisou de alterações.
function calcularPreco(totalFuncionarios) {
  const configuracaoPrecos = {
    precoBase: 59.90,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
      { de: 3, ate: 10, valor: 29.90 },
      { de: 11, ate: 50, valor: 24.90 }
    ]
  };
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
