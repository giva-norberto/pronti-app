const admin = require("firebase-admin");

// 🔥 GARANTE INICIALIZAÇÃO (SEM DUPLICAR)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function processarFila() {
  console.log("⏳ Iniciando processamento da fila...");

  const filaRef = db.collection("fila_agendamentos");

  const snapshot = await filaRef
    .where("status", "==", "fila")
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log("✅ Nenhum item na fila");
    return;
  }

  for (const doc of snapshot.docs) {
    const item = doc.data();
    const filaId = doc.id;

    console.log("🔎 Processando:", filaId);

    try {
      const encontrouHorario = false;

      if (!encontrouHorario) {
        console.log("❌ Nenhum horário disponível ainda");
        continue;
      }

      await db.collection("agendamentos").add({
        clienteId: item.clienteId,
        profissionalId: item.profissionalId,
        empresaId: item.empresaId,
        servicos: item.servicos,
        criadoEm: admin.firestore.FieldValue.serverTimestamp()
      });

      await filaRef.doc(filaId).update({
        status: "agendado",
        agendadoEm: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("✅ Encaixado:", filaId);

    } catch (err) {
      console.error("❌ Erro ao processar:", filaId, err.message);
    }
  }

  console.log("🏁 Fim do processamento da fila");
}

module.exports = { processarFila };
