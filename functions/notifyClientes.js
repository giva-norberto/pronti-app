/**
 * Cloud Function para lembrete de agendamentos (120 MINUTOS).
 * DEBUG: Consulta inicial simplificada (sem .where) para testar o collectionGroup.
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Inicialização Explícita
if (!admin.apps.length) {
  const detectedProjectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    "pronti-app-37c6e";
  logger.info(`Inicializando Firebase Admin SDK para projeto ${detectedProjectId}...`);
  admin.initializeApp({ projectId: detectedProjectId });
  logger.info("Firebase Admin SDK inicializado.");
} else {
    logger.debug("Firebase Admin SDK já inicializado.");
}


const db = admin.firestore();
const fcm = admin.messaging();

const TIMEZONE = "America/Sao_Paulo";

function createDateInTimezone(dateString, timeString) {
    logger.debug(`createDateInTimezone - Entrada: date='${dateString}', time='${timeString}'`);
    try {
        const dateObj = new Date(`${dateString}T${timeString}:00.000-03:00`);
        if (isNaN(dateObj.getTime())) {
            throw new Error("Data inválida gerada.");
        }
        logger.debug(`createDateInTimezone -> ${dateString} ${timeString} => ${dateObj.toISOString()}`);
        return dateObj;
    } catch(e) {
        logger.error(`Erro ao criar data para ${dateString} ${timeString}:`, e);
        return null;
    }
}

exports.notificarClientes = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    logger.info("🚀 ========================================================");
    logger.info("🚀 Iniciando rotina de lembrete (CONSULTA SIMPLIFICADA)...");
    logger.info("🚀 ========================================================");

    try {
      const agora = new Date();
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000);
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000);
      logger.info(`[DEBUG] Hora atual do servidor (ISO): ${agora.toISOString()}`);
      logger.info(`[DEBUG] Janela de busca (ISO): ${inicioJanela.toISOString()} até ${fimJanela.toISOString()}`);

      // =============================================================
      //  ↓↓↓ CONSULTA SIMPLIFICADA: SEM FILTRO .where() ↓↓↓
      // =============================================================
      logger.info("[DEBUG] Iniciando busca SIMPLIFICADA collectionGroup('agendamentos').get()...");
      const snapAgendamentos = await db.collectionGroup("agendamentos")
        // .where("status", "==", "ativo") // <<< REMOVIDO PARA TESTE
        .get();
      logger.info(`[DEBUG] Busca SIMPLIFICADA collectionGroup concluída. Total documentos encontrados: ${snapAgendamentos.size}`);
      // =============================================================

      if (snapAgendamentos.empty) {
        logger.info("✅ Nenhum agendamento encontrado no geral via collectionGroup.");
        // Isso seria estranho se você tiver agendamentos
        return res.status(200).send("Nenhum agendamento encontrado.");
      }

      // =============================================================
      //  ↓↓↓ FILTRAGEM MANUAL (status + janela de tempo) ↓↓↓
      // =============================================================
      logger.info("[DEBUG] Iniciando filtragem manual (status + janela)...");
      const agendamentosFiltrados = snapAgendamentos.docs.filter(doc => {
        logger.debug(`[FILTER] Verificando doc ${doc.id}`);
        const ag = doc.data();

        // Filtro 1: Status
        if (ag.status !== "ativo") {
            logger.debug(`[FILTER] Agendamento ${doc.id} não está ativo (${ag.status}). Ignorando.`);
            return false;
        }

        // Filtro 2: Data/Hora
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
      // =============================================================


      if (agendamentosFiltrados.length === 0) {
        logger.info("✅ Nenhum agendamento ativo encontrado NA JANELA de 120 minutos após filtragem manual.");
        return res.status(200).send("Sem agendamentos na janela para notificar.");
      }

      let totalEnviadas = 0;

      // =============================================================
      //  ↓↓↓ LOOP PARA ENVIAR NOTIFICAÇÕES (Idêntico a antes) ↓↓↓
      // =============================================================
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
        logger.info(`[LOOP] Token FCM a ser usado: ${fcmTokenParaEnviar}`);


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

        logger.debug(`[LOOP] Payload FCM montado para cliente ${clienteIdParaToken}: ${JSON.stringify(payload)}`);

        try {
          logger.info(`[LOOP] Tentando enviar FCM para token ${fcmTokenParaEnviar}...`);
          await fcm.send(payload);
          totalEnviadas++;
          logger.info(`[LOOP] ✅ SUCESSO ao enviar para cliente ${clienteIdParaToken}`);
        } catch (error) {
          logger.error(`[LOOP] 🔥🔥🔥 FALHA no fcm.send() para cliente ${clienteIdParaToken}`);
          logger.error("[LOOP] Objeto de erro completo do fcm.send:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

          if (error.code === 'messaging/registration-token-not-registered') {
             logger.warn(`[LOOP] O token ${fcmTokenParaEnviar} não está registrado. Tentando remover do Firestore...`);
            try {
                 await tokenRef.update({
                    fcmToken: admin.firestore.FieldValue.delete()
                 });
                 logger.warn(`[LOOP] Token inválido removido do Firestore para ${clienteIdParaToken} (Doc ID: ${tokenDocToken.id}).`);
            } catch (updateError) {
                 logger.error(`[LOOP] FALHA ao tentar remover token inválido ${tokenDocToken.id}:`, updateError);
            }
          }
        }
      } // Fim loop

      logger.info(`✨ =======================================================`);
      logger.info(`✨ Rotina de lembrete concluída. Total notificações enviadas: ${totalEnviadas}`);
      logger.info(`✨ =======================================================`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);

    } catch (error) {
      logger.error("🔥🔥🔥 Erro GERAL e INESPERADO na rotina:", error);
      logger.error("Detalhes do erro geral:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return res.status(500).send("Erro interno ao processar lembretes.");
    }
  }
);
