/**
 * Cloud Function para lembrete de agendamentos (120 MINUTOS).
 * Versão corrigida:
 *  - Inicialização do Admin SDK sem projectId explícito (recomendado em Cloud Functions).
 *  - Logs diagnósticos adicionados para identificar projectId/credenciais em runtime.
 *  - Logs de erro mais completos e tratamento adicional para tokens inválidos.
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Inicialização RECOMENDADA (sem projectId explícito)
if (!admin.apps.length) {
  logger.info("Inicializando Firebase Admin SDK (inicialização padrão)...");
  admin.initializeApp(); // <-- Removido projectId explícito para evitar mismatch de credenciais
  logger.info("Firebase Admin SDK inicializado (padrão).");
} else {
  logger.debug("Firebase Admin SDK já inicializado.");
}

const db = admin.firestore();
const fcm = admin.messaging();

const TIMEZONE = "America/Sao_Paulo";

function logRuntimeInfo() {
  try {
    logger.info(`[DIAG] ENV: GCLOUD_PROJECT=${process.env.GCLOUD_PROJECT} GCP_PROJECT=${process.env.GCP_PROJECT} GOOGLE_CLOUD_PROJECT=${process.env.GOOGLE_CLOUD_PROJECT}`);
    try {
      // Pode falhar em serializar credential, capturamos em try/catch
      logger.info(`[DIAG] admin.app().options: ${JSON.stringify(admin.app().options || {})}`);
    } catch (e) {
      logger.warn("[DIAG] Não foi possível serializar admin.app().options:", e);
    }
  } catch (e) {
    logger.warn("[DIAG] Falha ao logar runtime info:", e);
  }
}

function createDateInTimezone(dateString, timeString) {
  logger.debug(`createDateInTimezone - Entrada: date='${dateString}', time='${timeString}'`);
  try {
    const dateObj = new Date(`${dateString}T${timeString}:00.000-03:00`);
    if (isNaN(dateObj.getTime())) {
      throw new Error("Data inválida gerada.");
    }
    logger.debug(`createDateInTimezone -> ${dateString} ${timeString} => ${dateObj.toISOString()}`);
    return dateObj;
  } catch (e) {
    logger.error(`Erro ao criar data para ${dateString} ${timeString}:`, e);
    return null;
  }
}

exports.notificarClientes = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    logRuntimeInfo();
    logger.info("🚀 ========================================================");
    logger.info("🚀 Iniciando rotina de lembrete (CONSULTA SIMPLIFICADA)...");
    logger.info("🚀 ========================================================");

    try {
      const agora = new Date();
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000);
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000);
      logger.info(`[DEBUG] Hora atual do servidor (ISO): ${agora.toISOString()}`);
      logger.info(`[DEBUG] Janela de busca (ISO): ${inicioJanela.toISOString()} até ${fimJanela.toISOString()}`);

      // Consulta simplificada para debug
      logger.info("[DEBUG] Iniciando busca SIMPLIFICADA collectionGroup('agendamentos').get()...");
      const snapAgendamentos = await db.collectionGroup("agendamentos")
        // .where("status", "==", "ativo") // <<< REMOVIDO PARA TESTE
        .get();
      logger.info(`[DEBUG] Busca SIMPLIFICADA collectionGroup concluída. Total documentos encontrados: ${snapAgendamentos.size}`);

      if (snapAgendamentos.empty) {
        logger.info("✅ Nenhum agendamento encontrado no geral via collectionGroup.");
        return res.status(200).send("Nenhum agendamento encontrado.");
      }

      // Filtragem manual (status + janela de tempo)
      logger.info("[DEBUG] Iniciando filtragem manual (status + janela)...");
      const agendamentosFiltrados = snapAgendamentos.docs.filter(doc => {
        logger.debug(`[FILTER] Verificando doc ${doc.id}`);
        const ag = doc.data();

        if (ag.status !== "ativo") {
          logger.debug(`[FILTER] Agendamento ${doc.id} não está ativo (${ag.status}). Ignorando.`);
          return false;
        }

        if (!ag.data || !ag.horario) {
          logger.warn(`[FILTER] Agendamento ativo ${doc.id} sem data ou horario definidos. Ignorando.`);
          return false;
        }

        const dataCompletaAgendamento = createDateInTimezone(ag.data, ag.horario);
        if (!dataCompletaAgendamento) {
          logger.warn(`[FILTER] Agendamento ativo ${doc.id} com data/horario inválido: ${ag.data} ${ag.horario}. Ignorando.`);
          return false;
        }

        const estaNaJanela = dataCompletaAgendamento >= inicioJanela && dataCompletaAgendamento <= fimJanela;
        logger.info(`[FILTER] Agendamento ativo ${doc.id}: ${ag.data} ${ag.horario} => ${dataCompletaAgendamento.toISOString()} | Na janela [${inicioJanela.toISOString()} - ${fimJanela.toISOString()}]: ${estaNaJanela}`);
        return estaNaJanela;
      });
      logger.info(`[DEBUG] Filtragem manual concluída. Agendamentos na janela: ${agendamentosFiltrados.length}`);

      if (agendamentosFiltrados.length === 0) {
        logger.info("✅ Nenhum agendamento ativo encontrado NA JANELA de 120 minutos após filtragem manual.");
        return res.status(200).send("Sem agendamentos na janela para notificar.");
      }

      let totalEnviadas = 0;

      logger.info("[DEBUG] Iniciando loop para enviar notificações...");
      for (const tokenDoc of agendamentosFiltrados) {
        const agendamento = tokenDoc.data();
        const agendamentoId = tokenDoc.id;
        logger.info(`--------------------------------------------------------`);
        logger.info(`[LOOP] Processando agendamento ${agendamentoId}`);

        if (!agendamento?.clienteId) {
          logger.error(`[LOOP] ERRO INESPERADO: Agendamento filtrado ${agendamentoId} sem clienteId. Pulando.`);
          continue;
        }
        const clienteIdParaToken = agendamento.clienteId;
        logger.info(`[LOOP] Cliente ID: ${clienteIdParaToken}`);

        logger.debug(`[LOOP] Buscando token para cliente ${clienteIdParaToken} em 'mensagensTokens'...`);
        const tokenQuerySnap = await db.collection("mensagensTokens")
          .where("userId", "==", clienteIdParaToken)
          .limit(1)
          .get();

        if (tokenQuerySnap.empty) {
          logger.warn(`[LOOP] ⚠️ Nenhum token encontrado para cliente ${clienteIdParaToken}. Pulando.`);
          continue;
        }

        const tokenDocToken = tokenQuerySnap.docs[0];
        const tokenData = tokenDocToken.data();
        const tokenRef = tokenDocToken.ref;
        logger.info(`[LOOP] Token encontrado para cliente ${clienteIdParaToken}. Doc ID: ${tokenDocToken.id}`);

        if (!tokenData?.fcmToken) {
          logger.warn(`[LOOP] ⚠️ Doc de token ${tokenDocToken.id} encontrado, mas sem fcmToken. Pulando.`);
          continue;
        }
        const fcmTokenParaEnviar = tokenData.fcmToken;
        logger.info(`[LOOP] Token FCM a ser usado (mascarado): ${fcmTokenParaEnviar ? '***TOKEN-OCULTO***' : 'null'}`);

        const payload = {
          notification: {
            title: "⏰ Lembrete de Agendamento",
            body: `Seu agendamento de ${agendamento.servicoNome || '(serviço não informado)'} com ${agendamento.profissionalNome || '(profissional não informado)'} começa em 2 horas!`,
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
            badge: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media"
          },
          webpush: {
            fcmOptions: {
              link: "https://prontiapp.com.br/meus-agendamentos.html"
            }
          },
          token: fcmTokenParaEnviar
        };

        // Logs diagnósticos antes do envio
        logger.debug(`[DIAG] Antes do envio: admin.app().options.projectId = ${admin.app().options && admin.app().options.projectId}`);
        logger.debug(`[DIAG] Process.env.GCLOUD_PROJECT = ${process.env.GCLOUD_PROJECT}`);
        logger.debug(`[DIAG] Payload resumido (token mascarado): ${JSON.stringify({ notification: payload.notification, token: payload.token ? '***' : null })}`);

        try {
          logger.info(`[LOOP] Tentando enviar FCM para token (mascarado) ***...`);
          const sendResult = await fcm.send(payload);
          logger.info(`[LOOP] ✅ SUCESSO ao enviar para cliente ${clienteIdParaToken}. sendResult=${sendResult}`);
          totalEnviadas++;
        } catch (error) {
          // Log detalhado do erro (inclui propriedades não enumeráveis)
          try {
            logger.error(`[LOOP] 🔥 FALHA no fcm.send() para cliente ${clienteIdParaToken} -> ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
          } catch (serErr) {
            logger.error(`[LOOP] Falha ao serializar erro do fcm.send():`, serErr);
            logger.error(`[LOOP] Erro original (toString):`, String(error));
          }

          // Diagnóstico adicional: verificar códigos possíveis (gRPC numeric code 5 => NOT_FOUND)
          const errCode = error && (error.code ?? error.status ?? null);
          logger.error(`[LOOP] Código do erro detectado: ${errCode} | message: ${error && error.message}`);

          // Se token não registrado ou inválido, tentar remover do Firestore
          const tokenInvalidConditions = [
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
            'InvalidRegistration',
            'NotRegistered'
          ];
          const isTokenInvalid = tokenInvalidConditions.includes(error && error.code) ||
              (typeof errCode === 'number' && (errCode === 5 || errCode === 404)) ||
              (error && typeof error.message === 'string' && error.message.toLowerCase().includes('not found') && error.message.toLowerCase().includes('registration-token'));

          if (isTokenInvalid) {
            logger.warn(`[LOOP] O token parece inválido/não registrado. Tentando remover do Firestore (Doc ID: ${tokenDocToken.id})...`);
            try {
              await tokenRef.update({
                fcmToken: admin.firestore.FieldValue.delete()
              });
              logger.warn(`[LOOP] Token inválido removido do Firestore para ${clienteIdParaToken} (Doc ID: ${tokenDocToken.id}).`);
            } catch (updateError) {
              try {
                logger.error(`[LOOP] FALHA ao tentar remover token inválido ${tokenDocToken.id}: ${JSON.stringify(updateError, Object.getOwnPropertyNames(updateError))}`);
              } catch (se) {
                logger.error(`[LOOP] FALHA ao serializar updateError:`, se);
                logger.error(`[LOOP] updateError toString:`, String(updateError));
              }
            }
          } else {
            // Possível NOT_FOUND de recurso externo (ex.: mismatch de projectId) — logamos para inspeção
            logger.error(`[LOOP] Erro não identificado como token inválido. Pode ser mismatch de projectId ou recurso externo não encontrado. Verifique logs DIAG acima para admin options.`);
          }
        }
      } // fim for

      logger.info(`✨ =======================================================`);
      logger.info(`✨ Rotina de lembrete concluída. Total notificações enviadas: ${totalEnviadas}`);
      logger.info(`✨ =======================================================`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);
    } catch (error) {
      try {
        logger.error("🔥🔥🔥 Erro GERAL e INESPERADO na rotina:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        logger.error("🔥🔥🔥 Erro GERAL e INESPERADO (não serializável):", String(error));
      }
      return res.status(500).send("Erro interno ao processar lembretes.");
    }
  }
);
