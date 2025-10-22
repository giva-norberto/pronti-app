/**
 * Cloud Functions backend para pagamentos e notificações Pronti.
 * VERSÃO COM NOTIFICAÇÕES ATIVADAS E CORREÇÃO DE LOCALIZAÇÃO.
 */

// ============================ Imports principais ==============================
const { onRequest } = require("firebase-functions/v2/https");
// ✅ IMPORTAÇÃO ATIVADA
const { onDocumentCreated } = require("firebase-functions/v2/firestore"); 
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// ========================= Inicialização do Firebase ==========================
// ✅ CORREÇÃO DE LOCALIZAÇÃO: Especifica a URL do seu banco de dados.
// Isso corrige o erro "database '(default)' does not exist".
if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: "https://pronti-app-37c6e.firebaseio.com" 
  });
}
const db = admin.firestore();
// ✅ MESSAGING ATIVADO
const fcm = admin.messaging(); 

// =========================== Configuração de CORS =============================
const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000",
];
const corsOptions = {
  origin: function (origin, callback ) {
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
// ENDPOINT 1: verificarEmpresa (Sua Lógica Original)
// ============================================================================
exports.verificarEmpresa = onRequest(
  { region: "southamerica-east1", secrets: ["MERCADOPAGO_TOKEN"] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
      if (req.method !== "POST") {
        functions.logger.info("DEBUG: Método não permitido", { method: req.method });
        return res.status(405).json({ error: "Método não permitido. Use POST." });
      }
      try {
        functions.logger.info("DEBUG: INICIO verificarEmpresa", { body: req.body, headers: req.headers });
        const { empresaId } = req.body;
        if (!empresaId) {
          functions.logger.info("DEBUG: Falta empresaId no body");
          return res.status(400).json({ error: "ID da empresa inválido ou não fornecido." });
        }
        const empresaDocRef = db.collection("empresarios").doc(empresaId);
        const empresaDoc = await empresaDocRef.get();
        if (!empresaDoc.exists) {
          functions.logger.info("DEBUG: Empresa não encontrada", { empresaId });
          return res.status(404).json({ error: "Empresa não encontrada." });
        }
        const plano = empresaDoc.get("plano") || "free";
        const status = empresaDoc.get("status") || "";
        if (plano === "free" && status === "expirado") {
          functions.logger.info("DEBUG: Plano free expirado", { empresaId });
          return res.status(403).json({ error: "Assinatura gratuita expirada. Por favor, selecione um plano." });
        }
        let licencasNecessarias = 0;
        try {
          const profissionaisSnapshot = await empresaDocRef.collection("profissionais").get();
          if (!profissionaisSnapshot.empty) {
            licencasNecessarias = profissionaisSnapshot.size;
          }
          functions.logger.info("DEBUG: profissionaisSnapshot.size", { size: licencasNecessarias });
        } catch (profErr) {
          functions.logger.warn("DEBUG: Erro ao buscar subcoleção profissionais, assumindo 0.", { error: profErr });
        }
        functions.logger.info(`Sucesso: Empresa ${empresaId} possui ${licencasNecessarias} profissionais.`);
        return res.status(200).json({ licencasNecessarias });
      } catch (error) {
        functions.logger.error("Erro fatal em verificarEmpresa:", error);
        return res.status(500).json({ error: "Erro interno do servidor.", detalhes: error.message || error.toString() });
      }
    });
  }
);

// ============================================================================
// ENDPOINT 2: createPreference (Sua Lógica Original)
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
        return res.status(500).json({ error: "Erro ao criar preferência de pagamento.", detalhes: error.message || error.toString() });
      }
    });
  }
);

// ============================================================================
// ENDPOINT 3: receberWebhookMercadoPago (Sua Lógica Original)
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
          functions.logger.error("Erro ao processar webhook:", error);
          return res.status(500).send("Erro interno");
        }
      }
      return res.status(200).send("OK");
    });
  }
);

// ============================================================================
// FUNÇÕES AUXILIARES (Sua Lógica Original)
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
// ✅ FUNÇÃO DE NOTIFICAÇÃO (ATIVADA E PREENCHIDA)
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  {
    document: "filaDeNotificacoes/{bilheteId}",
    database: "(default)",
    region: "southamerica-east1", // Especifica a região da função
  },
  async (event) => {
    
    // Pega os dados do novo documento (o "bilhete" de notificação)
    const bilhete = event.data.data();
    const bilheteId = event.params.bilheteId;

    if (!bilhete) {
        functions.logger.log("Bilhete vazio, encerrando.");
        return;
    }

    // Se o bilhete já foi processado (pelo app aberto), não faz nada.
    if (bilhete.status === "processado") {
        functions.logger.log(`Bilhete ${bilheteId} já processado, ignorando.`);
        return;
    }

    const donoId = bilhete.donoId;
    const titulo = bilhete.titulo || "Notificação Pronti";
    const mensagem = bilhete.mensagem || "Você tem uma nova atividade.";

    if (!donoId) {
        functions.logger.error(`Bilhete ${bilheteId} não tem donoId.`);
        // Marca como processado para não tentar de novo
        return event.data.ref.update({ status: "processado_com_erro" });
    }

    functions.logger.log(`Processando notificação para o dono: ${donoId}`);

    // 1. Buscar o Token FCM do dono na coleção 'mensagensTokens'
    const tokenRef = db.collection("mensagensTokens").doc(donoId);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists || !tokenSnap.data().fcmToken) {
        functions.logger.warn(`Token FCM não encontrado para o dono: ${donoId}.`);
        // Marca como processado mesmo assim
        return event.data.ref.update({ status: "processado_sem_token" });
    }

    const fcmToken = tokenSnap.data().fcmToken;

    // 2. Montar o payload da notificação push
    const payload = {
        notification: {
            title: titulo,
            body: mensagem,
            // (Opcional) Use o seu ícone do PWA
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.firebasestorage.app/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media&token=e01a4e43-a304-4550-8573-c1c15059d164", 
            badge: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.firebasestorage.app/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media&token=e01a4e43-a304-4550-8573-c1c15059d164"
        },
        webpush: {
            fcmOptions: {
                link: "https://prontiapp.com.br/agenda.html" // O que abre ao clicar
            }
        },
        token: fcmToken
    };

    // 3. Enviar a mensagem
    try {
        functions.logger.log(`Enviando push para o token: ${fcmToken}`);
        await fcm.send(payload);
        functions.logger.log("✅ Notificação Push enviada com sucesso!");
    } catch (error) {
        functions.logger.error(`❌ Erro ao enviar Notificação Push para ${donoId}:`, error);
        // Se o token for inválido, apaga ele para não tentar de novo
        if (error.code === 'messaging/registration-token-not-registered') {
            await tokenRef.update({ fcmToken: admin.firestore.FieldValue.delete() });
        }
    }

    // 4. Marcar o bilhete como processado
    // (Isso impede que o 'messaging.js' no app aberto tente processar de novo)
    return event.data.ref.update({ status: "processado" });
  }
);
