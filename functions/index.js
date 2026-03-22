// ============================ Imports principais =============================
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { MercadoPagoConfig, Preapproval } = require("mercadopago");
const cors = require("cors");
const { processarFila } = require("./processarFila");
const fetch = require("node-fetch");

// ========================= Inicialização do Firebase =========================
if (!admin.apps.length) {
  admin.initializeApp();
}

// ✅ CORREÇÃO: Usar getFirestore com databaseId explícito
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
        const client = getMercadoPagoClient();

        if (!client) {
          return res
            .status(500)
            .json({ error: "Erro de configuração do servidor." });
        }

        const { userId, planoEscolhido } = req.body;

        if (!userId || !planoEscolhido) {
          return res.status(400).json({ error: "Dados inválidos." });
        }

        const userRecord = await admin.auth().getUser(userId);
        const precoFinal = calcularPreco(planoEscolhido.totalFuncionarios);

        const notificationUrl =
          "https://southamerica-east1-pronti-app-37c6e.cloudfunctions.net/receberWebhookMercadoPago";

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
              dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        return res.status(200).json({ init_point: response.init_point });
      } catch (error) {
        logger.error("Erro em createPreference:", error);
        return res.status(500).json({
          error: "Erro ao criar preferência de pagamento.",
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

      const { id, type } = req.body;

      if (type === "preapproval") {
        try {
          const client = getMercadoPagoClient();

          if (!client) {
            return res.status(500).send("Erro de configuração interna.");
          }

          const preapproval = new Preapproval(client);
          const subscription = await preapproval.get({ id: id });

          const query = db
            .collectionGroup("assinatura")
            .where("mercadoPagoAssinaturaId", "==", subscription.id);

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
              ultimaAtualizacaoWebhook:
                admin.firestore.FieldValue.serverTimestamp(),
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
    logger.error(
      "FATAL: O secret MERCADOPAGO_TOKEN não está configurado ou acessível!"
    );
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
  if (totalFuncionarios <= configuracaoPrecos.funcionariosInclusos) {
    return configuracaoPrecos.precoBase;
  }

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

function normalizarTelefoneBR(telefone) {
  if (!telefone) return null;

  let numero = String(telefone).replace(/\D/g, "");

  if (!numero) return null;

  if (numero.startsWith("0")) {
    numero = numero.replace(/^0+/, "");
  }

  if (!numero.startsWith("55")) {
    numero = `55${numero}`;
  }

  if (numero.length < 12 || numero.length > 13) {
    return null;
  }

  return numero;
}

async function enviarWhatsAppEvolution({ telefone, mensagem }) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE || "pronti";

  if (!apiUrl || !apiKey) {
    logger.warn("Evolution API não configurada. Pulando envio de WhatsApp.");
    return { enviado: false, motivo: "evolution_nao_configurada" };
  }

  const numeroNormalizado = normalizarTelefoneBR(telefone);

  if (!numeroNormalizado) {
    logger.warn("Telefone inválido para envio de WhatsApp.", { telefone });
    return { enviado: false, motivo: "telefone_invalido" };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const endpoint = `${baseUrl}/message/sendText/${instanceName}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: numeroNormalizado,
      text: mensagem,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Falha no envio WhatsApp: ${response.status} - ${responseText}`
    );
  }

  return {
    enviado: true,
    numero: numeroNormalizado,
    resposta: responseText,
  };
}

// ============================================================================
// ROBÔ DO DONO — PUSH AUTOMÁTICO AO DONO NO MOMENTO DO AGENDAMENTO
// CORRIGIDO: Melhor tratamento de erros e logging, suporte completo APNS/Android/Web
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

      logger.info(`Buscando token do dono: ${donoId}`);

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

      logger.info(`Token obtido. Enviando notificação ao dono ${donoId}`);

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
              "content-available": 0,
              "mutable-content": 1,
            },
          },
        },
        webpush: {
          notification: {
            title: notificationTitle,
            body: notificationBody,
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
            badge:
              "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
            tag: `agendamento_${agendamentoId}`,
          },
          fcmOptions: {
            link: "https://prontiapp.com.br/agenda.html",
          },
          headers: {
            Urgency: "high",
          },
        },
      };

      const response = await fcm.send(message);

      logger.info(`✅ Push enviado com sucesso ao dono ${donoId}`, {
        messageId: response,
        agendamentoId,
      });
    } catch (error) {
      logger.error(`❌ Erro ao notificar dono:`, {
        error: error.message,
        code: error.code,
        empresaId,
        agendamentoId,
      });

      if (error.code === "messaging/registration-token-not-registered") {
        logger.warn(`Token inválido para dono. Removendo...`);
        try {
          await db.collection("mensagensTokens").doc(empresaId).update({
            fcmToken: admin.firestore.FieldValue.delete(),
          });
        } catch (deleteError) {
          logger.error("Erro ao remover token:", deleteError);
        }
      }
    }
  }
);

