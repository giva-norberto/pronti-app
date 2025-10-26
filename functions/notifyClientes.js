/**
 * Cloud Function isolada para lembrete de agendamentos próximos (clientes).
 * Versão padronizada com logger, admin e estilo consistente com index.js.
 *
 * Essa função pode ser chamada manualmente (HTTPS)
 * ou configurada no Cloud Scheduler para rodar automaticamente.
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Inicializa o Firebase Admin (só se ainda não estiver inicializado)
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
    logger.info("🚀 Iniciando rotina de lembrete de agendamentos (clientes)...");

    try {
      const agora = new Date();
      // Lembrete de 5 minutos, como solicitado
      const daqui5min = new Date(agora.getTime() + 5 * 60 * 1000);

      // Usa collectionGroup para pesquisar em TODAS as subcoleções "agendamentos"
      const snap = await db.collectionGroup("agendamentos")
        .where("status", "==", "ativo") // Garante que não pegue cancelados
        .where("hora", ">=", agora.toISOString())
        .where("hora", "<=", daqui5min.toISOString())
        .get();

      if (snap.empty) {
        logger.info("✅ Nenhum agendamento próximo encontrado.");
        return res.status(200).send("Sem agendamentos próximos para notificar.");
      }

      let totalEnviadas = 0;
      for (const docSnap of snap.docs) {
        const agendamento = docSnap.data();
        if (!agendamento?.clienteId) continue;

        // Buscando o token na coleção correta "mensagensTokens"
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
            body: `Seu agendamento de ${agendamento.servicoNome || ''} com ${agendamento.profissionalNome || ''} começa em 5 minutos!`,
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%2OAZUL.png?alt=media",
            badge: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%2OAZUL.png?alt=media"
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
          logger.info(`📩 Notificação enviada para cliente ${agendamento.clienteId}`);
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

      logger.info(`✨ Rotina concluída. Total enviadas: ${totalEnviadas}`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);
    } catch (error) {
      logger.error("🔥 Erro geral na rotina de notificação de clientes:", error);
      return res.status(500).send("Erro interno ao enviar notificações.");
    }
  }
);
