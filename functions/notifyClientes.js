/**
 * Cloud Function para lembrete de agendamentos (120 MINUTOS).
 * CORRIGIDO: Busca token pelo campo 'userId' em vez do ID do documento.
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Inicialização Simplificada
if (!admin.apps.length) {
  admin.initializeApp(); // Detecta automaticamente o projeto no ambiente do Cloud Functions
}

const db = admin.firestore();
const fcm = admin.messaging();

exports.notificarClientes = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    logger.info("🚀 Iniciando rotina de lembrete de 120 MINUTOS...");

    try {
      const agora = new Date();
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000); // 1h 55min
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000); // 2h

      const snapAgendamentos = await db.collectionGroup("agendamentos")
        .where("status", "==", "ativo")
        .where("hora", ">=", inicioJanela.toISOString())
        .where("hora", "<=", fimJanela.toISOString())
        .get();

      if (snapAgendamentos.empty) {
        logger.info("✅ Nenhum agendamento encontrado na janela de 120 minutos.");
        return res.status(200).send("Sem agendamentos próximos para notificar.");
      }

      let totalEnviadas = 0;
      for (const docSnap of snapAgendamentos.docs) {
        const agendamento = docSnap.data();
        if (!agendamento?.clienteId) {
          logger.warn(`Agendamento ${docSnap.id} sem clienteId.`);
          continue;
        }

        // =============================================================
        //  ↓↓↓ CORREÇÃO PRINCIPAL: Buscar token usando where() ↓↓↓
        // =============================================================
        const tokenQuerySnap = await db.collection("mensagensTokens")
          .where("userId", "==", agendamento.clienteId)
          // .where("ativo", "==", true) // Descomente se você tiver um campo "ativo"
          .limit(1) // Pega apenas o primeiro token encontrado (caso haja duplicados)
          .get();

        if (tokenQuerySnap.empty) {
          logger.warn(`⚠️ Nenhum token encontrado para cliente ${agendamento.clienteId} (userId=${agendamento.clienteId})`);
          continue;
        }

        // Pega os dados e a referência do documento encontrado
        const tokenDoc = tokenQuerySnap.docs[0];
        const tokenData = tokenDoc.data();
        const tokenRef = tokenDoc.ref; // Referência para poder deletar se inválido
        // =============================================================
        //  ↑↑↑ FIM DA CORREÇÃO PRINCIPAL ↑↑↑
        // =============================================================

        if (!tokenData?.fcmToken) {
          logger.warn(`⚠️ Documento de token encontrado para ${agendamento.clienteId}, mas sem o campo fcmToken.`);
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

        try {
          logger.info(`Tentando enviar para token: ${tokenData.fcmToken} do cliente ${agendamento.clienteId}`); // Log adicionado antes
          await fcm.send(payload);
          totalEnviadas++;
          logger.info(`✅ SUCESSO ao enviar para cliente ${agendamento.clienteId}`);
        } catch (error) {
          logger.error(`🔥🔥🔥 FALHA no fcm.send() para ${agendamento.clienteId}`); // Log adicionado antes
          logger.error("Objeto de erro completo:", JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log adicionado antes

          if (error.code === 'messaging/registration-token-not-registered') {
            await tokenRef.update({ // Usa a referência correta
              fcmToken: admin.firestore.FieldValue.delete()
            });
            logger.warn(`Token inválido removido de ${agendamento.clienteId}`);
          }
        }
      } // Fim do loop for

      logger.info(`✨ Rotina de 120min concluída. Total enviadas: ${totalEnviadas}`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);

    } catch (error) {
      logger.error("🔥 Erro GERAL na rotina (fora do loop ou na busca inicial):", error);
      return res.status(500).send("Erro interno ao enviar notificações.");
    }
  }
);

