/**
 * Cloud Function para lembrete de agendamentos (120 MINUTOS).
 * CORRIGIDO: Busca todos ativos e filtra manualmente data/hora (strings).
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
// Ajuste se necessário (ex: America/Sao_Paulo)
const TIMEZONE = "America/Sao_Paulo";

// Função auxiliar para criar Date com fuso horário
function createDateInTimezone(dateString, timeString) {
    // Combina data e hora
    const dateTimeString = `${dateString}T${timeString}:00`;
    // Tenta interpretar no fuso horário local e depois converte para UTC internamente
    // Para comparações robustas, o ideal seria usar uma lib como date-fns-tz,
    // mas vamos tentar com o Date padrão, assumindo que o servidor roda em UTC ou tem locale configurado.
    // O formato 'YYYY-MM-DDTHH:MM:SS' é geralmente interpretado como local time pelo new Date().
    // Se o servidor estiver em UTC, pode haver diferença. Testar é crucial.
    // Uma abordagem mais segura seria usar UTC e comparar com UTC:
    // const agoraUTC = new Date();
    // const inicioJanelaUTC = new Date(agoraUTC.getTime() + 115 * 60 * 1000);
    // const fimJanelaUTC = new Date(agoraUTC.getTime() + 120 * 60 * 1000);
    // const dataCompletaUTC = new Date(`${dateString}T${timeString}:00Z`); // Adiciona 'Z' para UTC
    // return dataCompleta >= inicioJanelaUTC && dataCompleta <= fimJanelaUTC;

    // Tentativa com horário local (considerando -03:00 para São Paulo)
    // CUIDADO: Horário de verão pode afetar isso se não usar libs.
    try {
        // Assume que as strings representam o horário de Brasília (-03:00)
        return new Date(`${dateString}T${timeString}:00.000-03:00`);
    } catch(e) {
        logger.error(`Erro ao criar data para ${dateString} ${timeString}:`, e);
        return null; // Retorna null se a data/hora for inválida
    }
}


exports.notificarClientes = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    logger.info("🚀 Iniciando rotina de lembrete de 120 MINUTOS...");

    try {
      const agora = new Date(); // Data/hora atual do servidor
      // Janela de tempo (baseada no 'agora' do servidor)
      const inicioJanela = new Date(agora.getTime() + 115 * 60 * 1000); // 1h 55min a partir de agora
      const fimJanela = new Date(agora.getTime() + 120 * 60 * 1000); // 2h a partir de agora
      logger.info(`Janela de busca: ${inicioJanela.toISOString()} até ${fimJanela.toISOString()}`);


      // =============================================================
      //  ↓↓↓ CORREÇÃO PRINCIPAL: Buscar só ativos, filtrar depois ↓↓↓
      // =============================================================
      const snapAgendamentos = await db.collectionGroup("agendamentos")
        .where("status", "==", "ativo") // ÚNICO filtro que o Firestore pode fazer eficientemente aqui
        .get();

      if (snapAgendamentos.empty) {
        logger.info("✅ Nenhum agendamento ATIVO encontrado no geral.");
        return res.status(200).send("Sem agendamentos ativos para verificar.");
      }

      // Filtra manualmente no código
      const agendamentosFiltrados = snapAgendamentos.docs.filter(doc => {
        const ag = doc.data();
        if (!ag.data || !ag.horario) {
            logger.warn(`Agendamento ${doc.id} sem data ou horario definidos.`);
            return false;
        }

        // Monta um objeto Date completo a partir das strings
        const dataCompletaAgendamento = createDateInTimezone(ag.data, ag.horario);

        if (!dataCompletaAgendamento) { // Se a data for inválida
             logger.warn(`Agendamento ${doc.id} com data/horario inválido: ${ag.data} ${ag.horario}`);
             return false;
        }

        // Compara o horário do agendamento com a janela de tempo atual
        const estaNaJanela = dataCompletaAgendamento >= inicioJanela && dataCompletaAgendamento <= fimJanela;
        if(estaNaJanela) {
            logger.info(`Agendamento ${doc.id} (${ag.data} ${ag.horario}) ESTÁ na janela.`);
        }
        return estaNaJanela;
      });
      // =============================================================
      //  ↑↑↑ FIM DA CORREÇÃO PRINCIPAL ↑↑↑
      // =============================================================

      if (agendamentosFiltrados.length === 0) {
        logger.info("✅ Nenhum agendamento ativo encontrado NA JANELA de 120 minutos.");
        return res.status(200).send("Sem agendamentos na janela para notificar.");
      }

      logger.info(`Encontrados ${agendamentosFiltrados.length} agendamentos na janela.`);

      let totalEnviadas = 0;
      // Loop sobre os agendamentos JÁ FILTRADOS
      for (const tokenDoc of agendamentosFiltrados) {
        const agendamento = tokenDoc.data(); // Pega os dados do agendamento filtrado
        // O clienteId deve existir, pois foi usado no filtro implícito
        if (!agendamento?.clienteId) {
             logger.error(`ERRO INESPERADO: Agendamento filtrado ${tokenDoc.id} sem clienteId.`);
             continue; // Segurança extra
        }


        // Busca o token (usando where como antes, que estava correto)
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

        try {
          logger.info(`Tentando enviar para token: ${tokenData.fcmToken} do cliente ${agendamento.clienteId}`);
          await fcm.send(payload);
          totalEnviadas++;
          logger.info(`✅ SUCESSO ao enviar para cliente ${agendamento.clienteId}`);
        } catch (error) {
          logger.error(`🔥🔥🔥 FALHA no fcm.send() para ${agendamento.clienteId}`);
          logger.error("Objeto de erro completo:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

          if (error.code === 'messaging/registration-token-not-registered') {
            await tokenRef.update({
              fcmToken: admin.firestore.FieldValue.delete()
            });
            logger.warn(`Token inválido removido de ${agendamento.clienteId}`);
          }
        }
      } // Fim do loop for

      logger.info(`✨ Rotina de 120min concluída. Total enviadas: ${totalEnviadas}`);
      return res.status(200).send(`Notificações enviadas: ${totalEnviadas}`);

    } catch (error) {
       // Este catch agora pegaria erros na busca inicial OU erros inesperados no loop
      logger.error("🔥 Erro GERAL na rotina:", error);
      return res.status(500).send("Erro interno ao enviar notificações.");
    }
  }
);
