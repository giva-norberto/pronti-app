const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Inicialização
if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = "southamerica-east1";
const db = getFirestore("pronti-app");
const fcm = admin.messaging();

// =========================
// Constantes de status
// =========================
const STATUS_FILA = {
  FILA: "fila",
  OFERTA_ENVIADA: "oferta_enviada",
  ATENDIDO: "atendido",
  EXPIRADO: "expirado",
  CANCELADO: "cancelado",
};

const STATUS_OFERTA = {
  PENDENTE: "pendente",
  ACEITA: "aceita",
  RECUSADA: "recusada",
  EXPIRADA: "expirada",
};

// =========================
// Utilitários
// =========================
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

function agoraTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function getAgoraDate() {
  return new Date();
}

function construirLinkConfirmacao(filaId, empresaId) {
  return `https://prontiapp.com.br/vitrine.html?empresa=${encodeURIComponent(
    String(empresaId || "")
  )}&filaId=${encodeURIComponent(String(filaId || ""))}&modo=fila`;
}

function getOfertaExpiracaoTimestamp(minutos = 5) {
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + minutos * 60 * 1000)
  );
}

// =========================
// Geração de slots
// =========================
function gerarSlotsDisponiveis(
  horariosConfig,
  agendamentos,
  dataISO,
  duracaoTotal
) {
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

        const duracaoAg =
          Number(ag.servicoDuracao) ||
          Number(ag.duracaoTotal) ||
          (Array.isArray(ag.servicos)
            ? (ag.servicos || []).reduce(
                (t, s) => t + (Number(s?.duracao) || 0),
                0
              )
            : 0);

        const fimAg = inicioAg + (duracaoAg || 0);
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

// =========================
// Tokens / Push
// =========================
async function buscarTokenDoCliente(item) {
  if (item?.fcmToken) return item.fcmToken;
  if (!item?.clienteId) return null;

  try {
    const tokenSnap = await db
      .collection("mensagensTokens")
      .doc(item.clienteId)
      .get();

    if (!tokenSnap.exists) return null;

    const dados = tokenSnap.data() || {};
    if (dados.ativo === false) return null;

    return dados.fcmToken || null;
  } catch (error) {
    console.error(
      `❌ Erro ao buscar token do cliente ${item?.clienteId}:`,
      error.message
    );
    return null;
  }
}

async function enviarPushOferta(item, filaId, dataOferta, horarioOferta) {
  const token = await buscarTokenDoCliente(item);
  const link = construirLinkConfirmacao(filaId, item?.empresaId);

  if (!token) {
    console.log(
      `ℹ️ Cliente ${
        item?.clienteId || "desconhecido"
      } sem token. Oferta ficará salva sem push.`
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
        empresaId: String(item?.empresaId || ""),
        profissionalId: String(item?.profissionalId || ""),
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

    console.log(
      `✅ Push de oferta enviado ao cliente ${item?.clienteId}:`,
      response
    );
    return true;
  } catch (error) {
    console.error(
      `❌ Erro ao enviar push de oferta para cliente ${item?.clienteId}:`,
      error.message
    );

    if (error.code === "messaging/registration-token-not-registered") {
      console.warn(`⚠️ Token inválido do cliente ${item?.clienteId}.`);
    }

    return false;
  }
}

// =========================
// Operações da fila
// =========================
async function reservarFilaParaProcessamento(docFila) {
  try {
    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(docFila.ref);
      const dados = freshSnap.data();

      if (!dados) {
        throw new Error("Fila não encontrada.");
      }

      if (dados.status !== STATUS_FILA.FILA) {
        throw new Error(`Fila fora do estado processável: ${dados.status}`);
      }

      if (dados.processando === true) {
        throw new Error("Fila já em processamento.");
      }

      transaction.update(docFila.ref, {
        processando: true,
        processandoEm: agoraTimestamp(),
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
    ultimaTentativaEm: agoraTimestamp(),
  });
}

async function buscarOfertaPendenteDaFila(empresaId, filaId) {
  const snap = await db
    .collection("empresarios")
    .doc(empresaId)
    .collection("ofertas_fila")
    .where("filaId", "==", filaId)
    .where("status", "==", STATUS_OFERTA.PENDENTE)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0];
}

async function criarOfertaParaFila({
  item,
  filaId,
  horarioEscolhido,
  dataOferta,
}) {
  const empresaId = item.empresaId;
  const expiraEm = getOfertaExpiracaoTimestamp(5);
  const linkConfirmacao = construirLinkConfirmacao(filaId, empresaId);

  const ofertaExistente = await buscarOfertaPendenteDaFila(empresaId, filaId);
  if (ofertaExistente) {
    console.log(`ℹ️ Já existe oferta pendente para a fila ${filaId}.`);
    return {
      ofertaId: ofertaExistente.id,
      expiraEm: ofertaExistente.data()?.expiraEm || expiraEm,
      linkConfirmacao,
      pushEnviado: Boolean(ofertaExistente.data()?.pushOfertaEnviado),
      reutilizada: true,
    };
  }

  const pushEnviado = await enviarPushOferta(
    item,
    filaId,
    dataOferta,
    horarioEscolhido
  );

  const ofertaRef = await db
    .collection("empresarios")
    .doc(empresaId)
    .collection("ofertas_fila")
    .add({
      status: STATUS_OFERTA.PENDENTE,
      clienteId: item.clienteId,
      clienteNome: item.clienteNome || "Cliente",
      empresaId,
      filaId,
      data: dataOferta,
      horario: horarioEscolhido,
      servicoNome: item?.servicos?.[0]?.nome || "",
      profissionalId: item.profissionalId,
      profissionalNome: item.profissionalNome || "",
      linkConfirmacao,
      expiraEm,
      createdAt: agoraTimestamp(),
      pushOfertaEnviado: pushEnviado,
    });

  return {
    ofertaId: ofertaRef.id,
    expiraEm,
    linkConfirmacao,
    pushEnviado,
    reutilizada: false,
  };
}

// =========================
// Núcleo de processamento
// =========================
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
      ultimaTentativaEm: agoraTimestamp(),
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
      ultimaTentativaEm: agoraTimestamp(),
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
    duracaoTotal
  );

  if (!slotsDisponiveis.length) {
    console.log(`❌ Nenhum slot disponível para a fila ${filaId}`);
    await liberarFilaSemOferta(docFila);
    return;
  }

  const horarioEscolhido = slotsDisponiveis[0];
  const dataOferta = dataFila;

  const { expiraEm, linkConfirmacao, pushEnviado } = await criarOfertaParaFila({
    item,
    filaId,
    horarioEscolhido,
    dataOferta,
  });

  await docFila.ref.update({
    status: STATUS_FILA.OFERTA_ENVIADA,
    processando: false,
    dataOferta,
    horarioOferta: horarioEscolhido,
    ofertaExpiraEm: expiraEm,
    linkConfirmacao,
    pushOfertaEnviado: pushEnviado,
    ofertaEnviadaEm: agoraTimestamp(),
    ultimaTentativaEm: agoraTimestamp(),
    ultimoErro: admin.firestore.FieldValue.delete(),
  });

  console.log(
    `✅ Oferta criada/enviada para fila ${filaId} em ${horarioEscolhido}`
  );
}

