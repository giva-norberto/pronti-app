// ============================ Imports principais =============================
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { MercadoPagoConfig } = require("mercadopago");
const cors = require("cors");
const { processarFila } = require("./processarFila");
const { avisarClienteRetorno } = require("./avisarClienteRetorno");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { rotinaRetornoClientes } = require("./rotinaRetornoClientes");
// ========================= Inicialização do Firebase ======================
if (!admin.apps.length) {
  admin.initializeApp();
}

// ==== USANDO O BANCO NOMEADO "pronti-app"! ====
const db = getFirestore("pronti-app");
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
        return res
          .status(405)
          .json({ error: "Método não permitido. Use POST." });
      }
      try {
        logger.info("DEBUG: INICIO verificarEmpresa", {
          body: req.body,
          headers: req.headers,
        });
        const { empresaId } = req.body;
        if (!empresaId) {
          logger.info("DEBUG: Falta empresaId no body");
          return res
            .status(400)
            .json({ error: "ID da empresa inválido ou não fornecido." });
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
          return res.status(403).json({
            error:
              "Assinatura gratuita expirada. Por favor, selecione um plano.",
          });
        }
        let licencasNecessarias = 0;
        try {
          const profissionaisSnapshot = await empresaDocRef
            .collection("profissionais")
            .get();
          if (!profissionaisSnapshot.empty) {
            licencasNecessarias = profissionaisSnapshot.size;
          }
          logger.info("DEBUG: profissionaisSnapshot.size", {
            size: licencasNecessarias,
          });
        } catch (profErr) {
          logger.warn(
            "DEBUG: Erro ao buscar subcoleção profissionais, assumindo 0.",
            { error: profErr }
          );
        }
        logger.info(
          `Sucesso: Empresa ${empresaId} possui ${licencasNecessarias} profissionais.`
        );
        return res.status(200).json({ licencasNecessarias });
      } catch (error) {
        logger.error("Erro fatal em verificarEmpresa:", error);
        return res.status(500).json({
          error: "Erro interno do servidor.",
          detalhes: error.message || error.toString(),
        });
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
        const token = process.env.MERCADOPAGO_TOKEN;

        if (!token) {
          logger.error("MERCADOPAGO_TOKEN não configurado.");
          return res.status(500).json({
            error: "Erro de configuração do servidor.",
          });
        }

        const { empresaId, planoSelecionado, precoPlanoSelecionado } = req.body || {};

        if (!empresaId || !planoSelecionado || !precoPlanoSelecionado) {
          return res.status(400).json({
            error: "Dados inválidos para criar assinatura.",
          });
        }

        const empresaRef = db.collection("empresarios").doc(String(empresaId));
        const empresaSnap = await empresaRef.get();

        if (!empresaSnap.exists) {
          return res.status(404).json({
            error: "Empresa não encontrada.",
          });
        }

        const empresaData = empresaSnap.data() || {};
        const donoId = empresaData.donoId || empresaId;

        let payerEmail = empresaData.emailDeNotificacao || null;

        if (!payerEmail && donoId) {
          try {
            const userRecord = await admin.auth().getUser(String(donoId));
            payerEmail = userRecord.email || null;
          } catch (authErr) {
            logger.warn("Não foi possível buscar email do dono.", {
              donoId,
              erro: authErr.message,
            });
          }
        }

        if (!payerEmail) {
          return res.status(400).json({
            error: "Empresa sem email para pagamento.",
          });
        }

        const valor = Number(precoPlanoSelecionado);

        if (!valor || valor <= 0) {
          return res.status(400).json({
            error: "Valor do plano inválido.",
          });
        }

        const subscriptionData = {
          reason: `Assinatura Pronti - Plano ${planoSelecionado} usuário(s)`,
          external_reference: String(empresaId),
          payer_email: payerEmail,
          notification_url:
            "https://southamerica-east1-pronti-app-37c6e.cloudfunctions.net/receberWebhookMercadoPago",
          back_url: "https://prontiapp.com.br/pagamento-confirmado",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: valor,
            currency_id: "BRL",
          },
        };

        const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscriptionData),
        });

        const response = await mpResponse.json();

        if (!mpResponse.ok) {
          logger.error("Erro Mercado Pago preapproval:", response);

          return res.status(500).json({
            error: "Erro ao criar assinatura no Mercado Pago.",
            detalhes:
              response?.message ||
              response?.error ||
              JSON.stringify(response),
          });
        }

        await empresaRef.set(
          {
            mercadoPagoAssinaturaId: response.id,
            statusAssinatura: "pendente",
            planoSolicitado: String(planoSelecionado),
            valorPlanoSolicitado: valor,
            ultimaCriacaoAssinaturaMP:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.status(200).json({
          init_point: response.init_point,
          sandbox_init_point: response.sandbox_init_point || null,
          id: response.id,
        });
      } catch (error) {
        logger.error("Erro em createPreference:", error);

        return res.status(500).json({
          error: "Erro ao criar assinatura no Mercado Pago.",
          detalhes: error.message || error.toString(),
        });
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

      try {
        const body = req.body || {};
        const query = req.query || {};

        const type = body.type || query.type || query.topic || null;
        const preapprovalId =
          body.id ||
          body?.data?.id ||
          query.id ||
          query["data.id"] ||
          null;

        if (type !== "preapproval" || !preapprovalId) {
          return res.status(200).send("OK");
        }

        const token = process.env.MERCADOPAGO_TOKEN;

        if (!token) {
          logger.error("MERCADOPAGO_TOKEN não configurado no webhook.");
          return res.status(500).send("Erro de configuração interna.");
        }

        const mpResponse = await fetch(
          `https://api.mercadopago.com/preapproval/${encodeURIComponent(
            String(preapprovalId)
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const subscription = await mpResponse.json();

        if (!mpResponse.ok) {
          logger.error("Erro ao consultar preapproval Mercado Pago:", {
            status: mpResponse.status,
            resposta: subscription,
          });

          return res.status(200).send("OK");
        }

        const empresaId = subscription.external_reference;

        if (!empresaId) {
          logger.warn("Webhook MP sem external_reference", {
            mercadoPagoAssinaturaId: subscription.id,
            statusMP: subscription.status,
          });

          return res.status(200).send("OK");
        }

        const empresaRef = db.collection("empresarios").doc(String(empresaId));
        const empresaSnap = await empresaRef.get();

        if (!empresaSnap.exists) {
          logger.warn("Webhook MP: empresa não encontrada", {
            empresaId,
            mercadoPagoAssinaturaId: subscription.id,
            statusMP: subscription.status,
          });

          return res.status(200).send("OK");
        }

        const statusMap = {
          authorized: "ativa",
          cancelled: "cancelada",
          canceled: "cancelada",
          paused: "pausada",
          pending: "pendente",
        };

        const novoStatus = statusMap[subscription.status] || "desconhecido";
        const agora = admin.firestore.FieldValue.serverTimestamp();

        let novaValidade = null;

        if (novoStatus === "ativa") {
          const dataValidade = new Date();
          dataValidade.setDate(dataValidade.getDate() + 30);
          novaValidade = admin.firestore.Timestamp.fromDate(dataValidade);
        }

        const updatesEmpresa = {
          statusAssinatura: novoStatus,
          mercadoPagoAssinaturaId: subscription.id,
          ultimaAtualizacaoMP: agora,
          ultimaRespostaMercadoPago: subscription.status || null,
        };

        if (novaValidade) {
          updatesEmpresa.assinaturaValidaAte = novaValidade;
          updatesEmpresa.proximoPagamento = novaValidade;
          updatesEmpresa.assinaturaAtiva = true;
          updatesEmpresa.status = "ativo";
          updatesEmpresa.plano = "pago";
        }

        if (novoStatus !== "ativa") {
          updatesEmpresa.assinaturaAtiva = false;
          updatesEmpresa.status = novoStatus;
        }

        await empresaRef.set(updatesEmpresa, { merge: true });

        logger.info("Webhook MP processado com sucesso", {
          empresaId,
          mercadoPagoAssinaturaId: subscription.id,
          statusMP: subscription.status,
          statusPronti: novoStatus,
        });

        return res.status(200).send("OK");
      } catch (error) {
        logger.error("Erro ao processar webhook Mercado Pago:", error);
        return res.status(200).send("OK");
      }
    });
  }
);
// ============================================================================
// ROBÔ DO DONO — PUSH AUTOMÁTICO AO DONO NO MOMENTO DO AGENDAMENTO
// ============================================================================
exports.notificarDonoInstantaneo = onDocumentCreated(
  {
    document: "empresarios/{empresaId}/agendamentos/{agendamentoId}",
    region: "southamerica-east1",
    database: "pronti-app",
  },
  async (event) => {
    const agendamento = event.data?.data();
    const empresaId = event.params?.empresaId;
    const agendamentoId = event.params?.agendamentoId;
    if (!agendamento || !empresaId) {
      logger.warn("Dados insuficientes para notificar dono", {
        agendamento,
        empresaId,
      });
      return;
    }
    try {
      const empresaDoc = await db.collection("empresarios").doc(empresaId).get();
      if (!empresaDoc.exists) {
        logger.warn(`Empresa ${empresaId} não encontrada`);
        return;
      }
      const empresaData = empresaDoc.data();
      const donoId = empresaData.donoId || empresaData.userId || empresaId;
      const tokenDoc = await db.collection("mensagensTokens").doc(donoId).get();
      if (!tokenDoc.exists) {
        logger.warn(`Documento de token não encontrado para dono ${donoId}`);
        return;
      }
      const tokenData = tokenDoc.data();
      const fcmToken = tokenData?.fcmToken;
      if (!fcmToken) {
        logger.warn(`FCM Token vazio para dono ${donoId}`);
        return;
      }
      const notificationTitle = "📝 Novo Agendamento!";
      const notificationBody = `${
        agendamento.clienteNome || "Alguém"
      } marcou ${agendamento.servicoNome || "um serviço"} às ${
        agendamento.horario || "horário indefinido"
      }`;
      const message = {
        token: fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          tipo: "novo_agendamento",
          empresaId: empresaId,
          agendamentoId: agendamentoId,
          link: "https://prontiapp.com.br/agenda.html",
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            priority: "high",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            title: notificationTitle,
            body: notificationBody,
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
          },
          fcmOptions: {
            link: "https://prontiapp.com.br/agenda.html",
          },
        },
      };
      await fcm.send(message);
      logger.info(`✅ Push enviado com sucesso ao dono ${donoId}`);
    } catch (error) {
      logger.error(`❌ Erro ao notificar dono:`, error.message);
    }
  }
);

// ============================================================================
// FUNÇÃO DE NOTIFICAÇÃO — PUSH AO DONO (FILA) + WHATSAPP
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  {
    document: "filaDeNotificacoes/{bilheteId}",
    region: "southamerica-east1",
    database: "pronti-app",
    secrets: [],
  },
  async (event) => {
    const bilhete =
      event.data && event.data.data ? event.data.data() : null;
    const bilheteId =
      event.params && event.params.bilheteId ? event.params.bilheteId : null;
    if (!bilhete || bilhete.status === "processado") {
      return;
    }
    return db.runTransaction(async (transaction) => {
      const freshDoc = await transaction.get(event.data.ref);
      const bilheteAtualizado = freshDoc.data();
      if (
        !bilheteAtualizado ||
        bilheteAtualizado.status !== "pendente" ||
        bilheteAtualizado.processando === true
      ) {
        return;
      }
      transaction.update(event.data.ref, { processando: true });
      const donoId = bilheteAtualizado.donoId;
      const titulo = bilheteAtualizado.titulo || "Notificação Pronti";
      const mensagem = bilheteAtualizado.mensagem || "Você tem uma nova atividade.";
      const telefoneWhatsapp = bilheteAtualizado.telefone || bilheteAtualizado.whatsapp || null;
      if (!donoId) {
        transaction.update(event.data.ref, { status: "processado_com_erro", processando: false });
        return;
      }
      const tokenRef = db.collection("mensagensTokens").doc(donoId);
      const tokenSnap = await tokenRef.get();
      let fcmEnviado = false;
      let fcmMessageId = null;
      let whatsappEnviado = false;
      let whatsappInfo = null;
      // --- PUSH FCM ---
      if (tokenSnap.exists && tokenSnap.data().fcmToken) {
        try {
          fcmMessageId = await fcm.send({
            token: tokenSnap.data().fcmToken,
            notification: { title: titulo, body: mensagem },
            data: { tipo: "fila", bilheteId: bilheteId || "" }
          });
          fcmEnviado = true;
        } catch (error) {
          logger.error(`❌ Erro Push:`, error.message);
        }
      }
      // --- WHATSAPP ---
      if (telefoneWhatsapp) {
        try {
          whatsappInfo = await enviarWhatsAppEvolution({
            telefone: telefoneWhatsapp,
            mensagem,
          });
          whatsappEnviado = !!whatsappInfo?.enviado;
        } catch (error) {
          logger.error(`❌ Erro WhatsApp:`, error.message);
        }
      }
      // --- STATUS FINAL ---
      transaction.update(event.data.ref, {
        status: (fcmEnviado || whatsappEnviado) ? "processado" : "processado_com_erro",
        processadoEm: admin.firestore.FieldValue.serverTimestamp(),
        fcmEnviado,
        fcmMessageId: fcmMessageId || null,
        whatsappEnviado,
        processando: false,
      });
    });
  }
);

// ============================================================================
// rotinaLembreteAgendamento - VERSÃO ANTIGA RESTAURADA
// ============================================================================
exports.rotinaLembreteAgendamento = onSchedule(
  {
    schedule: "0,15,30,45 * * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
  },
  async () => {
    const agora = admin.firestore.Timestamp.now();
    try {
      const snapshot = await db
        .collection("lembretesPendentes")
        .where("enviado", "==", false)
        .where("dataEnvio", "<=", agora)
        .limit(100)
        .get();
      if (snapshot.empty) {
        logger.info("Nenhum lembrete pendente encontrado.");
        return;
      }
      const resultados = await Promise.allSettled(
        snapshot.docs.map((docLembrete) =>
          db.runTransaction(async (transaction) => {
            const freshDoc = await transaction.get(docLembrete.ref);
            const lembrete = freshDoc.data();
            if (!lembrete || lembrete.enviado !== false) {
              logger.info(`Lembrete ${docLembrete.id} já foi processado`);
              return { status: "já_processado" };
            }
            if (lembrete.processando === true) {
              logger.info(`Lembrete ${docLembrete.id} já está em processamento`);
              return { status: "em_processamento" };
            }
            transaction.update(docLembrete.ref, {
              processando: true,
              processandoEm: admin.firestore.FieldValue.serverTimestamp(),
            });
            const tokenSnap = await db
              .collection("mensagensTokens")
              .doc(lembrete.clienteId)
              .get();
            const fcmToken = tokenSnap.exists ? tokenSnap.data().fcmToken : null;
            if (!fcmToken) {
              logger.warn(`Token FCM não encontrado para cliente ${lembrete.clienteId}`);
              transaction.update(docLembrete.ref, {
                enviado: "sem_token",
                processando: false,
                processadoEm: admin.firestore.FieldValue.serverTimestamp(),
              });
              return { status: "sem_token" };
            }
            const link = `https://prontiapp.com.br/vitrine.html?empresa=${encodeURIComponent(
              String(lembrete.empresaId || "")
            )}`;
            try {
              const messageId = await fcm.send({
                token: fcmToken,
                notification: {
                  title: "Lembrete Pronti ⏰",
                  body: `Olá! Seu horário para ${lembrete.servicoNome} está chegando (${
                    lembrete.horarioTexto || lembrete.horario
                  }).`,
                },
                data: {
                  tipo: "lembrete",
                  agendamentoId: lembrete.agendamentoId || "",
                  link: link,
                },
                android: {
                  priority: "high",
                  notification: {
                    sound: "default",
                    priority: "high",
                  },
                },
                apns: {
                  headers: {
                    "apns-priority": "10",
                  },
                  payload: {
                    aps: {
                      sound: "default",
                      badge: 1,
                      "mutable-content": 1,
                    },
                  },
                },
                webpush: {
                  notification: {
                    title: "Lembrete Pronti ⏰",
                    body: `Olá! Seu horário para ${lembrete.servicoNome} está chegando (${
                      lembrete.horarioTexto || lembrete.horario
                    }).`,
                  },
                  fcmOptions: { link },
                  headers: { Urgency: "high" },
                },
              });
              transaction.update(docLembrete.ref, {
                enviado: true,
                processando: false,
                processadoEm: admin.firestore.FieldValue.serverTimestamp(),
                messageId: messageId,
              });
              logger.info(`✅ Lembrete enviado para cliente ${lembrete.clienteId}`, {
                lembreteId: docLembrete.id,
                messageId,
              });
              return { status: "enviado" };
            } catch (err) {
              logger.error("Erro ao enviar FCM:", err);
              if (err.code === "messaging/registration-token-not-registered") {
                await db
                  .collection("mensagensTokens")
                  .doc(lembrete.clienteId)
                  .update({ fcmToken: admin.firestore.FieldValue.delete() });
              }
              transaction.update(docLembrete.ref, {
                enviado: false,
                processando: false,
                ultimoErro: err.code || err.message,
              });
              return { status: "erro_envio", erro: err.message };
            }
          })
        )
      );
      const sucesso = resultados.filter((r) => r.status === "fulfilled").length;
      const erros = resultados.filter((r) => r.status === "rejected").length;
      logger.info(`✅ Rotina de lembretes concluída: ${sucesso} sucesso, ${erros} erros`);
    } catch (error) {
      logger.error("Erro na rotina de lembretes:", error);
    }
  }
);

// ============================================================================
// rotinaProcessarFila
// ============================================================================
exports.rotinaProcessarFila = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "256MiB",
  },
  async () => {
    try {
      await processarFila();
    } catch (error) {
      logger.error("❌ Erro fila:", error);
    }
  }
);

exports.avisarClienteRetorno = avisarClienteRetorno;
exports.rotinaRetornoClientes = rotinaRetornoClientes;
