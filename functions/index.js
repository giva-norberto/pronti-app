/**
 * Cloud Functions backend para pagamentos e notificações Pronti.
 * VERSÃO 5.1: Ajuste de segurança no CORS para produção e correção de DB.
 */

// ============================ Imports principais ==============================
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// ========================= Inicialização do Firebase ==========================
try {
  admin.initializeApp();
} catch (e) {
  functions.logger.warn("Firebase Admin já inicializado.");
}

// ✅ CORREÇÃO DE AMBIGUIDADE: Força o uso do banco de dados '(default)'.
const dbFinal = admin.firestore(admin.app().options.databaseURL);
const fcm = admin.messaging();

// =========================== Configuração de CORS =============================
// ✅ REVISÃO DE SEGURANÇA: Limitando o acesso apenas ao seu domínio de produção.
const whitelist = [
  "https://prontiapp.com.br"
  // Se precisar testar localmente no futuro, descomente a linha abaixo:
  // "http://localhost:3000"
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
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
      }
      try {
        const { empresaId } = req.body;
        if (!empresaId) {
          return res.status(400).json({ error: "ID da empresa inválido ou não fornecido." });
        }
        const empresaDocRef = dbFinal.collection("empresarios").doc(empresaId);
        const empresaDoc = await empresaDocRef.get();
        if (!empresaDoc.exists) {
          return res.status(404).json({ error: "Empresa não encontrada." });
        }
        const plano = empresaDoc.get("plano") || "free";
        const status = empresaDoc.get("status") || "";
        if (plano === "free" && status === "expirado") {
          return res.status(403).json({ error: "Assinatura gratuita expirada. Por favor, selecione um plano." });
        }
        let licencasNecessarias = 0;
        try {
          const profissionaisSnapshot = await empresaDocRef.collection("profissionais").get();
          licencasNecessarias = profissionaisSnapshot.size;
        } catch (profErr) {
          functions.logger.warn("Erro ao buscar profissionais, assumindo 0.", { error: profErr });
        }
        return res.status(200).json({ licencasNecessarias });
      } catch (error) {
        functions.logger.error("Erro fatal em verificarEmpresa:", error);
        return res.status(500).json({ error: "Erro interno do servidor.", detalhes: error.message });
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
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido." });
      }
      try {
        const client = getMercadoPagoClient();
        if (!client) {
          return res.status(500).json({ error: "Erro de configuração do servidor." });
        }
        const { userId, planoEscolhido } = req.body;
        if (!userId || !planoEscolhido) {
          return res.status(400).json({ error: "Dados inválidos." });
        }
        const userRecord = await admin.auth().getUser(userId);
        const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
        const notificationUrl = `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/receberWebhookMercadoPago`;
        const subscriptionData = {
          reason: `Assinatura Pronti - Plano ${planoEscolhido.totalFuncionarios} licenças`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: precoFinal,
            currency_id: "BRL",
          },
          back_url: "https://prontiapp.com.br/pagamento-confirmado",
          payer_email: userRecord.email,
          notification_url: notificationUrl,
        };
        const preapproval = new Preapproval(client);
        const response = await preapproval.create({ body: subscriptionData });
        await dbFinal.collection("empresarios").doc(userId).collection("assinatura").doc("dados").set({
          mercadoPagoAssinaturaId: response.id,
          status: "pendente",
          planoContratado: planoEscolhido.totalFuncionarios,
          valorPago: precoFinal,
          dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return res.status(200).json({ init_point: response.init_point });
      } catch (error) {
        functions.logger.error("Erro em createPreference:", error);
        return res.status(500).json({ error: "Erro ao criar preferência de pagamento.", detalhes: error.message });
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
          const client = getMercadoPagoClient();
          if (!client) {
            return res.status(500).send("Erro de configuração interna.");
          }
          const preapproval = new Preapproval(client);
          const subscription = await preapproval.get({ id: id });
          const query = dbFinal.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", subscription.id);
          const snapshot = await query.get();
          if (snapshot.empty) {
            functions.logger.warn("Webhook para assinatura não encontrada no Firestore:", { id: subscription.id });
            return res.status(200).send("OK. Assinatura não encontrada.");
          }
          const statusMap = {
            authorized: "ativa",
            cancelled: "cancelada",
            paused: "pausada",
          };
          const novoStatus = statusMap[subscription.status] || "desconhecido";
          for (const doc of snapshot.docs) {
            await doc.ref.update({
              status: novoStatus,
              ultimoStatusMP: subscription.status,
              ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (error) {
          functions.logger.error("Erro ao processar webhook:", error);
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
  if (!mpToken) {
    functions.logger.error("FATAL: O secret MERCADOPAGO_TOKEN não está configurado ou acessível!");
    return null;
  }
  return new MercadoPagoConfig({ accessToken: mpToken });
}

function calcularPreco(totalFuncionarios) {
  const precoBase = 59.9;
  const funcionariosInclusos = 2;
  if (totalFuncionarios <= 0) return 0;
  if (totalFuncionarios <= funcionariosInclusos) return precoBase;
  let precoTotal = precoBase;
  const funcionariosExtras = totalFuncionarios - funcionariosInclusos;
  precoTotal += funcionariosExtras * 29.9; // Exemplo de preço por funcionário extra
  return Number(precoTotal.toFixed(2));
}

// ============================================================================
// FUNÇÃO DE NOTIFICAÇÃO
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  {
    document: "filaDeNotificacoes/{bilheteId}",
    // ✅ CORREÇÃO DE AMBIGUIDADE: Especifica o database '(default)' no gatilho.
    database: "(default)",
    region: "southamerica-east1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
        functions.logger.error("[FCM] Evento de criação sem dados (snapshot).");
        return;
    }
    const bilhete = snap.data();
    const bilheteId = event.params.bilheteId;
    
    if (!bilhete || !bilhete.paraDonoId) {
      functions.logger.warn(`[FCM] Bilhete inválido: ${bilheteId}. Marcando como 'falha'.`);
      return snap.ref.update({ status: 'falha', motivo: 'paraDonoId ausente' });
    }

    try {
      const tokenDoc = await dbFinal.collection('mensagensTokens').doc(bilhete.paraDonoId).get();
      
      if (!tokenDoc.exists() || !tokenDoc.data().fcmToken) {
        functions.logger.warn(`[FCM] Token não encontrado para dono: ${bilhete.paraDonoId}. Marcando como 'falha'.`);
        return snap.ref.update({ status: 'falha', motivo: 'Token FCM não encontrado ou vazio' });
      }
      
      const fcmToken = tokenDoc.data().fcmToken;

      const message = {
        token: fcmToken,
        notification: {
          title: bilhete.titulo || 'Nova Notificação',
          body: bilhete.mensagem || 'Você recebeu uma nova mensagem',
        },
        data: {
          bilheteId: bilheteId,
          status: String(bilhete.status || 'pendente'),
        },
      };

      await fcm.send(message);
      functions.logger.info(`[FCM] Notificação enviada para: ${bilhete.paraDonoId}`, { bilheteId });
      return snap.ref.update({ status: 'processado', enviadoEm: admin.firestore.FieldValue.serverTimestamp() });

    } catch (error) {
      functions.logger.error(`[FCM] Erro ao enviar notificação para ${bilheteId}:`, error);
      return snap.ref.update({ status: 'erro', motivo: error.message || 'Erro desconhecido' });
    }
  }
);
