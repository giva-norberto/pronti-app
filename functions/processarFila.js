const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Inicialização
if (!admin.apps.length) {
  admin.initializeApp();
}

// IMPORTANTE: usar o banco nomeado oficial do Pronti
const db = getFirestore("pronti-app");
const fcm = admin.messaging();

// Status oficiais da fila
const STATUS_FILA_AGUARDANDO = "aguardando";
const STATUS_FILA_OFERTA_ENVIADA = "oferta_enviada";
const STATUS_FILA_CONFIRMADO = "confirmado";
const STATUS_FILA_RECUSADO = "recusado";
const STATUS_FILA_EXPIRADO = "expirado";

const STATUS_OFERTA_PENDENTE = "pendente";
const STATUS_OFERTA_CONFIRMADA = "confirmada";
const STATUS_OFERTA_RECUSADA = "recusada";
const STATUS_OFERTA_EXPIRADA = "expirada";

// Compatibilidade com registros antigos
const STATUS_ANTIGO_FILA = "fila";

// Utilitários
function getDiaSemanaId(dataISO) {
  const [ano, mes, dia] = String(dataISO).split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getDay();
}

function horaParaMinutos(hora) {
  if (!hora || !String(hora).includes(":")) return 0;
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
}

function minutosParaHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function intervaloSobrepoe(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && fimA > inicioB;
}

function obterDuracaoAgendamento(ag) {
  if (ag?.duracaoTotal) return Number(ag.duracaoTotal) || 0;
  if (ag?.servicoDuracao) return Number(ag.servicoDuracao) || 0;
  if (ag?.duracao) return Number(ag.duracao) || 0;

  if (Array.isArray(ag?.servicos)) {
    return ag.servicos.reduce((total, servico) => {
      return total + (Number(servico?.duracao) || 0);
    }, 0);
  }

  return 30;
}

