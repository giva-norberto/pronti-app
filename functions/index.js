/**
 * Cloud Functions backend para pagamentos e notificações Pronti.
 * VERSÃO FINAL: Correção definitiva da conexão com o banco de dados e integração da função de notificação.
 */

// ============================ Imports principais ==============================
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// ========================= Inicialização do Firebase ==========================
if (!admin.apps.length) {
  admin.initializeApp();
}

// ✅ CORREÇÃO DEFINITIVA: Aponta para o banco de dados '(default)' explicitamente
const db = admin.firestore();
const fcm = admin.messaging();

// =========================== Configuração de CORS =============================
const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000",
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Origem não permitida por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
const corsHandler = cors(corsOptions);

// ============================================================================
// ENDPOINT 1: verificarEmpresa
// ============================================================================
exports.verificarEmpresa = onRequest(
  { region: "southamerica-east1", secrets: ["MERCADOPAGO_TOKEN"] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).send("");

      if (req.method !== "POST")
        return res.status(405).json({ error: "Método não permitido. Use POST." });

      try {
        const { empresaId } = req.body;
        if (!empresaId) return res.status(400).json({ error: "ID da empresa inválido." });

        const empresaDocRef = db.collection("empresarios").doc(empresaId);
        const empresaDoc = await empresaDocRef.get();
        if (!empresaDoc.exists) return res.status(404).json({ error: "Empresa não encontrada." });

        const plano = empresaDoc.get("plano") || "free";
        const status = empresaDoc.get("status") || "";
        if (plano === "free" && status === "expirado") return res.status(403).json({ error: "Assinatura gratuita expirada." });

        let licencasNecessarias = 0;
        try {
          const profissionaisSnapshot = await empresaDocRef.collection("profissionais").get();
          licencasNecessarias = profissionaisSnapshot.empty ? 0 : profissionaisSnapshot.size;
        } catch (profErr) {
          licencasNecessarias = 0;
        }

        return res.status(200).json({ licencasNecessarias });

      } catch (error) {
        return res.status(500).json({ error: "Erro interno do servidor.", detalhes: error.message || error.toString() });
      }
    });
  }
);

// ============================================================================
// ENDPOINT 2: createPreference
// ============================================================================
exports.createPreference = onRequest(
  { region: "southamerica-east1", secrets: ["MERCADOPAGO_TOKEN"] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

      try {
        const client = getMercadoPagoClient();
        if (!client) return res.status(500).json({ error: "Erro de configuração do servidor." });

        const { userId, planoEscolhido } = req.body;
        if (!userId || !planoEscolhido) return res.status(400).json({ error: "Dados inválidos." });

        const userRecord = await admin.auth().getUser(userId);
        const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);

        const notificationUrl = `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/receberWebhookMercadoPago`;

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

        await db
          .collection("empresarios")
          .doc(userId)
          .collection("assinatura")
          .doc("dados")
          .set(
            {
              mercadoPagoAssinaturaId: response.id,
              status: "pendente",
              planoContratado: planoEscolhido.totalFuncionarios,
              valorPago: precoFinal,
              dataCriacao: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );

        return res.status(200).json({ init_point: response.init_point });
      } catch (error) {
        return res.status(500).json({ error: "Erro ao criar preferência de pagamento.", detalhes: error.message || error.toString() });
      }
    });
  }
);

// ============================================================================
// ENDPOINT 3: receberWebhookMercadoPago
// ============================================================================
exports.receberWebhookMercadoPago = onRequest(
  { region: "southamerica-east1", secrets: ["MERCADOPAGO_TOKEN"] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).send("");

      const { id, type } = req.body;
      if (type === "preapproval") {
        try {
          const client = getMercadoPagoClient();
          if (!client) return res.status(500).send("Erro interno");

          const preapproval = new Preapproval(client);
          const subscription = await preapproval.get({ id: id });
          const assinaturaId = subscription.id;
          const statusMP = subscription.status;

          const query = db.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", assinaturaId);
          const snapshot = await query.get();
          if (snapshot.empty) return res.status(200).send("OK");

          const novoStatus =
            statusMP === "authorized" ? "ativa" :
            statusMP === "cancelled" ? "cancelada" :
            statusMP === "paused" ? "pausada" : "desconhecido";

          for (const doc of snapshot.docs) {
            await doc.ref.update({
              status: novoStatus,
              ultimoStatusMP: statusMP,
              ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        } catch (error) {
          return res.status(500).send("Erro interno");
        }
      }
      return res.status(200).send("OK");
    });
  }
);

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================
function getMercadoPagoClient() {
  const mpToken = process.env.MERCADOPAGO_TOKEN;
  if (!mpToken) return null;
  return new MercadoPagoConfig({ accessToken: mpToken });
}

function calcularPreco(totalFuncionarios) {
  const configuracaoPrecos = {
    precoBase: 59.9,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
      { de: 3, ate: 10, valor: 29.9 },
      { de: 11, ate: 50, valor: 24.9 }
    ]
  };
  if (totalFuncionarios <= 0) return 0;
  if (totalFuncionarios <= configuracaoPrecos.funcionariosInclusos) return configuracaoPrecos.precoBase;

  let precoTotal = configuracaoPrecos.precoBase;
  const funcionariosExtras = totalFuncionarios - configuracaoPrecos.funcionariosInclusos;
  let funcionariosJaPrecificados = 0;
  for (const faixa of configuracaoPrecos.faixasDePrecoExtra) {
    const funcionariosNaFaixa = faixa.ate - faixa.de + 1;
    const extrasNestaFaixa = Math.min(funcionariosExtras - funcionariosJaPrecificados, funcionariosNaFaixa);
    if (extrasNestaFaixa > 0) {
      precoTotal += extrasNestaFaixa * faixa.valor;
      funcionariosJaPrecificados += extrasNestaFaixa;
    }
    if (funcionariosJaPrecificados >= funcionariosExtras) break;
  }
  return Number(precoTotal.toFixed(2));
}

// ============================================================================
// FUNÇÃO DE NOTIFICAÇÃO FCM SEM VALIDAÇÃO DE ERROS
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  {
    document: "filaDeNotificacoes/{bilheteId}",
    database: "(default)",
    region: "southamerica-east1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const bilhete = snap.data();
    const bilheteId = event.params.bilheteId;

    // Mantém status pendente sempre
    await snap.ref.update({ status: 'pendente' }).catch(() => null);

    try {
      const tokenDoc = await db.collection('mensagensTokens').doc(bilhete.paraDonoId).get();
      const fcmToken = tokenDoc?.data()?.fcmToken || null;

      if (fcmToken) {
        const message = {
          token: fcmToken,
          notification: {
            title: bilhete.titulo || 'Nova Notificação',
            body: bilhete.mensagem || 'Você recebeu uma nova mensagem',
          },
          data: {
            bilheteId: bilheteId,
            tipo: bilhete.tipo || 'geral',
          },
        };
        await fcm.send(message);
      }

    } catch (error) {
      // Ignora erros, não altera status
    }

    return null;
  }
);
