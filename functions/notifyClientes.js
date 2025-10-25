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
      const daqui15min = new Date(agora.getTime() + 15 * 60 * 1000);

      // Buscar agendamentos que ocorrerão nos próximos 15 minutos
      const snap = await db.collection("agendamentos")
        .where("hora", ">=", agora.toISOString())
        .where("hora", "<=", daqui15min.toISOString())
        .get();

      if (snap.empty) {
        logger.info("✅ Nenhum agendamento próximo encontrado.");
        return res.status(200).send("Sem agendamentos próximos para notificar.");
      }

      let totalEnviadas = 0;
      for (const docSnap of snap.docs) {
        const agendamento = docSnap.data();
        if (!agendamento?.clienteId) continue;

        const clienteRef = db.collection("clientes").doc(agendamento.clienteId);
        const clienteSnap = await clienteRef.get();
        const cliente = clienteSnap.exists ? clienteSnap.data() : null;

        if (!cliente?.fcmToken) {
          logger.warn(`⚠️ Cliente ${agendamento.clienteId} sem token FCM.`);
          continue;
        }

        const payload = {
          notification: {
            title: "Lembrete de Agendamento",
            body: "Seu horário está chegando! 😄",
            icon: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media",
            badge: "https://firebasestorage.googleapis.com/v0/b/pronti-app-37c6e.appspot.com/o/logos%2FBX6Q7HrVMrcCBqe72r7K76EBPkX2%2F1758126224738-LOGO%20PRONTI%20FUNDO%20AZUL.png?alt=media"
          },
          webpush: {
            fcmOptions: {
              link: "https://prontiapp.com.br/meus-agendamentos.html"
            }
          },
          token: cliente.fcmToken
        };

        try {
          await fcm.send(payload);
          totalEnviadas++;
          logger.info(`📩 Notificação enviada para cliente ${agendamento.clienteId}`);
        } catch (error) {
          logger.error(`❌ Erro ao enviar notificação para ${agendamento.clienteId}:`, error);
          if (error.code === 'messaging/registration-token-not-registered') {
            await clienteRef.update({
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
