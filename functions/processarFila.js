const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore("pronti-app");
const fcm = admin.messaging();

function getDiaSemanaId(dataISO) {
  const [ano, mes, dia] = String(dataISO).split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  const diaSemana = data.getDay();

  const mapa = {
    0: "domingo",
    1: "segunda",
    2: "terca",
    3: "quarta",
    4: "quinta",
    5: "sexta",
    6: "sabado",
  };

  return mapa[diaSemana];
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

function filtrarSlotsPorTurno(slots, turno) {
  if (!turno || turno === "Qualquer horário") return slots;

  return slots.filter((slot) => {
    const hora = Math.floor(horaParaMinutos(slot) / 60);

    if (turno === "Manhã") return hora < 12;
    if (turno === "Tarde") return hora >= 12 && hora < 18;
    if (turno === "Noite") return hora >= 18;

    return true;
  });
}

function gerarSlotsDisponiveis(horariosConfig, agendamentos, dataISO, duracaoTotal, turnoPreferido) {
  if (!horariosConfig) return [];

  const diaId = getDiaSemanaId(dataISO);
  const diaConfig = horariosConfig[diaId];

  if (!diaConfig || !diaConfig.ativo || !Array.isArray(diaConfig.blocos) || diaConfig.blocos.length === 0) {
    return [];
  }

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

      if (!conflitou) {
        slots.push(minutosParaHora(inicioSlot));
      }

      cursor += intervalo;
    }
  }

  return filtrarSlotsPorTurno(slots, turnoPreferido);
}

async function buscarPrecoDosServicos(empresaId, servicos) {
  const lista = Array.isArray(servicos) ? servicos : [];
  let precoTotal = 0;

  for (const servico of lista) {
    const servicoId = servico?.id;
    if (!servicoId) continue;

    try {
      const servicoRef = db
        .collection("empresarios")
        .doc(empresaId)
        .collection("servicos")
        .doc(servicoId);

      const servicoSnap = await servicoRef.get();

      if (servicoSnap.exists) {
        const dados = servicoSnap.data() || {};
        const preco =
          Number(dados.precoPromocional) ||
          Number(dados.preco) ||
          Number(dados.valor) ||
          0;

        precoTotal += preco;
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar preço do serviço ${servicoId}:`, error.message);
    }
  }

  return precoTotal;
}

async function montarServicoAgendamento(empresaId, servicos, duracaoTotal) {
  const lista = Array.isArray(servicos) ? servicos : [];
  const precoTotal = await buscarPrecoDosServicos(empresaId, lista);

  return {
    servicoId: lista.map((s) => s.id).filter(Boolean).join(","),
    servicoNome: lista.map((s) => s.nome).filter(Boolean).join(" + "),
    servicoDuracao: Number(duracaoTotal) || 0,
    servicoPrecoCobrado: precoTotal,
    servicoPrecoOriginal: precoTotal,
  };
}

async function buscarTokenDoCliente(item) {
  if (item?.fcmToken) return item.fcmToken;
  if (!item?.clienteId) return null;

  try {
    const tokenSnap = await db.collection("mensagensTokens").doc(item.clienteId).get();
    if (!tokenSnap.exists) return null;

    const dados = tokenSnap.data() || {};
    return dados.fcmToken || null;
  } catch (error) {
    console.error(`❌ Erro ao buscar token do cliente ${item.clienteId}:`, error.message);
    return null;
  }
}

async function enviarPushCliente(item, dataAgendada, horarioAgendado) {
  const token = await buscarTokenDoCliente(item);

  if (!token) {
    console.log(`ℹ️ Cliente ${item?.clienteId || "desconhecido"} sem token. Push ignorado.`);
    return;
  }

  const title = "Horário encontrado no Pronti 🎉";
  const body = `Seu encaixe foi confirmado para ${dataAgendada} às ${horarioAgendado}.`;

  try {
    const response = await fcm.send({
      token,
      notification: {
        title,
        body,
      },
      data: {
        tipo: "fila_agendada",
        empresaId: String(item.empresaId || ""),
        profissionalId: String(item.profissionalId || ""),
        data: String(dataAgendada || ""),
        horario: String(horarioAgendado || ""),
        link: `https://prontiapp.com.br/vitrine.html?empresa=${encodeURIComponent(String(item.empresaId || ""))}`,
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
          link: `https://prontiapp.com.br/vitrine.html?empresa=${encodeURIComponent(String(item.empresaId || ""))}`,
        },
        headers: {
          Urgency: "high",
        },
      },
    });

    console.log(`✅ Push enviado ao cliente ${item.clienteId}:`, response);
  } catch (error) {
    console.error(`❌ Erro ao enviar push para cliente ${item.clienteId}:`, error.message);

    if (error.code === "messaging/registration-token-not-registered") {
      console.warn(`⚠️ Token inválido do cliente ${item.clienteId}.`);
    }
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

async function liberarFilaSemEncaixe(docFila) {
  await docFila.ref.update({
    processando: false,
    ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
  });
}

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
  const turnoPreferido = item?.preferencias?.turno || "Qualquer horário";

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

  const slotsDisponiveis = gerarSlotsDisponiveis(
    horariosConfig,
    agendamentosDoDia,
    dataFila,
    duracaoTotal,
    turnoPreferido
  );

  if (!slotsDisponiveis.length) {
    console.log(`❌ Nenhum slot disponível para a fila ${filaId}`);
    await liberarFilaSemEncaixe(docFila);
    return;
  }

  const horarioEscolhido = slotsDisponiveis[0];
  const servicoInfo = await montarServicoAgendamento(empresaId, item.servicos, duracaoTotal);

  const novoAgendamento = {
    clienteFoto: item.clienteFoto || null,
    clienteId: item.clienteId || null,
    clienteNome: item.clienteNome || "Cliente",
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    data: dataFila,
    empresaId,
    horario: horarioEscolhido,
    profissionalId,
    profissionalNome: item.profissionalNome || "Profissional",
    servicoDuracao: servicoInfo.servicoDuracao,
    servicoId: servicoInfo.servicoId,
    servicoNome: servicoInfo.servicoNome,
    servicoPrecoCobrado: servicoInfo.servicoPrecoCobrado,
    servicoPrecoOriginal: servicoInfo.servicoPrecoOriginal,
    status: "ativo",
  };

  const agendamentoCriadoRef = await agendamentosRef.add(novoAgendamento);

  await docFila.ref.update({
    status: "agendado",
    processando: false,
    agendamentoId: agendamentoCriadoRef.id,
    dataAgendada: dataFila,
    horarioAgendado: horarioEscolhido,
    agendadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  await enviarPushCliente(item, dataFila, horarioEscolhido);

  console.log(`✅ Fila ${filaId} encaixada com sucesso em ${horarioEscolhido}`);
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
          ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (erroUpdate) {
        console.error(`❌ Erro ao atualizar falha da fila ${docFila.id}:`, erroUpdate.message);
      }
    }
  }

  console.log("🏁 Fim do processamento da fila");
}

module.exports = { processarFila };
