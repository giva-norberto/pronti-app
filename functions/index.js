/**
 * Cloud Functions backend para pagamentos e notificações Pronti.
 * VERSÃO ATUALIZADA: uso consistente de logger, inicialização do admin com projectId.
 */

// ============================ Imports principais ==============================
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger"); // logger compatível com v2
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// ========================= Inicialização do Firebase ==========================
// Garanta que o Admin SDK inicialize com o projectId correto.
// Isso evita problemas quando o ambiente não resolve automaticamente o projeto.
const detectedProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "pronti-app-37c6e";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: detectedProjectId,
    // NÃO definir databaseURL aqui a não ser que esteja usando Realtime Database.
    // databaseURL: "https://pronti-app-37c6e.firebaseio.com"
  });
}

// AJUSTE CRÍTICO: Conecta explicitamente ao seu banco nomeado para evitar erro 404
const db = admin.firestore("pronti-app"); 
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
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
      if (req.method !== "POST") {
        logger.info("DEBUG: Método não permitido", { method: req.method });
        return res.status(405).json({ error: "Método não permitido. Use POST." });
      }
      try {
        logger.info("DEBUG: INICIO verificarEmpresa", { body: req.body, headers: req.headers });
        const { empresaId } = req.body;
        if (!empresaId) {
          logger.info("DEBUG: Falta empresaId no body");
          return res.status(400).json({ error: "ID da empresa inválido ou não fornecido." });
        }
        const empresaDocRef = db.collection("empresarios").doc(empresaId);
        const empresaDoc = await empresaDocRef.get();
        if (!empresaDoc.exists) {
          logger.info("DEBUG: Empresa não encontrada", { empresaId });
          return res.status(404).json({ error: "Empresa não encontrada." });
        }
        const plano = empresaDoc.get("plano") || "free";
        const status = empresaDoc.get("status") || "";
        if (plano === "free" && status === "expirado") {
          logger.info("DEBUG: Plano free expirado", { empresaId });
          return res.status(403).json({ error: "Assinatura gratuita expirada. Por favor, selecione um plano." });
        }
        let licencasNecessarias = 0;
        try {
          const profissionaisSnapshot = await empresaDocRef.collection("profissionais").get();
          if (!profissionaisSnapshot.empty) {
            licencasNecessarias = profissionaisSnapshot.size;
          }
          logger.info("DEBUG: profissionaisSnapshot.size", { size: licencasNecessarias });
        } catch (profErr) {
          logger.warn("DEBUG: Erro ao buscar subcoleção profissionais, assumindo 0.", { error: profErr });
        }
        logger.info(`Sucesso: Empresa ${empresaId} possui ${licencasNecessarias} profissionais.`);
        return res.status(200).json({ licencasNecessarias });
      } catch (error) {
        logger.error("Erro fatal em verificarEmpresa:", error);
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
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
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
        const notificationUrl = `https://southamerica-east1-${detectedProjectId}.cloudfunctions.net/receberWebhookMercadoPago`;
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
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
      const { id, type } = req.body;
      if (type === "preapproval") {
        try {
          const client = getMercadoPagoClient();
          if (!client) {
            return res.status(500).send("Erro de configuração interna.");
          }
          const preapproval = new Preapproval(client);
          const subscription = await preapproval.get({ id: id });
          const query = db.collectionGroup("assinatura").where("mercadoPagoAssinaturaId", "==", subscription.id);
          const snapshot = await query.get();
          if (snapshot.empty) {
            return res.status(200).send("OK");
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
          logger.error("Erro ao processar webhook:", error);
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
    logger.error("FATAL: O secret MERCADOPAGO_TOKEN não está configurado ou acessível!");
    return null;
  }
  return new MercadoPagoConfig({ accessToken: mpToken });
}

function calcularPreco(totalFuncionarios) {
  const configuracaoPrecos = {
    precoBase: 59.9,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
      { de: 3, ate: 10, valor: 29.9 },
      { de: 11, ate: 50, valor: 24.9 },
    ],
  };
  if (totalFuncionarios <= 0) return 0;
  if (totalFuncionarios <= configuracaoPrecos.funcionariosInclusos) return configuracaoPrecos.precoBase;
  let precoTotal = configuracaoPrecos.precoBase;
  const funcionariosExtras = totalFuncionarios - configuracaoPrecos.funcionariosInclusos;
  let funcionariosJaPrecificados = 0;
  for (const faixa of configuracaoPrecos.faixasDePrecoExtra) {
    const funcionariosNaFaixa = faixa.ate - faixa.de + 1;
    const extrasNestaFaixa = Math.min(
      funcionariosExtras - funcionariosJaPrecificados,
      funcionariosNaFaixa
    );
    if (extrasNestaFaixa > 0) {
      precoTotal += extrasNestaFaixa * faixa.valor;
      funcionariosJaPrecificados += extrasNestaFaixa;
    }
    if (funcionariosJaPrecificados >= funcionariosExtras) break;
  }
  return Number(precoTotal.toFixed(2));
}

// ============================================================================
// FUNÇÃO DE NOTIFICAÇÃO (ATIVADA E PREENCHIDA)
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  {
    document: "filaDeNotificacoes/{bilheteId}",
    region: "southamerica-east1",
  },
  async (event) => {
    const bilhete = event.data && event.data.data ? event.data.data() : null;
    const bilheteId = event.params && event.params.bilheteId ? event.params.bilheteId : null;

    if (!bilhete) {
      logger.log("Bilhete vazio, encerrando.");
      return;
    }

    if (bilhete.status === "processado") {
      logger.log(`Bilhete ${bilheteId} já processado, ignorando.`);
      return;
    }

    const donoId = bilhete.donoId;
    const titulo = bilhete.titulo || "Notificação Pronti";
    const mensagem = bilhete.mensagem || "Você tem uma nova atividade.";

    if (!donoId) {
      logger.error(`Bilhete ${bilheteId} não tem donoId.`);
      return event.data.ref.update({ status: "processado_com_erro" });
    }

    logger.log(`Processando notificação para o dono: ${donoId}`);

    const tokenRef = db.collection("mensagensTokens").doc(donoId);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists || !tokenSnap.data().fcmToken) {
      logger.warn(`Token FCM não encontrado para o dono: ${donoId}.`);
      return event.data.ref.update({ status: "processado_sem_token" });
    }

    const fcmToken = tokenSnap.data().fcmToken;

    const payload = {
      notification: {
        title: titulo,
        body: mensagem,
        icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
        badge: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
      },
      webpush: {
        fcmOptions: {
          link: "https://prontiapp.com.br/agenda.html",
        },
      },
      token: fcmToken,
    };

    try {
      logger.log(`Enviando push para o token: ${fcmToken}`);
      await fcm.send(payload);
      logger.log("✅ Notificação Push enviada com sucesso!");
    } catch (error) {
      logger.error(`❌ Erro ao enviar Notificação Push para ${donoId}:`, error);
      if (error.code === "messaging/registration-token-not-registered") {
        await tokenRef.update({ fcmToken: admin.firestore.FieldValue.delete() });
      }
    }

    return event.data.ref.update({ status: "processado" });
  }
);

