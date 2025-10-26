/**
 * Cloud Function para lembrete de agendamentos (120 MINUTOS).
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

if (!admin.apps.length) {
  const detectedProjectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    "pronti-app-37c6e";

  admin.initializeApp({ projectId: detectedProjectId });
}

const db = admin.firestore();
const fcm = admin.messaging();

exports.notificarClientes = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    logger.info("🚀 Iniciando rotina de lembrete de 120 MINUTOS...");

    try {
      const agora = new Date();
      
      // LÓGICA DE 120 MINUTOS:
      // Para evitar spam, só enviamos se o agendamento for entre 115 e 120 minutos a partir de agora.
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000); // 1h 55min
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000); // 2h

      const snap = await db.collectionGroup("agendamentos")
        .where("status", "==", "ativo")
        .where("hora", ">=", inicioJanela.toISOString())
        .where("hora", "<=", fimJanela.toISOString())
        .get();

      if (snap.empty) {
        logger.info("✅ Nenhum agendamento encontrado na janela de 120 minutos.");
        return res.status(200).send("Sem agendamentos próximos para notificar.");
      }

      let totalEnviadas = 0;
      for (const docSnap of snap.docs) {
        const agendamento = docSnap.data();
        if (!agendamento?.clienteId) continue;

        const tokenRef = db.collection("mensagensTokens").doc(agendamento.clienteId);
        const tokenSnap = await tokenRef.get();
        const tokenData = tokenSnap.exists ? tokenSnap.data() : null;

        if (!tokenData?.fcmToken) {
          logger.warn(`⚠️ Cliente ${agendamento.clienteId} sem token FCM.`);
          continue;
        }

        const payload = {
          notification: {
            title: "⏰ Lembrete de Agendamento",
            body: `Seu agendamento de ${agendamento.servicoNome || ''} com ${agendamento.profissionalNome || ''} começa em 2 horas!`, // <-- Mensagem atualizada
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

        try {
          await fcm.send(payload);
          totalEnviadas++;
          logger.info(`📩 Notificação de 120min enviada para cliente ${agendamento.clienteId}`);
        } catch (error) {
          logger.error(`❌ Erro ao enviar notificação para ${agendamento.clienteId}:`, error);
          if (error.code === 'messaging/registration-token-not-registered') {
            await tokenRef.update({
              fcmToken: admin.firestore.FieldValue.delete()
            });
            logger.warn(`Token inválido removido de ${agendamento.clienteId}`);
          }
        }
      }

      logger.info(`✨ Rotina de 120min concluída. Total enviadas: ${totalEnviadas}`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);
    } catch (error) {
      logger.error("🔥 Erro geral na rotina de notificação de clientes:", error);
      return res.status(500).send("Erro interno ao enviar notificações.");
    }
  }
);
