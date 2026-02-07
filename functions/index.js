/**
 * Cloud Functions backend para pagamentos e notificações Pronti.
 * VERSÃO CONSOLIDADA: Pagamentos, Notificações e Lembretes Automáticos.
 */

// ============================ Imports principais ==============================
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler"); // Import para o relógio
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// ========================= Inicialização do Firebase ==========================
const detectedProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "pronti-app-37c6e";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: detectedProjectId,
  });
}
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
      if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
      
      try {
        const { empresaId } = req.body;
        if (!empresaId) return res.status(400).json({ error: "ID da empresa não fornecido." });
        
        const empresaDoc = await db.collection("empresarios").doc(empresaId).get();
        if (!empresaDoc.exists) return res.status(404).json({ error: "Empresa não encontrada." });
        
        const profissionaisSnapshot = await db.collection("empresarios").doc(empresaId).collection("profissionais").get();
        return res.status(200).json({ licencasNecessarias: profissionaisSnapshot.size });
      } catch (error) {
        logger.error("Erro em verificarEmpresa:", error);
        return res.status(500).json({ error: "Erro interno." });
      }
    });
  }
);

// ============================================================================
// ENDPOINT 2: createPreference (Mercado Pago)
// ============================================================================
exports.createPreference = onRequest(
  { region: "southamerica-east1", secrets: ["MERCADOPAGO_TOKEN"] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).send("");
      try {
        const mpToken = process.env.MERCADOPAGO_TOKEN;
        const client = new MercadoPagoConfig({ accessToken: mpToken });
        const { userId, planoEscolhido } = req.body;
        
        const userRecord = await admin.auth().getUser(userId);
        const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
        
        const preapproval = new Preapproval(client);
        const response = await preapproval.create({
          body: {
            reason: `Assinatura Pronti - ${planoEscolhido.totalFuncionarios} licenças`,
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: precoFinal,
              currency_id: "BRL",
            },
            back_url: "https://prontiapp.com.br/pagamento-confirmado",
            payer_email: userRecord.email,
            notification_url: `https://southamerica-east1-${detectedProjectId}.cloudfunctions.net/receberWebhookMercadoPago`,
          }
        });

        await db.collection("empresarios").doc(userId).collection("assinatura").doc("dados").set({
          mercadoPagoAssinaturaId: response.id,
          status: "pendente",
          planoContratado: planoEscolhido.totalFuncionarios,
          valorPago: precoFinal,
          dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return res.status(200).json({ init_point: response.init_point });
      } catch (error) {
        logger.error("Erro em createPreference:", error);
        return res.status(500).json({ error: "Erro ao processar pagamento." });
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
      const { id, type } = req.body;
      if (type === "preapproval") {
        try {
          const mpToken = process.env.MERCADOPAGO_TOKEN;
          const client = new MercadoPagoConfig({ accessToken: mpToken });
          const preapproval = new Preapproval(client);
          const subscription = await preapproval.get({ id: id });
          
          const snapshot = await db.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", id).get();
          const statusMap = { authorized: "ativa", cancelled: "cancelada", paused: "pausada" };
          
          for (const doc of snapshot.docs) {
            await doc.ref.update({
              status: statusMap[subscription.status] || "desconhecido",
              ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (error) {
          logger.error("Erro no Webhook:", error);
        }
      }
      return res.status(200).send("OK");
    });
  }
);

// ============================================================================
// FUNÇÃO REATIVA: enviarNotificacaoFCM (Fila de Notificações)
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  { document: "filaDeNotificacoes/{bilheteId}", region: "southamerica-east1" },
  async (event) => {
    const bilhete = event.data.data();
    if (!bilhete || bilhete.status === "processado") return;

    const tokenSnap = await db.collection("mensagensTokens").doc(bilhete.donoId).get();
    if (!tokenSnap.exists || !tokenSnap.data().fcmToken) return event.data.ref.update({ status: "processado_sem_token" });

    const payload = {
      notification: {
        title: bilhete.titulo || "Notificação Pronti",
        body: bilhete.mensagem,
        icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
      },
      token: tokenSnap.data().fcmToken,
    };

    try {
      await fcm.send(payload);
      await event.data.ref.update({ status: "processado" });
    } catch (error) {
      logger.error("Erro ao enviar push:", error);
    }
  }
);

// ============================================================================
// NOVA FUNÇÃO: rotinaLembreteAgendamento (Relógio Sniper)
// Roda a cada 15 minutos buscando na coleção dedicada de lembretesPendentes.
// ============================================================================
exports.rotinaLembreteAgendamento = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "southamerica-east1",
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
  },
  async (event) => {
    const agora = admin.firestore.Timestamp.now();
    try {
      const snapshot = await db.collection("lembretesPendentes")
        .where("enviado", "==", false)
        .where("dataEnvio", "<=", agora)
        .get();

      if (snapshot.empty) return;

      const envios = snapshot.docs.map(async (doc) => {
        const lembrete = doc.data();
        const tokenSnap = await db.collection("mensagensTokens").doc(lembrete.clienteId).get();

        if (tokenSnap.exists && tokenSnap.data().fcmToken) {
          const payload = {
            notification: {
              title: "Lembrete Pronti ⏰",
              body: `Olá! Seu horário para ${lembrete.servicoNome} é em breve (${lembrete.horarioTexto}).`,
              icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media"
            },
            token: tokenSnap.data().fcmToken,
          };
          await fcm.send(payload);
        }
        return doc.ref.update({ enviado: true });
      });

      await Promise.all(envios);
    } catch (error) {
      logger.error("Erro na rotina de lembretes:", error);
    }
  }
);

// ============================ Auxiliares ======================================
function getMercadoPagoClient() {
  const mpToken = process.env.MERCADOPAGO_TOKEN;
  return mpToken ? new MercadoPagoConfig({ accessToken: mpToken }) : null;
}

function calcularPreco(total) {
  const base = 59.9;
  if (total <= 2) return base;
  return Number((base + (total - 2) * 29.9).toFixed(2));
}

exports.notificarClientes = require("./notifyClientes").notificarClientes;