// ============================================================================
// NOVA FUNÇÃO: rotinaLembreteAgendamento (SNIPER PARA CONTAGEM-MG)
// ============================================================================
exports.rotinaLembreteAgendamento = onSchedule(
  {
    schedule: "0,15,30,45 * * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
  },
  async (event) => {
    const agora = admin.firestore.Timestamp.now();
    const limiteJanela = new Date(agora.toDate().getTime() + 20 * 60 * 1000);

    try {
      const snapshot = await db.collection("lembretesPendentes")
        .where("enviado", "==", false)
        .where("dataEnvio", "<=", admin.firestore.Timestamp.fromDate(limiteJanela))
        .get();

      if (snapshot.empty) return;

      const envios = snapshot.docs.map(async (doc) => {
        const lembrete = doc.data();
        const tokenSnap = await db.collection("mensagensTokens").doc(lembrete.clienteId).get();

        if (tokenSnap.exists && tokenSnap.data().fcmToken) {
          await fcm.send({
            notification: {
              title: "Lembrete Pronti ⏰",
              body: `Olá! Seu horário para ${lembrete.servicoNome} está chegando (${lembrete.horarioTexto}).`,
              icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media"
            },
            token: tokenSnap.data().fcmToken,
          });
        }
        return doc.ref.update({ enviado: true, processadoEm: admin.firestore.FieldValue.serverTimestamp() });
      });

      await Promise.all(envios);
    } catch (error) {
      logger.error("Erro na rotina de lembretes:", error);
    }
  }
);

// ============================================================================
// OUTRAS FUNÇÕES
// ============================================================================
exports.notificarClientes = require("./notifyClientes").notificarClientes;