async function processarFila() {
  console.log("⏳ Iniciando processamento da fila...");

  const snapshot = await db
    .collection("fila_agendamentos")
    .where("status", "==", STATUS_FILA.FILA)
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
          ultimaTentativaEm: agoraTimestamp(),
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

// =========================
// Callable: ofertar vaga manualmente
// =========================
const ofertarVagaParaFila = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const { empresaId, vaga } = data || {};

    try {
      if (!empresaId) {
        return { ok: false, motivo: "empresa_id_obrigatorio" };
      }

      const dataVaga = vaga?.data || null;
      const horarioVaga = vaga?.horario || null;
      const profissionalId = vaga?.profissionalId || null;

      if (!dataVaga || !horarioVaga || !profissionalId) {
        return { ok: false, motivo: "vaga_invalida" };
      }

      const filaSnap = await db
        .collection("fila_agendamentos")
        .where("empresaId", "==", empresaId)
        .where("profissionalId", "==", profissionalId)
        .where("dataFila", "==", dataVaga)
        .where("status", "==", STATUS_FILA.FILA)
        .limit(1)
        .get();

      if (filaSnap.empty) {
        return { ok: false, motivo: "nenhum_cliente_na_fila" };
      }

      const docFila = filaSnap.docs[0];
      const item = docFila.data();
      const filaId = docFila.id;

      const ofertaExistente = await buscarOfertaPendenteDaFila(
        empresaId,
        filaId
      );
      if (ofertaExistente) {
        return { ok: false, motivo: "ja_existe_oferta_pendente" };
      }

      const expiraEm = getOfertaExpiracaoTimestamp(5);
      const linkConfirmacao = construirLinkConfirmacao(filaId, empresaId);
      const pushEnviado = await enviarPushOferta(
        item,
        filaId,
        dataVaga,
        horarioVaga
      );

      await db
        .collection("empresarios")
        .doc(empresaId)
        .collection("ofertas_fila")
        .add({
          status: STATUS_OFERTA.PENDENTE,
          clienteId: item.clienteId,
          clienteNome: item.clienteNome || "Cliente",
          empresaId,
          filaId,
          data: dataVaga,
          horario: horarioVaga,
          servicoNome: vaga?.servicoNome || item?.servicos?.[0]?.nome || "",
          profissionalId,
          profissionalNome:
            vaga?.profissionalNome || item?.profissionalNome || "",
          linkConfirmacao,
          expiraEm,
          createdAt: agoraTimestamp(),
          pushOfertaEnviado: pushEnviado,
        });

      await docFila.ref.update({
        status: STATUS_FILA.OFERTA_ENVIADA,
        processando: false,
        dataOferta: dataVaga,
        horarioOferta: horarioVaga,
        ofertaExpiraEm: expiraEm,
        linkConfirmacao,
        pushOfertaEnviado: pushEnviado,
        ofertaEnviadaEm: agoraTimestamp(),
        ultimaTentativaEm: agoraTimestamp(),
      });

      return {
        ok: true,
        filaId,
        horario: horarioVaga,
        data: dataVaga,
        pushEnviado,
      };
    } catch (e) {
      console.error("❌ Erro em ofertarVagaParaFila:", e);
      return {
        ok: false,
        motivo: "erro_backend",
        erro: e.message || e.toString(),
      };
    }
  });

