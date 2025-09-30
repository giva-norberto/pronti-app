/**
 * Cloud Functions backend para pagamentos Pronti.
 * VERSÃO FINALÍSSIMA 3.2: Ajustes finos na função de notificação.
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
  console.warn("Firebase Admin já inicializado.");
}

// 🔧 Ajuste: forçar uso do databaseId correto (pronti-app)
const dbInstance = admin.firestore();
dbInstance.settings({ databaseId: "pronti-app" });
const dbFinal = dbInstance;

const fcm = admin.messaging();

// =========================== Configuração de CORS =============================
const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000"
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) callback(null, true);
    else callback(new Error("Origem não permitida por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
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
        functions.logger.info("DEBUG: Método não permitido", { method: req.method });
        return res.status(405).json({ error: "Método não permitido. Use POST." });
      }

      try {
        functions.logger.info("DEBUG: INICIO verificarEmpresa", { body: req.body, headers: req.headers });

        const { empresaId } = req.body;
        functions.logger.info("DEBUG: empresaId recebido", { empresaId });

        if (!empresaId) {
          functions.logger.info("DEBUG: Falta empresaId no body");
          return res.status(400).json({ error: "ID da empresa inválido ou não fornecido." });
        }

        const empresaDocRef = dbFinal.collection("empresarios").doc(empresaId);
        const empresaDoc = await empresaDocRef.get();
        functions.logger.info("DEBUG: empresaDoc.exists", { exists: empresaDoc.exists, empresaId });

        if (!empresaDoc.exists) {
          functions.logger.info("DEBUG: Empresa não encontrada", { empresaId });
          return res.status(404).json({ error: "Empresa não encontrada." });
        }

        const plano = empresaDoc.get("plano") || "free";
        const status = empresaDoc.get("status") || "";
        functions.logger.info("DEBUG: Plano e status da empresa", { plano, status });

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
          licencasNecessarias = 0;
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
        functions.logger.info("DEBUG: Método não permitido", { method: req.method });
        return res.status(405).json({ error: "Método não permitido." });
      }
      try {
        functions.logger.info("DEBUG: INICIO createPreference", { body: req.body, headers: req.headers });

        const client = getMercadoPagoClient();
        if (!client) {
          functions.logger.error("DEBUG: Erro de configuração do MercadoPago client");
          return res.status(500).json({ error: "Erro de configuração do servidor." });
        }

        const { userId, planoEscolhido } = req.body;
        functions.logger.info("DEBUG: Dados recebidos", { userId, planoEscolhido });

        if (!userId || !planoEscolhido) {
          functions.logger.info("DEBUG: Dados inválidos no body");
          return res.status(400).json({ error: "Dados inválidos." });
        }
        const userRecord = await admin.auth().getUser(userId);
        functions.logger.info("DEBUG: userRecord.email", { email: userRecord.email });

        const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
        functions.logger.info("DEBUG: precoFinal calculado", { precoFinal });

        const notificationUrl =
          "https://southamerica-east1-pronti-app-3C6E.cloudfunctions.net/receberWebhookMercadoPago";

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
        functions.logger.info("DEBUG: subscriptionData", subscriptionData);

        const preapproval = new Preapproval(client);
        const response = await preapproval.create({ body: subscriptionData });
        functions.logger.info("DEBUG: Resposta do MercadoPago", { response });

        await dbFinal
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
        functions.logger.info("DEBUG: Dados da assinatura salvos no Firestore");

        return res.status(200).json({ init_point: response.init_point });
      } catch (error) {
        functions.logger.error("Erro em createPreference:", error);
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

      functions.logger.info("DEBUG: Webhook recebido", { body: req.body });
      const { id, type } = req.body;
      if (type === "preapproval") {
        try {
          const client = getMercadoPagoClient();
          if (!client) {
            functions.logger.error("DEBUG: Erro de configuração do MercadoPago client");
            return res.status(500).send("Erro de configuração interna.");
          }
          const preapproval = new Preapproval(client);
          const subscription = await preapproval.get({ id: id });
          functions.logger.info("DEBUG: Subscription MercadoPago", { subscription });

          const assinaturaId = subscription.id;
          const statusMP = subscription.status;
          const query = dbFinal
            .collectionGroup("assinatura")
            .where("mercadoPagoAssinaturaId", "==", assinaturaId);
          const snapshot = await query.get();
          functions.logger.info("DEBUG: snapshot assinaturas", { empty: snapshot.empty, docs: snapshot.docs.length });

          if (snapshot.empty) return res.status(200).send("OK");
          const novoStatus =
            statusMP === "authorized"
              ? "ativa"
              : statusMP === "cancelled"
              ? "cancelada"
              : statusMP === "paused"
              ? "pausada"
              : "desconhecido";
          for (const doc of snapshot.docs) {
            await doc.ref.update({
              status: novoStatus,
              ultimoStatusMP: statusMP,
              ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp()
            });
            functions.logger.info("DEBUG: Atualizada assinatura Firestore", { docId: doc.id, novoStatus });
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
  const configuracaoPrecos = {
    precoBase: 59.9,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
      { de: 3, ate: 10, valor: 29.9 },
      { de: 11, ate: 50, valor: 24.9 }
    ]
  };
  if (totalFuncionarios <= 0) return 0;
  if (totalFuncionarios <= configuracaoPrecos.funcionariosInclusos)
    return configuracaoPrecos.precoBase;
  let precoTotal = configuracaoPrecos.precoBase;
  const funcionariosExtras =
    totalFuncionarios - configuracaoPrecos.funcionariosInclusos;
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
// ENDPOINT DE TESTE: testeConexao
// ============================================================================
exports.testeConexao = onRequest({ region: "southamerica-east1" }, async (req, res) => {
  functions.logger.info("Iniciando teste de conexão...");
  try {
    await dbFinal.collection("_test_canary").limit(1).get();
    functions.logger.info("SUCESSO: Conexão com Firestore está OK.");
    res.status(200).send("Conexão com Firestore OK.");
  } catch (error) {
    functions.logger.error("FALHA NO TESTE: Não foi possível conectar ao Firestore.", {
      errorMessage: error.message,
      errorCode: error.code,
    });
    res.status(500).send("Falha ao conectar com o Firestore: " + error.message);
  }
});

// ============================================================================
// ENDPOINT DE TESTE DE DIAGNÓSTICO
// ============================================================================
exports.testeFirestoreDireto = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    const idFixo = "E8WgwQsEzJX0ryq8juqh"; // O ID que sabemos que existe
    functions.logger.info(`Iniciando teste direto com o ID fixo: ${idFixo}`);
    
    try {
      const docRef = dbFinal.collection("empresarios").doc(idFixo);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        functions.logger.info("SUCESSO! Documento encontrado.", docSnap.data());
        res.status(200).send(`SUCESSO! O documento ${idFixo} foi encontrado.`);
      } else {
        functions.logger.error("FALHA NO TESTE: Documento não encontrado, embora exista.", { id: idFixo });
        res.status(404).send(`FALHA! O documento ${idFixo} não foi encontrado pela função.`);
      }
    } catch (error) {
      functions.logger.error("FALHA CRÍTICA NO TESTE DIRETO:", error);
      res.status(500).send("FALHA CRÍTICA: " + error.message);
    }
  }
);

// ============================================================================
// NOVA FUNÇÃO: Escuta filaDeNotificacoes e envia push FCM (REVISADA)
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  // REVISÃO: Definindo explicitamente o databaseId e a região para consistência.
  {
    document: "filaDeNotificacoes/{bilheteId}",
    database: "pronti-app",
    region: "southamerica-east1",
  },
  async (event) => {
    // REVISÃO: Usando event.data para obter o snapshot, que é o padrão do v2.
    const snap = event.data;
    if (!snap) {
        functions.logger.error("[FCM] Evento de criação de documento sem dados (snapshot).");
        return;
    }
    const bilhete = snap.data();
    const bilheteId = event.params.bilheteId;

    functions.logger.info(`[FCM] Novo bilhete na fila: ${bilheteId}`, { bilhete });
    
    // Sua lógica de validação (mantida)
    if (!bilhete || !bilhete.paraDonoId) {
      functions.logger.warn(`[FCM] Bilhete inválido ou sem paraDonoId: ${bilheteId}. Marcando como 'falha'.`);
      return snap.ref.update({ status: 'falha', motivo: 'paraDonoId ausente' });
    }

    try {
      // REVISÃO: Usando a instância 'dbFinal' que você configurou no início do arquivo.
      const tokenDoc = await dbFinal.collection('mensagensTokens').doc(bilhete.paraDonoId).get();
      
      if (!tokenDoc.exists()) {
        functions.logger.warn(`[FCM] Nenhum documento de token encontrado para donoId: ${bilhete.paraDonoId}. Marcando como 'falha'.`);
        return snap.ref.update({ status: 'falha', motivo: 'Documento de token não encontrado' });
      }

      const fcmToken = tokenDoc.data().fcmToken;
      if (!fcmToken) {
        functions.logger.warn(`[FCM] Campo fcmToken vazio para donoId: ${bilhete.paraDonoId}. Marcando como 'falha'.`);
        return snap.ref.update({ status: 'falha', motivo: 'Campo fcmToken vazio' });
      }

      // Sua lógica de montagem da mensagem (mantida)
      const message = {
        token: fcmToken,
        notification: {
          title: bilhete.titulo || 'Nova Notificação',
          body: bilhete.mensagem || 'Você recebeu uma nova mensagem'
        },
        data: {
          bilheteId: bilheteId,
          status: String(bilhete.status || 'pendente') // REVISÃO: Garantindo que o valor seja uma string.
        }
      };

      // Sua lógica de envio (mantida)
      await fcm.send(message);
      functions.logger.info(`[FCM] Notificação enviada com sucesso para donoId: ${bilhete.paraDonoId}`, { bilheteId });

      // Atualiza o status do bilhete para 'processado'
      return snap.ref.update({ status: 'processado', enviadoEm: admin.firestore.FieldValue.serverTimestamp() });

    } catch (error) {
      functions.logger.error(`[FCM] Erro ao processar notificação para bilhete ${bilheteId}:`, error);
      // REVISÃO: Em caso de erro, marca o bilhete com o motivo da falha para depuração.
      try {
        await snap.ref.update({ status: 'erro', motivo: error.message || 'Erro desconhecido' });
      } catch (updateError) {
        functions.logger.error(`[FCM] Falha ao tentar marcar o bilhete ${bilheteId} como 'erro':`, updateError);
      }
    }
  }
);
