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
  admin.initializeApp();
}

const db = admin.firestore();
const fcm = admin.messaging();

// Fuso horário do Brasil (importante para construir a data corretamente)
const TIMEZONE = "America/Sao_Paulo";

// Função auxiliar para criar Date com fuso horário
function createDateInTimezone(dateString, timeString) {
    try {
        const dateObj = new Date(`${dateString}T${timeString}:00.000-03:00`);
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
    logger.info("🚀 Iniciando rotina de lembrete de 120 MINUTOS...");

    try {
      const agora = new Date();
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000); // 1h 55min
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000); // 2h
      logger.info(`Janela de busca: ${inicioJanela.toISOString()} até ${fimJanela.toISOString()}`);

      // =============================================================
      //  ↓↓↓ BUSCA DE AGENDAMENTOS ATIVOS ↓↓↓
      // =============================================================
      const snapAgendamentos = await db.collectionGroup("agendamentos")
        .where("status", "==", "ativo")
        .get();

      logger.info(`Total agendamentos ativos encontrados: ${snapAgendamentos.size}`);

      if (snapAgendamentos.empty) {
        logger.info("✅ Nenhum agendamento ATIVO encontrado no geral.");
        return res.status(200).send("Sem agendamentos ativos para verificar.");
      }

      // =============================================================
      //  ↓↓↓ FILTRAGEM MANUAL POR JANELA DE 120 MINUTOS ↓↓↓
      // =============================================================
      const agendamentosFiltrados = snapAgendamentos.docs.filter(doc => {
        const ag = doc.data();
        if (!ag.data || !ag.horario) {
            logger.warn(`Agendamento ${doc.id} sem data ou horario definidos.`);
            return false;
        }

        const dataCompletaAgendamento = createDateInTimezone(ag.data, ag.horario);
        if (!dataCompletaAgendamento) {
             logger.warn(`Agendamento ${doc.id} com data/horario inválido: ${ag.data} ${ag.horario}`);
             return false;
        }

        const estaNaJanela = dataCompletaAgendamento >= inicioJanela && dataCompletaAgendamento <= fimJanela;
        logger.info(`Agendamento ${doc.id}: ${ag.data} ${ag.horario} => ${dataCompletaAgendamento.toISOString()} | Na janela: ${estaNaJanela}`);
        return estaNaJanela;
      });

      logger.info(`Agendamentos filtrados dentro da janela: ${agendamentosFiltrados.length}`);

      if (agendamentosFiltrados.length === 0) {
        logger.info("✅ Nenhum agendamento ativo encontrado NA JANELA de 120 minutos.");
        return res.status(200).send("Sem agendamentos na janela para notificar.");
      }

      let totalEnviadas = 0;

      // =============================================================
      //  ↓↓↓ LOOP PARA ENVIAR NOTIFICAÇÕES ↓↓↓
      // =============================================================
      for (const tokenDoc of agendamentosFiltrados) {
        const agendamento = tokenDoc.data();
        if (!agendamento?.clienteId) {
             logger.error(`ERRO INESPERADO: Agendamento filtrado ${tokenDoc.id} sem clienteId.`);
             continue;
        }

        logger.info(`Processando agendamento ${tokenDoc.id} para cliente ${agendamento.clienteId}`);

        const tokenQuerySnap = await db.collection("mensagensTokens")
          .where("userId", "==", agendamento.clienteId)
          .limit(1)
          .get();

        if (tokenQuerySnap.empty) {
          logger.warn(`⚠️ Nenhum token encontrado para cliente ${agendamento.clienteId}`);
          continue;
        }

        const tokenDocToken = tokenQuerySnap.docs[0];
        const tokenData = tokenDocToken.data();
        const tokenRef = tokenDocToken.ref;

        if (!tokenData?.fcmToken) {
          logger.warn(`⚠️ Doc de token encontrado para ${agendamento.clienteId}, mas sem fcmToken.`);
          continue;
        }

        const payload = {
          notification: {
            title: "⏰ Lembrete de Agendamento",
            body: `Seu agendamento de ${agendamento.servicoNome || ''} com ${agendamento.profissionalNome || ''} começa em 2 horas!`,
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
            badge: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media"
          },
          webpush: {
            fcmOptions: {
              link: "https://prontiapp.com.br/meus-agendamentos.html"
            }
          },
          token: tokenData.fcmToken
        };

        logger.debug(`Payload FCM para cliente ${agendamento.clienteId}: ${JSON.stringify(payload)}`);

        try {
          await fcm.send(payload);
          totalEnviadas++;
          logger.info(`✅ SUCESSO ao enviar para cliente ${agendamento.clienteId}`);
        } catch (error) {
          logger.error(`🔥 FALHA no fcm.send() para ${agendamento.clienteId}`);
          logger.error("Objeto de erro completo:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

          if (error.code === 'messaging/registration-token-not-registered') {
            await tokenRef.update({
              fcmToken: admin.firestore.FieldValue.delete()
            });
            logger.warn(`Token inválido removido de ${agendamento.clienteId}`);
          }
        }
      } // Fim loop

      logger.info(`✨ Rotina de 120min concluída. Total notificações enviadas: ${totalEnviadas}`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);

    } catch (error) {
      logger.error("🔥 Erro GERAL na rotina:", error);
      return res.status(500).send("Erro interno ao enviar notificações.");
    }
  }
);
