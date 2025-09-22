/**
 * Cloud Functions backend para pagamentos Pronti.
 * VERSÃO FINALÍSSIMA 3.0: Corrige erro 5 NOT_FOUND em verificarEmpresa.
 * Região corrigida para southamerica-east1.
 * Tratamento explícito do método OPTIONS para CORS.
 * Melhoria: tratamento empresa não encontrada, plano free expirado e subcoleção vazia.
 * DEBUG detalhado adicionado em todos os endpoints.
 */

// ============================ Imports principais ==============================
const { onRequest } = require("firebase-functions/v2/https" );
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
const db = admin.firestore();

// =========================== Configuração de CORS =============================
const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000"
];
const corsOptions = {
  origin: function (origin, callback ) {
    if (!origin || whitelist.includes(origin)) callback(null, true);
    else callback(new Error("Origem não permitida por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
const corsHandler = cors(corsOptions);

// ============================================================================
// ENDPOINT 1: verificarEmpresa (VERSÃO CORRIGIDA PARA NOT_FOUND)
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

        const empresaDocRef = db.collection("empresarios").doc(empresaId);
        const empresaDoc = await empresaDocRef.get();
        functions.logger.info("DEBUG: empresaDoc.exists", { exists: empresaDoc.exists, empresaId });

        if (!empresaDoc.exists) {
          functions.logger.info("DEBUG: Empresa não encontrada", { empresaId });
          return res.status(404).json({ error: "Empresa não encontrada." });
        }

        // --- INÍCIO DA CORREÇÃO ---
        // Se a empresa existe, podemos prosseguir com segurança.
        const plano = empresaDoc.get("plano") || "free";
        const status = empresaDoc.get("status") || "";
        functions.logger.info("DEBUG: Plano e status da empresa", { plano, status });

        if (plano === "free" && status === "expirado") {
          functions.logger.info("DEBUG: Plano free expirado", { empresaId });
          return res.status(403).json({ error: "Assinatura gratuita expirada. Por favor, selecione um plano." });
        }

        // Agora, buscamos os profissionais. O try/catch aqui é uma segurança extra.
        let licencasNecessarias = 0;
        try {
          const profissionaisSnapshot = await empresaDocRef.collection("profissionais").get();
          if (!profissionaisSnapshot.empty) {
            licencasNecessarias = profissionaisSnapshot.size;
          }
          functions.logger.info("DEBUG: profissionaisSnapshot.size", { size: licencasNecessarias });
        } catch (profErr) {
          functions.logger.warn("DEBUG: Erro ao buscar subcoleção profissionais, assumindo 0.", { error: profErr });
          licencasNecessarias = 0; // Garante que o valor seja 0 em caso de erro.
        }
        // --- FIM DA CORREÇÃO ---

        functions.logger.info(`Sucesso: Empresa ${empresaId} possui ${licencasNecessarias} profissionais.`);
        return res.status(200).json({ licencasNecessarias });

      } catch (error) {
        // Este catch agora vai pegar outros erros inesperados.
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
      // 🔑 Preflight CORS
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
          "https://southamerica-east1-pronti-app-37c6e.cloudfunctions.net/receberWebhookMercadoPago";

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
        functions.logger.info("DEBUG: subscriptionData", subscriptionData );

        const preapproval = new Preapproval(client);
        const response = await preapproval.create({ body: subscriptionData });
        functions.logger.info("DEBUG: Resposta do MercadoPago", { response });

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
      // 🔑 Preflight CORS
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
          const query = db
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
