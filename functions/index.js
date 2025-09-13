/**
 * Arquivo de Cloud Functions para o backend do sistema de pagamentos Pronti.
 * VERSÃO FINAL: Migrado para Cloud Functions v2.
 * SOLUÇÃO NUCLEAR: Função 'getStatusEmpresa' renomeada para 'verificarEmpresa' para forçar uma criação limpa.
 */

const { onRequest } = require("firebase-functions/v2/https" );
const functions = require("firebase-functions");

const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

try {
  admin.initializeApp();
} catch (e) {
  console.warn("Firebase Admin já inicializado.");
}
const db = admin.firestore();

const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000",
];
const corsOptions = {
  origin: function (origin, callback ) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida por CORS'));
    }
  },
};
const corsHandler = cors(corsOptions);

// =================================================================================
// ENDPOINT 1: RENOMEADO PARA 'verificarEmpresa'
// =================================================================================
exports.verificarEmpresa = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }
    try {
      const { empresaId } = req.body;
      if (!empresaId) {
        return res.status(400).json({ error: 'ID da empresa inválido ou não fornecido.' });
      }
      const funcionariosSnapshot = await db.collection('empresarios').doc(empresaId).collection('funcionarios').get();
      const licencasNecessarias = funcionariosSnapshot.size;
      return res.status(200).json({ licencasNecessarias });
    } catch (error) {
      functions.logger.error("Erro em verificarEmpresa:", error); // Log atualizado com o novo nome
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });
});

// =================================================================================
// ENDPOINT 2: createPreference (Sintaxe V2)
// =================================================================================
exports.createPreference = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }
    try {
      const client = getMercadoPagoClient();
      if (!client) {
        return res.status(500).json({ error: 'Erro de configuração do servidor.' });
      }
      const { userId, planoEscolhido } = req.body;
      if (!userId || !planoEscolhido) {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }
      const userRecord = await admin.auth().getUser(userId);
      const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
      const notificationUrl = `https://receberwebhookmercadopago-uzuwj4imfa-uc.a.run.app`;
      const subscriptionData = {
        reason: `Assinatura Pronti - Plano ${planoEscolhido.totalFuncionarios} licenças`,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: precoFinal, currency_id: "BRL" },
        back_url: "https://prontiapp.com.br/pagamento-confirmado",
        payer_email: userRecord.email,
        notification_url: notificationUrl
      };
      const preapproval = new Preapproval(client );
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
// ENDPOINT 3: receberWebhookMercadoPago (Sintaxe V2)
// =================================================================================
exports.receberWebhookMercadoPago = onRequest({ region: "us-central1" }, async (req, res) => {
  console.log("Webhook recebido:", req.body);
  const { id, type } = req.body;
  if (type === "preapproval") {
    try {
      const client = getMercadoPagoClient();
      if (!client) { return res.status(500).send("Erro de configuração interna."); }
      const preapproval = new Preapproval(client);
      const subscription = await preapproval.get({ id: id });
      const assinaturaId = subscription.id;
      const statusMP = subscription.status;
      const query = db.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", assinaturaId);
      const snapshot = await query.get();
      if (snapshot.empty) {
        return res.status(200).send("OK");
      }
      let novoStatus = statusMP === "authorized" ? "ativa" : (statusMP === "cancelled" ? "cancelada" : (statusMP === "paused" ? "pausada" : "desconhecido"));
      for (const doc of snapshot.docs) {
        await doc.ref.update({ status: novoStatus, ultimoStatusMP: statusMP, ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp() });
      }
    } catch (error) {
      functions.logger.error("Erro ao processar webhook:", error);
      return res.status(500).send("Erro interno");
    }
  }
  return res.status(200).send("OK");
});


// Funções auxiliares não mudam
function getMercadoPagoClient() {
  const mpToken = functions.config().mercadopago?.token;
  if (!mpToken) {
    functions.logger.error("FATAL: O token de acesso do Mercado Pago não está configurado!");
    return null;
  }
  return new MercadoPagoConfig({ accessToken: mpToken });
}

function calcularPreco(totalFuncionarios) {
  const configuracaoPrecos = { precoBase: 59.90, funcionariosInclusos: 2, faixasDePrecoExtra: [ { de: 3, ate: 10, valor: 29.90 }, { de: 11, ate: 50, valor: 24.90 }, ] };
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
