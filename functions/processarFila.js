const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Inicialização
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore("pronti-app");
const fcm = admin.messaging();

// Utilitários
function getDiaSemanaId(dataISO) {
  const [ano, mes, dia] = String(dataISO).split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getDay();
}
function horaParaMinutos(hora) {
  if (!hora || !String(hora).includes(":")) return 0;
  const [h, m] = String(hora).split(":").map(Number);
  return (h * 60) + m;
}
function minutosParaHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function intervaloSobrepoe(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && fimA > inicioB;
}
// ⚡️ Não filtra slots por turno — retorna todos slots do dia.
function gerarSlotsDisponiveis(horariosConfig, agendamentos, dataISO, duracaoTotal) {
  if (!horariosConfig) return [];
  const diaId = getDiaSemanaId(dataISO);
  const diaConfig = horariosConfig[diaId];
  if (!diaConfig || !diaConfig.ativo || !Array.isArray(diaConfig.blocos) || diaConfig.blocos.length === 0) return [];
  const intervalo = Number(horariosConfig.intervalo) || 30;
  const slots = [];
  for (const bloco of diaConfig.blocos) {
    const inicioBloco = horaParaMinutos(bloco.inicio);
    const fimBloco = horaParaMinutos(bloco.fim);
    let cursor = inicioBloco;
    while ((cursor + duracaoTotal) <= fimBloco) {
      const inicioSlot = cursor;
      const fimSlot = cursor + duracaoTotal;
      const conflitou = agendamentos.some((ag) => {
        const inicioAg = horaParaMinutos(ag.horario);
        const duracaoAg = Number(ag.servicoDuracao) || 0;
        const fimAg = inicioAg + duracaoAg;
        return intervaloSobrepoe(inicioSlot, fimSlot, inicioAg, fimAg);
      });
      if (!conflitou) slots.push(minutosParaHora(inicioSlot));
      cursor += intervalo;
    }
  }
  return slots;
}
async function buscarTokenDoCliente(item) {
  if (item?.fcmToken) return item.fcmToken;
  if (!item?.clienteId) return null;
  try {
    const tokenSnap = await db.collection("mensagensTokens").doc(item.clienteId).get();
    if (!tokenSnap.exists) return null;
    const dados = tokenSnap.data() || {};
    if (dados.ativo === false) return null;
    return dados.fcmToken || null;
  } catch (error) {
    console.error(`❌ Erro ao buscar token do cliente ${item.clienteId}:`, error.message);
    return null;
  }
}
function construirLinkConfirmacao(filaId, empresaId) {
  return `https://prontiapp.com.br/vitrine.html?empresa=${encodeURIComponent(String(empresaId || ""))}&filaId=${encodeURIComponent(String(filaId || ""))}&modo=fila`;
}
async function enviarPushOferta(item, filaId, dataOferta, horarioOferta) {
  const token = await buscarTokenDoCliente(item);
  const link = construirLinkConfirmacao(filaId, item?.empresaId);
  if (!token) {
    console.log(`ℹ️ Cliente ${item?.clienteId || "desconhecido"} sem token. Oferta ficará salva sem push.`);
    return false;
  }
  const title = "Encontramos um horário para você 🎉";
  const body = `Temos um horário em ${dataOferta} às ${horarioOferta}. Toque para confirmar sua vaga.`;
  try {
    const response = await fcm.send({
      token,
      notification: {
        title,
        body,
      },
      data: {
        tipo: "fila_oferta",
        filaId: String(filaId || ""),
        empresaId: String(item.empresaId || ""),
        profissionalId: String(item.profissionalId || ""),
        dataOferta: String(dataOferta || ""),
        horarioOferta: String(horarioOferta || ""),
        link,
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          priority: "high",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "mutable-content": 1,
          },
        },
      },
      webpush: {
        notification: {
          title,
          body,
        },
        fcmOptions: {
          link,
        },
        headers: {
          Urgency: "high",
        },
      },
    });
    console.log(`✅ Push de oferta enviado ao cliente ${item.clienteId}:`, response);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar push de oferta para cliente ${item.clienteId}:`, error.message);
    if (error.code === "messaging/registration-token-not-registered") {
      console.warn(`⚠️ Token inválido do cliente ${item.clienteId}.`);
    }
    return false;
  }
}
async function reservarFilaParaProcessamento(docFila) {
  try {
    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(docFila.ref);
      const dados = freshSnap.data();
      if (!dados || dados.status !== "fila" || dados.processando === true) {
        throw new Error("Fila já processada ou em processamento.");
      }
      transaction.update(docFila.ref, {
        processando: true,
        processandoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    console.log(`ℹ️ Fila ${docFila.id} não reservada: ${error.message}`);
    return false;
  }
}
async function liberarFilaSemOferta(docFila) {
  await docFila.ref.update({
    processando: false,
    ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ⚡️ ALTERADO: Busca vaga para o dia inteiro, NÃO usa turno/preferencia!
async function processarItemFila(docFila) {
  const conseguiuReservar = await reservarFilaParaProcessamento(docFila);
  if (!conseguiuReservar) return;

  const snapAtual = await docFila.ref.get();
  const item = snapAtual.data();
  const filaId = docFila.id;

  console.log("🔎 Processando fila:", filaId);

  const empresaId = item?.empresaId;
  const profissionalId = item?.profissionalId;
  const dataFila = item?.dataFila;
  const duracaoTotal = Number(item?.duracaoTotal) || 0;

  if (!empresaId || !profissionalId || !dataFila || duracaoTotal <= 0) {
    console.log(`⚠️ Fila ${filaId} com dados incompletos. Ignorando.`);
    await docFila.ref.update({
      processando: false,
      ultimoErro: "dados_incompletos",
      ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const horariosRef = db
    .collection("empresarios")
    .doc(empresaId)
    .collection("profissionais")
    .doc(profissionalId)
    .collection("configuracoes")
    .doc("horarios");

  const agendamentosRef = db
    .collection("empresarios")
    .doc(empresaId)
    .collection("agendamentos");

  const horariosSnap = await horariosRef.get();

  if (!horariosSnap.exists) {
    console.log(`⚠️ Horários não encontrados para profissional ${profissionalId}`);
    await docFila.ref.update({
      processando: false,
      ultimoErro: "horarios_nao_encontrados",
      ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const horariosConfig = horariosSnap.data();

  const agendamentosSnap = await agendamentosRef
    .where("data", "==", dataFila)
    .where("profissionalId", "==", profissionalId)
    .where("status", "==", "ativo")
    .get();

  const agendamentosDoDia = agendamentosSnap.docs.map((d) => d.data());

  // ⚡️ Mude aqui: Não usa turno! Busca vaga do dia inteiro
  const slotsDisponiveis = gerarSlotsDisponiveis(
    horariosConfig,
    agendamentosDoDia,
    dataFila,
    duracaoTotal
  );

  if (!slotsDisponiveis.length) {
    console.log(`❌ Nenhum slot disponível para a fila ${filaId}`);
    await liberarFilaSemOferta(docFila);
    return;
  }

  const horarioEscolhido = slotsDisponiveis[0];
  const dataOferta = dataFila;
  const expiraEm = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 5 * 60 * 1000)
  );

  const linkConfirmacao = construirLinkConfirmacao(filaId, empresaId);
  const pushEnviado = await enviarPushOferta(item, filaId, dataOferta, horarioEscolhido);

  // Cria oferta pendente para o frontend exibir o card!
  await db
    .collection("empresarios")
    .doc(empresaId)
    .collection("ofertas_fila")
    .add({
      status: "pendente",
      clienteId: item.clienteId,
      empresaId,
      filaId,
      data: dataOferta,
      horario: horarioEscolhido,
      servicoNome: item.servicos && item.servicos[0]?.nome,
      profissionalId: profissionalId,
      profissionalNome: item.profissionalNome || "",
      linkConfirmacao,
      expiraEm,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      pushOfertaEnviado: pushEnviado
    });

  // Atualiza fila para registro!
  await docFila.ref.update({
    status: "oferta_enviada",
    processando: false,
    dataOferta,
    horarioOferta: horarioEscolhido,
    ofertaExpiraEm: expiraEm,
    linkConfirmacao,
    pushOfertaEnviado: pushEnviado,
    ofertaEnviadaEm: admin.firestore.FieldValue.serverTimestamp(),
    ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Oferta criada para fila ${filaId} em ${horarioEscolhido} e oferta pendente registrada`);
}

async function processarFila() {
  console.log("⏳ Iniciando processamento da fila...");
  const snapshot = await db
    .collection("fila_agendamentos")
    .where("status", "==", "fila")
    .limit(20)
    .get();
  if (snapshot.empty) {
    console.log("✅ Nenhum item na fila");
    return;
  }
  for (const docFila of snapshot.docs) {
    try {
      await processarItemFila(docFila);
    } catch (error) {
      console.error(`❌ Erro ao processar fila ${docFila.id}:`, error.message);
      try {
        await docFila.ref.update({
          processando: false,
          ultimoErro: error.message || "erro_desconhecido",
          ultimaTentativaEm: admin*

