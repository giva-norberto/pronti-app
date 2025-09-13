/**
 * Arquivo de Cloud Functions para o backend do sistema de pagamentos Pronti.
 * VERSÃO CORRIGIDA.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

// Inicialização segura do Firebase Admin
try {
  admin.initializeApp();
} catch (e) {
  // Isso evita que a função quebre em ambientes de emulação onde ela pode ser recarregada.
  console.warn("Firebase Admin já inicializado.");
}
const db = admin.firestore();

// --- CONFIGURAÇÃO DE CORS ---
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
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
const corsHandler = cors(corsOptions);

// =================================================================================
// ENDPOINT 1: getStatusEmpresa (CORRIGIDO)
// =================================================================================
exports.getStatusEmpresa = functions.https.onRequest((req, res ) => {
  corsHandler(req, res, async () => {
    // LOG 1: Confirma que a função foi acionada.
    functions.logger.info("getStatusEmpresa: Função iniciada.", { method: req.method });

    if (req.method !== 'POST') {
      functions.logger.warn("getStatusEmpresa: Método não permitido.", { method: req.method });
      return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    try {
      // LOG 2: Mostra o corpo exato da requisição recebida. Essencial para depuração.
      functions.logger.info("getStatusEmpresa: Corpo da requisição recebido:", req.body);

      // A desestruturação pode falhar se req.body não for um objeto.
      const empresaId = req.body ? req.body.empresaId : undefined;

      // LOG 3: Mostra o valor de 'empresaId' após a extração.
      functions.logger.info(`getStatusEmpresa: Valor extraído para empresaId: '${empresaId}' (Tipo: ${typeof empresaId})`);

      // Verificação explícita e detalhada do 'empresaId'.
      if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        // LOG 4 (ERRO): Registra por que a validação falhou.
        functions.logger.error("getStatusEmpresa: Erro 400 - 'empresaId' inválido ou não fornecido.", {
          corpo_completo_recebido: req.body,
          empresaId_extraido: empresaId,
          tipo_de_empresaId: typeof empresaId,
        });
        // Retorna uma resposta de erro detalhada para o cliente.
        return res.status(400).json({ 
            error: 'ID da empresa inválido ou não fornecido.',
            debug_info: {
                received_body: req.body,
                extracted_id: empresaId,
                type: typeof empresaId
            }
        });
      }

      // LOG 5: Confirma que a validação passou e qual ID será usado.
      functions.logger.info(`getStatusEmpresa: Validação OK. Consultando Firestore para empresaId: ${empresaId}`);

      // <<< CORREÇÃO APLICADA AQUI: O nome da coleção foi ajustado de 'empresas' para 'empresarios'.
      const funcionariosSnapshot = await db.collection('empresarios').doc(empresaId).collection('funcionarios').get();
      const licencasNecessarias = funcionariosSnapshot.size;

      // LOG 6 (SUCESSO): Confirma que a consulta ao Firestore funcionou.
      functions.logger.info(`getStatusEmpresa: Sucesso! Empresa ${empresaId} possui ${licencasNecessarias} licenças.`);
      
      return res.status(200).json({ licencasNecessarias: licencasNecessarias });

    } catch (error) {
      // LOG 7 (ERRO CRÍTICO): Captura qualquer outro erro inesperado.
      functions.logger.error("getStatusEmpresa: Erro 500 - Falha crítica na execução.", {
        errorMessage: error.message,
        errorStack: error.stack,
        empresaId_processado: req.body ? req.body.empresaId : 'N/A'
      });
      return res.status(500).json({ 
          error: 'Erro interno do servidor ao processar a requisição.',
          debug_error_message: error.message
      });
    }
  });
});


// =================================================================================
// DEMAIS FUNÇÕES (com correção preventiva)
// =================================================================================

function getMercadoPagoClient() {
  const mpToken = functions.config().mercadopago?.token;
  if (!mpToken) {
    functions.logger.error("FATAL: O token de acesso do Mercado Pago não está configurado!");
    return null;
  }
  return new MercadoPagoConfig({ accessToken: mpToken });
}

exports.createPreference = functions.https.onRequest((req, res ) => {
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
      if (!userId || !planoEscolhido || !planoEscolhido.totalFuncionarios) {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }
      const userRecord = await admin.auth().getUser(userId);
      const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);
      if (precoFinal <= 0) {
        return res.status(400).json({ error: 'Plano inválido.' });
      }
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
      
      // <<< CORREÇÃO APLICADA AQUI: O nome da coleção foi ajustado de 'empresas' para 'empresarios'.
      await db.collection("empresarios").doc(userId).collection("assinatura").doc("dados").set({
        mercadoPagoAssinaturaId: response.id,
        status: "pendente",
        planoContratado: planoEscolhido.totalFuncionarios,
        valorPago: precoFinal,
        dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      return res.status(200).json({ init_point: response.init_point });
    } catch (error) {
      console.error("Erro em createPreference:", error);
      return res.status(500).json({ error: 'Erro ao criar preferência de pagamento.' });
    }
  });
});

exports.receberWebhookMercadoPago = functions.https.onRequest(async (req, res ) => {
  console.log("Webhook recebido:", req.body);
  const { id, type } = req.body;
  if (type === "preapproval") {
    try {
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
      let novoStatus = statusMP === "authorized" ? "ativa" :
        (statusMP === "cancelled" ? "cancelada" :
          (statusMP === "paused" ? "pausada" : "desconhecido"));
      for (const doc of snapshot.docs) {
        await doc.ref.update({
          status: novoStatus,
          ultimoStatusMP: statusMP,
          ultimaAtualizacaoWebhook: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      console.log(`Assinatura ${assinaturaId} atualizada para ${novoStatus}.`);
    } catch (error) {
      console.error("Erro ao processar webhook:", error);
      return res.status(500).send("Erro interno");
    }
  }
  return res.status(200).send("OK");
});

function calcularPreco(totalFuncionarios) {
  const configuracaoPrecos = {
    precoBase: 59.90,
    funcionariosInclusos: 2,
    faixasDePrecoExtra: [
      { de: 3, ate: 10, valor: 29.90 },
      { de: 11, ate: 50, valor: 24.90 },
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
