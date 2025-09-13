/**
 * Arquivo de Cloud Functions para o backend do sistema de pagamentos Pronti.
 * CORREÇÃO FINAL: A inicialização do Mercado Pago foi movida para dentro das funções
 * para evitar erros de inicialização do contêiner.
 * CORREÇÃO CORS: Permite corretamente OPTIONS e retorna headers CORS para chamadas frontend.
 * OTIMIZAÇÃO: Funções reescritas para lidar corretamente com a natureza assíncrona do middleware CORS.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURAÇÃO DE CORS ---
// A lista de origens permitidas.
const whitelist = [
  "https://prontiapp.com.br",
  "https://prontiapp.vercel.app",
  "http://localhost:3000", // Mantenha para desenvolvimento local
];

const corsOptions = {
  origin: function (origin, callback ) {
    // Permite requisições sem 'origin' (ex: Postman, apps mobile) e as da whitelist.
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Garante que POST e OPTIONS são permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Adicione outros cabeçalhos que seu frontend envia
};

// Cria um manipulador CORS que usaremos em todas as funções.
const corsHandler = cors(corsOptions);

// --- FUNÇÃO AUXILIAR PARA INICIALIZAR O MERCADO PAGO ---
function getMercadoPagoClient() {
  // Use secrets do Firebase para mais segurança: functions.config() está sendo descontinuado.
  const mpToken = functions.config().mercadopago?.token;
  if (!mpToken) {
    functions.logger.error("FATAL: O token de acesso do Mercado Pago não está configurado!");
    return null;
  }
  return new MercadoPagoConfig({ accessToken: mpToken });
}

// =================================================================================
// ENDPOINT 1: getStatusEmpresa (COM A CORREÇÃO PRINCIPAL)
// =================================================================================
exports.getStatusEmpresa = functions.https.onRequest((req, res ) => {
  // Envolve a lógica da função com o corsHandler.
  // Isso garante que a função espere o CORS ser processado antes de continuar.
  corsHandler(req, res, async () => {
    // O corsHandler já lida com a requisição OPTIONS (preflight).
    // Se o método não for POST, encerra a execução.
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    try {
      const { empresaId } = req.body; // Corrigido para 'empresaId' conforme seu log de erro
      if (!empresaId) {
        return res.status(400).json({ error: 'ID da empresa (empresaId) não fornecido.' });
      }

      // Acessando a coleção de funcionários dentro do documento da empresa
      const funcionariosSnapshot = await db.collection('empresas').doc(empresaId).collection('funcionarios').get();
      const licencasNecessarias = funcionariosSnapshot.size;

      return res.status(200).json({ licencasNecessarias });

    } catch (error) {
      console.error("Erro em getStatusEmpresa:", error);
      return res.status(500).json({ error: 'Erro interno ao buscar dados da empresa.' });
    }
  });
});


// =================================================================================
// ENDPOINT 2: createPreference (COM A MESMA CORREÇÃO)
// =================================================================================
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

      await db.collection("empresas").doc(userId).collection("assinatura").doc("dados").set({
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

// =================================================================================
// ENDPOINT 3: receberWebhookMercadoPago (NÃO PRECISA DE CORS)
// =================================================================================
exports.receberWebhookMercadoPago = functions.https.onRequest(async (req, res ) => {
  // Webhooks são chamados de servidor para servidor, então CORS não é necessário.
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

// A função de cálculo de preço não precisa ser exportada ou alterada.
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