// ============================================================================
// FUNÇÃO DE NOTIFICAÇÃO — PUSH AO DONO (FILA) + WHATSAPP
// CORRIGIDO PARA EVITAR DUPLICIDADE
// ============================================================================
exports.enviarNotificacaoFCM = onDocumentCreated(
  {
    document: "filaDeNotificacoes/{bilheteId}",
    region: "southamerica-east1",
    database: "pronti-app",
    secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE"],
  },
  async (event) => {
    const bilhete =
      event.data && event.data.data ? event.data.data() : null;
    const bilheteId =
      event.params && event.params.bilheteId ? event.params.bilheteId : null;

    if (!bilhete) {
      logger.log("Bilhete vazio, encerrando.");
      return;
    }

    if (bilhete.status === "processado") {
      logger.log(`Bilhete ${bilheteId} já processado, ignorando.`);
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
        logger.log(`Bilhete ${bilheteId} já processado ou em processamento`);
        return;
      }

      transaction.update(event.data.ref, { processando: true });

      const donoId = bilheteAtualizado.donoId;
      const titulo = bilheteAtualizado.titulo || "Notificação Pronti";
      const mensagem =
        bilheteAtualizado.mensagem || "Você tem uma nova atividade.";

      const telefoneWhatsapp =
        bilheteAtualizado.telefone ||
        bilheteAtualizado.telefoneWhatsApp ||
        bilheteAtualizado.whatsapp ||
        null;

      if (!donoId) {
        logger.error(`Bilhete ${bilheteId} não tem donoId.`);
        transaction.update(event.data.ref, {
          status: "processado_com_erro",
          processadoEm: admin.firestore.FieldValue.serverTimestamp(),
          ultimoErro: "sem_donoId",
          processando: false,
        });
        return;
      }

      const tokenRef = db.collection("mensagensTokens").doc(donoId);
      const tokenSnap = await tokenRef.get();

      let fcmEnviado = false;
      let fcmMessageId = null;
      let whatsappEnviado = false;
      let whatsappInfo = null;
      let ultimoErro = null;

      // =========================
      // PUSH FCM
      // =========================
      if (tokenSnap.exists && tokenSnap.data().fcmToken) {
        const fcmToken = tokenSnap.data().fcmToken;

        const payload = {
          token: fcmToken,
          notification: {
            title: titulo,
            body: mensagem,
          },
          data: {
            tipo: "fila",
            bilheteId: bilheteId || "",
            link: "https://prontiapp.com.br/agenda.html",
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
              title: titulo,
              body: mensagem,
              icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
              badge:
                "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
            },
            fcmOptions: {
              link: "https://prontiapp.com.br/agenda.html",
            },
            headers: {
              Urgency: "high",
            },
          },
        };

        try {
          fcmMessageId = await fcm.send(payload);
          fcmEnviado = true;

          logger.log("✅ Notificação Push enviada com sucesso!", {
            fcmMessageId,
            donoId,
            bilheteId,
          });
        } catch (error) {
          logger.error(`❌ Erro ao enviar Notificação Push para ${donoId}:`, error);
          ultimoErro = error.code || error.message || String(error);

          if (error.code === "messaging/registration-token-not-registered") {
            await tokenRef.update({
              fcmToken: admin.firestore.FieldValue.delete(),
            });
          }
        }
      } else {
        logger.warn(`Token FCM não encontrado para dono: ${donoId}`);
      }

      // =========================
      // WHATSAPP EVOLUTION
      // =========================
      if (telefoneWhatsapp) {
        try {
          whatsappInfo = await enviarWhatsAppEvolution({
            telefone: telefoneWhatsapp,
            mensagem,
          });

          whatsappEnviado = !!whatsappInfo?.enviado;

          if (whatsappEnviado) {
            logger.info("✅ WhatsApp enviado com sucesso!", {
              bilheteId,
              donoId,
              telefone: whatsappInfo.numero,
            });
          }
        } catch (error) {
          logger.error(`❌ Erro ao enviar WhatsApp para ${donoId}:`, {
            bilheteId,
            erro: error.message,
          });

          if (!ultimoErro) {
            ultimoErro = error.message || String(error);
          }
        }
      } else {
        logger.info(`Bilhete ${bilheteId} sem telefone para WhatsApp.`);
      }

      // =========================
      // STATUS FINAL
      // =========================
      if (fcmEnviado || whatsappEnviado) {
        transaction.update(event.data.ref, {
          status: "processado",
          processadoEm: admin.firestore.FieldValue.serverTimestamp(),
          fcmEnviado,
          fcmMessageId: fcmMessageId || null,
          whatsappEnviado,
          whatsappTelefone: whatsappInfo?.numero || null,
          processando: false,
          ultimoErro: ultimoErro || null,
        });
      } else {
        transaction.update(event.data.ref, {
          status: "processado_com_erro",
          processadoEm: admin.firestore.FieldValue.serverTimestamp(),
          ultimoErro: ultimoErro || "sem_token_e_sem_telefone",
          fcmEnviado: false,
          whatsappEnviado: false,
          processando: false,
        });
      }
    });
  }
);