function gerarSlotsDisponiveis(horariosConfig, agendamentos, dataISO, duracaoTotal) {
  if (!horariosConfig) return [];

  const diaId = getDiaSemanaId(dataISO);
  const diaConfig = horariosConfig[diaId];

  if (
    !diaConfig ||
    !diaConfig.ativo ||
    !Array.isArray(diaConfig.blocos) ||
    diaConfig.blocos.length === 0
  ) {
    return [];
  }

  const intervalo = Number(horariosConfig.intervalo) || 30;
  const slots = [];

  for (const bloco of diaConfig.blocos) {
    const inicioBloco = horaParaMinutos(bloco.inicio);
    const fimBloco = horaParaMinutos(bloco.fim);

    let cursor = inicioBloco;

    while (cursor + duracaoTotal <= fimBloco) {
      const inicioSlot = cursor;
      const fimSlot = cursor + duracaoTotal;

      const conflitou = agendamentos.some((ag) => {
        const inicioAg = horaParaMinutos(ag.horario);
        const duracaoAg = obterDuracaoAgendamento(ag);
        const fimAg = inicioAg + duracaoAg;

        return intervaloSobrepoe(inicioSlot, fimSlot, inicioAg, fimAg);
      });

      if (!conflitou) {
        slots.push(minutosParaHora(inicioSlot));
      }

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
  return `https://prontiapp.com.br/vitrine.html?empresa=${encodeURIComponent(
    String(empresaId || "")
  )}&filaId=${encodeURIComponent(String(filaId || ""))}&modo=fila`;
}

async function enviarPushOferta(item, filaId, dataOferta, horarioOferta) {
  const token = await buscarTokenDoCliente(item);
  const link = construirLinkConfirmacao(filaId, item?.empresaId);

  if (!token) {
    console.log(
      `ℹ️ Cliente ${item?.clienteId || "desconhecido"} sem token. Oferta ficará salva sem push.`
    );
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
    console.error(
      `❌ Erro ao enviar push de oferta para cliente ${item.clienteId}:`,
      error.message
    );

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

      const statusValido =
        dados?.status === STATUS_FILA_AGUARDANDO || dados?.status === STATUS_ANTIGO_FILA;

      if (!dados || !statusValido || dados.processando === true) {
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
    status: STATUS_FILA_AGUARDANDO,
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
  const dataFila = item?.dataFila || item?.dataDesejada;
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
    .where("status", "in", ["ativo", "confirmado", "agendado"])
    .get();

  const agendamentosDoDia = agendamentosSnap.docs.map((d) => d.data());

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

  const ofertaRef = await db
    .collection("empresarios")
    .doc(empresaId)
    .collection("ofertas_fila")
    .add({
      status: STATUS_OFERTA_PENDENTE,

      clienteId: item.clienteId,
      clienteNome: item.clienteNome || "Cliente",
      clienteEmail: item.clienteEmail || null,

      empresaId,
      filaId,

      data: dataOferta,
      horario: horarioEscolhido,

      servicos: item.servicos || [],
      servicoNome: item.servicos && item.servicos[0]?.nome ? item.servicos[0].nome : "",

      duracaoTotal,

      profissionalId,
      profissionalNome: item.profissionalNome || "",

      linkConfirmacao,
      expiraEm,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      pushOfertaEnviado: pushEnviado,
    });

  await docFila.ref.update({
    status: STATUS_FILA_OFERTA_ENVIADA,
    processando: false,

    ofertaId: ofertaRef.id,
    dataOferta,
    horarioOferta: horarioEscolhido,
    ofertaExpiraEm: expiraEm,
    linkConfirmacao,
    pushOfertaEnviado: pushEnviado,

    ofertaEnviadaEm: admin.firestore.FieldValue.serverTimestamp(),
    ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `✅ Oferta criada para fila ${filaId} em ${horarioEscolhido}. Oferta: ${ofertaRef.id}`
  );
}

async function processarFila() {
  console.log("⏳ Iniciando processamento da fila...");

  const snapshot = await db
    .collection("fila_agendamentos")
    .where("status", "in", [STATUS_FILA_AGUARDANDO, STATUS_ANTIGO_FILA])
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
        console.error(
          `❌ Erro ao atualizar falha da fila ${docFila.id}:`,
          erroUpdate.message
        );
      }
    }
  }

  console.log("🏁 Fim do processamento da fila");
}

async function horarioAindaDisponivel({ empresaId, profissionalId, data, horario }) {
  const agendamentosRef = db
    .collection("empresarios")
    .doc(empresaId)
    .collection("agendamentos");

  const snap = await agendamentosRef
    .where("data", "==", data)
    .where("horario", "==", horario)
    .where("profissionalId", "==", profissionalId)
    .where("status", "in", ["ativo", "confirmado", "agendado"])
    .limit(1)
    .get();

  return snap.empty;
}

// ========= CONFIRMAR OFERTA =============
const confirmarOfertaFila = functions.https.onCall(async (data, context) => {
  const { empresaId, ofertaId } = data || {};

  if (!empresaId || !ofertaId) {
    return {
      ok: false,
      motivo: "dados_incompletos",
    };
  }

  try {
    const ofertaRef = db
      .collection("empresarios")
      .doc(empresaId)
      .collection("ofertas_fila")
      .doc(ofertaId);

    const ofertaSnap = await ofertaRef.get();

    if (!ofertaSnap.exists) {
      return {
        ok: false,
        motivo: "oferta_nao_encontrada",
      };
    }

    const oferta = ofertaSnap.data();

    if (oferta.status !== STATUS_OFERTA_PENDENTE) {
      return {
        ok: false,
        motivo: "oferta_indisponivel",
      };
    }

    if (oferta.expiraEm && oferta.expiraEm.toMillis() < Date.now()) {
      await ofertaRef.update({
        status: STATUS_OFERTA_EXPIRADA,
        expiradaEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (oferta.filaId) {
        await db.collection("fila_agendamentos").doc(oferta.filaId).update({
          status: STATUS_FILA_AGUARDANDO,
          processando: false,
          ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        ok: false,
        motivo: "oferta_expirada",
      };
    }

    const disponivel = await horarioAindaDisponivel({
      empresaId,
      profissionalId: oferta.profissionalId,
      data: oferta.data,
      horario: oferta.horario,
    });

    if (!disponivel) {
      await ofertaRef.update({
        status: STATUS_OFERTA_EXPIRADA,
        motivoExpiracao: "horario_ocupado",
        expiradaEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (oferta.filaId) {
        await db.collection("fila_agendamentos").doc(oferta.filaId).update({
          status: STATUS_FILA_AGUARDANDO,
          processando: false,
          ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        ok: false,
        motivo: "horario_indisponivel",
      };
    }

    const filaRef = db.collection("fila_agendamentos").doc(oferta.filaId);
    const agendamentoRef = db
      .collection("empresarios")
      .doc(empresaId)
      .collection("agendamentos")
      .doc();

    await db.runTransaction(async (transaction) => {
      const ofertaAtualSnap = await transaction.get(ofertaRef);
      const filaSnap = await transaction.get(filaRef);

      if (!ofertaAtualSnap.exists) {
        throw new Error("oferta_nao_encontrada");
      }

      const ofertaAtual = ofertaAtualSnap.data();

      if (ofertaAtual.status !== STATUS_OFERTA_PENDENTE) {
        throw new Error("oferta_indisponivel");
      }

      if (!filaSnap.exists) {
        throw new Error("fila_nao_encontrada");
      }

      const fila = filaSnap.data();

      transaction.set(agendamentoRef, {
        clienteId: oferta.clienteId,
        clienteNome: oferta.clienteNome || fila.clienteNome || "Cliente",
        clienteEmail: oferta.clienteEmail || fila.clienteEmail || null,

        empresaId,

        profissionalId: oferta.profissionalId,
        profissionalNome: oferta.profissionalNome || fila.profissionalNome || "",

        data: oferta.data,
        horario: oferta.horario,

        status: "ativo",

        servicos: fila.servicos || oferta.servicos || [],
        duracaoTotal: fila.duracaoTotal || oferta.duracaoTotal || null,

        origem: "fila_inteligente",
        filaId: oferta.filaId,
        ofertaId,

        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(ofertaRef, {
        status: STATUS_OFERTA_CONFIRMADA,
        confirmadaEm: admin.firestore.FieldValue.serverTimestamp(),
        agendamentoId: agendamentoRef.id,
      });

      transaction.update(filaRef, {
        status: STATUS_FILA_CONFIRMADO,
        confirmadoEm: admin.firestore.FieldValue.serverTimestamp(),
        agendamentoId: agendamentoRef.id,
        ofertaId,
        processando: false,
      });
    });

    return {
      ok: true,
      agendamentoId: agendamentoRef.id,
      horario: oferta.horario,
      clienteNome: oferta.clienteNome || "Cliente",
    };
  } catch (e) {
    console.error("❌ Erro em confirmarOfertaFila:", e);

    return {
      ok: false,
      motivo: "erro_backend",
      erro: e.message || e.toString(),
    };
  }
});

// ========= RECUSAR OFERTA =============
const recusarOfertaFila = functions.https.onCall(async (data, context) => {
  const { empresaId, ofertaId } = data || {};

  if (!empresaId || !ofertaId) {
    return {
      ok: false,
      motivo: "dados_incompletos",
    };
  }

  try {
    const ofertaRef = db
      .collection("empresarios")
      .doc(empresaId)
      .collection("ofertas_fila")
      .doc(ofertaId);

    const snap = await ofertaRef.get();

    if (!snap.exists) {
      return {
        ok: false,
        motivo: "oferta_nao_encontrada",
      };
    }

    const oferta = snap.data();

    if (oferta.status !== STATUS_OFERTA_PENDENTE) {
      return {
        ok: false,
        motivo: "oferta_ja_resolvida",
      };
    }

    const filaRef = db.collection("fila_agendamentos").doc(oferta.filaId);

    await db.runTransaction(async (transaction) => {
      const ofertaAtualSnap = await transaction.get(ofertaRef);

      if (!ofertaAtualSnap.exists) {
        throw new Error("oferta_nao_encontrada");
      }

      const ofertaAtual = ofertaAtualSnap.data();

      if (ofertaAtual.status !== STATUS_OFERTA_PENDENTE) {
        throw new Error("oferta_ja_resolvida");
      }

      transaction.update(ofertaRef, {
        status: STATUS_OFERTA_RECUSADA,
        recusadaEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(filaRef, {
        status: STATUS_FILA_RECUSADO,
        processando: false,
        recusadoEm: admin.firestore.FieldValue.serverTimestamp(),
        ultimaTentativaEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return {
      ok: true,
    };
  } catch (e) {
    console.error("❌ Erro em recusarOfertaFila:", e);

    return {
      ok: false,
      motivo: "erro_backend",
      erro: e.message || e.toString(),
    };
  }
});

module.exports = {
  processarFila,
  confirmarOfertaFila,
  recusarOfertaFila,
};
