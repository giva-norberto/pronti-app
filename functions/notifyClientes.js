/**
 * Cloud Function para lembrete de agendamentos (120 MINUTOS).
 * CORRIGIDO: Busca todos ativos e filtra manualmente data/hora (strings).
 * DEBUG COMPLETO ADICIONADO
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Inicialização Simplificada
if (!admin.apps.length) {
  logger.info("Inicializando Firebase Admin SDK...");
  admin.initializeApp();
  logger.info("Firebase Admin SDK inicializado.");
} else {
  logger.debug("Firebase Admin SDK já inicializado.");
}


const db = admin.firestore();
const fcm = admin.messaging();

// Fuso horário do Brasil (importante para construir a data corretamente)
const TIMEZONE = "America/Sao_Paulo"; // Confirmar se este é o TZ correto para -03:00 sempre

// Função auxiliar para criar Date com fuso horário
function createDateInTimezone(dateString, timeString) {
    logger.debug(`createDateInTimezone - Entrada: date='${dateString}', time='${timeString}'`);
    try {
        // Assume -03:00. CUIDADO com horário de verão.
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
    logger.info("🚀 Iniciando rotina de lembrete de 120 MINUTOS...");
    logger.info("🚀 ========================================================");

    try {
      const agora = new Date();
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000);
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000);
      logger.info(`[DEBUG] Hora atual do servidor (ISO): ${agora.toISOString()}`);
      logger.info(`[DEBUG] Janela de busca (ISO): ${inicioJanela.toISOString()} até ${fimJanela.toISOString()}`);

      // =============================================================
      //  ↓↓↓ BUSCA DE AGENDAMENTOS ATIVOS ↓↓↓
      // =============================================================
      logger.info("[DEBUG] Iniciando busca collectionGroup('agendamentos').where('status', '==', 'ativo')...");
      const snapAgendamentos = await db.collectionGroup("agendamentos")
        .where("status", "==", "ativo")
        .get();
      logger.info(`[DEBUG] Busca collectionGroup concluída. Total documentos encontrados: ${snapAgendamentos.size}`);


      if (snapAgendamentos.empty) {
        logger.info("✅ Nenhum agendamento ATIVO encontrado no geral.");
        return res.status(200).send("Sem agendamentos ativos para verificar.");
      }

      // =============================================================
      //  ↓↓↓ FILTRAGEM MANUAL POR JANELA DE 120 MINUTOS ↓↓↓
      // =============================================================
      logger.info("[DEBUG] Iniciando filtragem manual pela janela de tempo...");
      const agendamentosFiltrados = snapAgendamentos.docs.filter(doc => {
        logger.debug(`[FILTER] Verificando doc ${doc.id}`);
        const ag = doc.data();
        if (!ag.data || !ag.horario) {
            logger.warn(`[FILTER] Agendamento ${doc.id} sem data ou horario definidos. Ignorando.`);
            return false;
        }

        const dataCompletaAgendamento = createDateInTimezone(ag.data, ag.horario);
        if (!dataCompletaAgendamento) {
             logger.warn(`[FILTER] Agendamento ${doc.id} com data/horario inválido: ${ag.data} ${ag.horario}. Ignorando.`);
             return false;
        }

        const estaNaJanela = dataCompletaAgendamento >= inicioJanela && dataCompletaAgendamento <= fimJanela;
        logger.info(`[FILTER] Agendamento ${doc.id}: ${ag.data} ${ag.horario} => ${dataCompletaAgendamento.toISOString()} | Na janela [${inicioJanela.toISOString()} - ${fimJanela.toISOString()}]: ${estaNaJanela}`);
        return estaNaJanela;
      });
      logger.info(`[DEBUG] Filtragem manual concluída. Agendamentos na janela: ${agendamentosFiltrados.length}`);


      if (agendamentosFiltrados.length === 0) {
        logger.info("✅ Nenhum agendamento ativo encontrado NA JANELA de 120 minutos.");
        return res.status(200).send("Sem agendamentos na janela para notificar.");
      }

      let totalEnviadas = 0;

      // =============================================================
      //  ↓↓↓ LOOP PARA ENVIAR NOTIFICAÇÕES ↓↓↓
      // =============================================================
      logger.info("[DEBUG] Iniciando loop para enviar notificações...");
      for (const tokenDoc of agendamentosFiltrados) {
        const agendamento = tokenDoc.data();
        const agendamentoId = tokenDoc.id; // Pegar o ID do documento de agendamento para logs
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
          // Loga TODO o objeto de erro, não apenas a mensagem
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
           // Adicionar outros tratamentos de erro específicos do FCM se necessário
           // Ex: 'messaging/invalid-argument', 'messaging/quota-exceeded', etc.
        }
      } // Fim loop

      logger.info(`✨ =======================================================`);
      logger.info(`✨ Rotina de 120min concluída. Total notificações enviadas: ${totalEnviadas}`);
      logger.info(`✨ =======================================================`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);

    } catch (error) {
      // Este catch pega erros GERAIS, incluindo a falha na busca inicial
      logger.error("🔥🔥🔥 Erro GERAL e INESPERADO na rotina:", error);
      logger.error("Detalhes do erro geral:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return res.status(500).send("Erro interno ao processar lembretes.");
    }
  }
);