// ============================================================================
// rotinaLembreteAgendamento (AVISO AO CLIENTE) — CORRIGIDO PARA EVITAR DUPLICIDADE
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
              logger.info(
                `Lembrete ${docLembrete.id} já está em processamento`
              );
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
              logger.warn(
                `Token FCM não encontrado para cliente ${lembrete.clienteId}`
              );
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
                  body: `Olá! Seu horário para ${
                    lembrete.servicoNome
                  } está chegando (${lembrete.horarioTexto || lembrete.horario}).`,
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
                    body: `Olá! Seu horário para ${
                      lembrete.servicoNome
                    } está chegando (${lembrete.horarioTexto || lembrete.horario}).`,
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

              logger.info(
                `✅ Lembrete enviado para cliente ${lembrete.clienteId}`,
                {
                  lembreteId: docLembrete.id,
                  messageId,
                }
              );

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

      const sucesso = resultados.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const erros = resultados.filter(
        (r) => r.status === "rejected"
      ).length;

      logger.info(
        `✅ Rotina de lembretes concluída: ${sucesso} sucesso, ${erros} erros`
      );
    } catch (error) {
      logger.error("Erro na rotina de lembretes:", error);
    }
  }
);

// ============================================================================
// rotinaProcessarFila — JOB AUTOMÁTICO DA FILA
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
      logger.info("✅ Rotina de processamento da fila executada com sucesso.");
    } catch (error) {
      logger.error("❌ Erro na rotina de processamento da fila:", error);
    }
  }
);

// ============================================================================
// OUTRAS FUNÇÕES
// ============================================================================
exports.notificarClientes = require("./notifyClientes").notificarClientes;