// =========================
// Callable: processar expiradas
// =========================
const processarOfertasExpiradas = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const { empresaId } = data || {};

    try {
      if (!empresaId) {
        return { ok: false, motivo: "empresa_id_obrigatorio" };
      }

      const agora = admin.firestore.Timestamp.now();

      const ofertasSnap = await db
        .collection("empresarios")
        .doc(empresaId)
        .collection("ofertas_fila")
        .where("status", "==", STATUS_OFERTA.PENDENTE)
        .where("expiraEm", "<=", agora)
        .limit(50)
        .get();

      if (ofertasSnap.empty) {
        return { ok: true, processadas: 0 };
      }

      let processadas = 0;

      for (const ofertaDoc of ofertasSnap.docs) {
        const oferta = ofertaDoc.data();
        const filaId = oferta?.filaId;

        await ofertaDoc.ref.update({
          status: STATUS_OFERTA.EXPIRADA,
          expiradaEm: agoraTimestamp(),
        });

        if (filaId) {
          const filaRef = db.collection("fila_agendamentos").doc(filaId);
          await filaRef.update({
            status: STATUS_FILA.FILA,
            processando: false,
            ultimaTentativaEm: agoraTimestamp(),
          });
        }

        processadas += 1;
      }

      return { ok: true, processadas };
    } catch (e) {
      console.error("❌ Erro em processarOfertasExpiradas:", e);
      return {
        ok: false,
        motivo: "erro_backend",
        erro: e.message || e.toString(),
      };
    }
  });

// =========================
// Callable: confirmar oferta
// =========================
const confirmarOfertaFila = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const { empresaId, ofertaId } = data || {};

    try {
      if (!empresaId || !ofertaId) {
        return { ok: false, motivo: "parametros_invalidos" };
      }

      const ofertaRef = db
        .collection("empresarios")
        .doc(empresaId)
        .collection("ofertas_fila")
        .doc(ofertaId);

      const snap = await ofertaRef.get();
      if (!snap.exists) return { ok: false, motivo: "oferta_nao_encontrada" };

      const oferta = snap.data();

      if (oferta.status !== STATUS_OFERTA.PENDENTE) {
        return { ok: false, motivo: "oferta_indisponivel" };
      }

      if (
        oferta.expiraEm &&
        oferta.expiraEm.toDate &&
        oferta.expiraEm.toDate() < getAgoraDate()
      ) {
        await ofertaRef.update({
          status: STATUS_OFERTA.EXPIRADA,
          expiradaEm: agoraTimestamp(),
        });

        if (oferta.filaId) {
          await db.collection("fila_agendamentos").doc(oferta.filaId).update({
            status: STATUS_FILA.FILA,
            processando: false,
            ultimaTentativaEm: agoraTimestamp(),
          });
        }

        return { ok: false, motivo: "oferta_expirada" };
      }

      const filaRef = db.collection("fila_agendamentos").doc(oferta.filaId);
      const filaSnap = await filaRef.get();

      if (!filaSnap.exists) {
        return { ok: false, motivo: "fila_nao_encontrada" };
      }

      const fila = filaSnap.data();

      const agendamentoData = {
        clienteId: oferta.clienteId,
        clienteNome: fila?.clienteNome || oferta?.clienteNome || "Cliente",
        empresaId,
        profissionalId: oferta.profissionalId,
        profissionalNome:
          oferta.profissionalNome || fila?.profissionalNome || "",
        data: oferta.data,
        horario: oferta.horario,
        status: "ativo",
        servicos: Array.isArray(fila?.servicos) ? fila.servicos : [],
        duracaoTotal: Number(fila?.duracaoTotal) || 0,
        origem: "fila_inteligente",
        filaId: oferta.filaId,
        criadoEm: agoraTimestamp(),
      };

      await db
        .collection("empresarios")
        .doc(empresaId)
        .collection("agendamentos")
        .add(agendamentoData);

      await ofertaRef.update({
        status: STATUS_OFERTA.ACEITA,
        aceitaEm: agoraTimestamp(),
      });

      await filaRef.update({
        status: STATUS_FILA.ATENDIDO,
        atendidoEm: agoraTimestamp(),
        processando: false,
      });

      return {
        ok: true,
        horario: oferta.horario,
        clienteNome: fila?.clienteNome || oferta?.clienteNome || "Cliente",
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

// =========================
// Callable: recusar oferta
// =========================
const recusarOfertaFila = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const { empresaId, ofertaId } = data || {};

    try {
      if (!empresaId || !ofertaId) {
        return { ok: false, motivo: "parametros_invalidos" };
      }

      const ofertaRef = db
        .collection("empresarios")
        .doc(empresaId)
        .collection("ofertas_fila")
        .doc(ofertaId);

      const snap = await ofertaRef.get();
      if (!snap.exists) return { ok: false, motivo: "oferta_nao_encontrada" };

      const oferta = snap.data();

      if (oferta.status !== STATUS_OFERTA.PENDENTE) {
        return { ok: false, motivo: "oferta_ja_resolvida" };
      }

      const filaRef = db.collection("fila_agendamentos").doc(oferta.filaId);

      await ofertaRef.update({
        status: STATUS_OFERTA.RECUSADA,
        recusadaEm: agoraTimestamp(),
      });

      await filaRef.update({
        status: STATUS_FILA.FILA,
        processando: false,
        ultimaTentativaEm: agoraTimestamp(),
      });

      return { ok: true };
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
  processarItemFila,
  ofertarVagaParaFila,
  processarOfertasExpiradas,
  confirmarOfertaFila,
  recusarOfertaFila,
};
