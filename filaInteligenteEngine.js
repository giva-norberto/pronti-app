// filaInteligenteEngine.js
import {
  db
} from "./firebase-config.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   CONFIG
========================================================= */
const FILA_COLLECTION = "fila_espera";
const OFERTAS_COLLECTION = "ofertas_fila";
const AGENDAMENTOS_COLLECTION = "agendamentos";

const TEMPO_OFERTA_MINUTOS = 5;

/* =========================================================
   HELPERS
========================================================= */
function nowMs() {
  return Date.now();
}

function addMinutesToNow(minutes) {
  return Timestamp.fromMillis(nowMs() + minutes * 60 * 1000);
}

function gerarTokenConfirmacao() {
  return `offer_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function montarSlotKey({ data, horario, profissionalId, servicoId }) {
  return `${data}_${horario}_${profissionalId || "semprof"}_${servicoId || "semserv"}`;
}

function normalizarPeriodo(periodo) {
  if (!periodo) return null;
  return String(periodo).trim().toLowerCase();
}

function horarioDentroDoPeriodo(horario, periodo) {
  if (!periodo) return true;
  const [hora] = horario.split(":").map(Number);
  const p = normalizarPeriodo(periodo);

  if (p === "manha") return hora >= 6 && hora < 12;
  if (p === "tarde") return hora >= 12 && hora < 18;
  if (p === "noite") return hora >= 18 && hora <= 23;
  return true;
}

/* =========================================================
   VERIFICA SE SLOT JÁ FOI OCUPADO
========================================================= */
async function slotJaOcupado(empresaId, { data, horario, profissionalId }) {
  const agRef = collection(db, "empresas", empresaId, AGENDAMENTOS_COLLECTION);

  let qBase = query(
    agRef,
    where("data", "==", data),
    where("horario", "==", horario),
    where("status", "in", ["confirmado", "pendente_confirmacao", "aguardando_pagamento"])
  );

  if (profissionalId) {
    qBase = query(
      agRef,
      where("data", "==", data),
      where("horario", "==", horario),
      where("profissionalId", "==", profissionalId),
      where("status", "in", ["confirmado", "pendente_confirmacao", "aguardando_pagamento"])
    );
  }

  const snap = await getDocs(qBase);
  return !snap.empty;
}

/* =========================================================
   BUSCA PRÓXIMO DA FILA
========================================================= */
async function buscarProximoDaFila(empresaId, vaga) {
  const filaRef = collection(db, "empresas", empresaId, FILA_COLLECTION);

  const qFila = query(
    filaRef,
    where("status", "==", "aguardando"),
    where("servicoId", "==", vaga.servicoId),
    where("dataDesejada", "==", vaga.data),
    orderBy("prioridade", "desc"),
    orderBy("createdAt", "asc"),
    limit(50)
  );

  const snap = await getDocs(qFila);

  if (snap.empty) return null;

  for (const item of snap.docs) {
    const d = item.data();

    const profissionalOk =
      !vaga.profissionalId ||
      !d.profissionalId ||
      d.profissionalId === vaga.profissionalId;

    const horarioOk =
      Array.isArray(d.horariosAceitos) &&
      d.horariosAceitos.includes(vaga.horario);

    const periodoOk = horarioDentroDoPeriodo(vaga.horario, d.periodo);

    if (profissionalOk && horarioOk && periodoOk) {
      return {
        id: item.id,
        ...d
      };
    }
  }

  return null;
}

/* =========================================================
   CRIA OFERTA PARA PRÓXIMO DA FILA
========================================================= */
export async function ofertarVagaParaFila(empresaId, vaga) {
  try {
    const ocupado = await slotJaOcupado(empresaId, vaga);
    if (ocupado) {
      return { ok: false, motivo: "slot_ocupado" };
    }

    const candidato = await buscarProximoDaFila(empresaId, vaga);
    if (!candidato) {
      return { ok: false, motivo: "ninguem_na_fila" };
    }

    const ofertaRef = collection(db, "empresas", empresaId, OFERTAS_COLLECTION);
    const filaDocRef = doc(db, "empresas", empresaId, FILA_COLLECTION, candidato.id);

    const slotKey = montarSlotKey({
      data: vaga.data,
      horario: vaga.horario,
      profissionalId: vaga.profissionalId,
      servicoId: vaga.servicoId
    });

    const oferta = {
      empresaId,
      filaId: candidato.id,
      clienteId: candidato.clienteId || null,
      clienteNome: candidato.clienteNome || "",
      clienteTelefone: candidato.clienteTelefone || "",
      servicoId: vaga.servicoId,
      servicoNome: vaga.servicoNome || "",
      profissionalId: vaga.profissionalId || null,
      profissionalNome: vaga.profissionalNome || "",
      data: vaga.data,
      horario: vaga.horario,
      slotKey,
      status: "pendente",
      expiraEm: addMinutesToNow(TEMPO_OFERTA_MINUTOS),
      createdAt: serverTimestamp(),
      respondedAt: null,
      agendamentoId: null,
      tokenConfirmacao: gerarTokenConfirmacao(),
      origem: "fila_inteligente"
    };

    const novaOferta = await addDoc(ofertaRef, oferta);

    await updateDoc(filaDocRef, {
      status: "ofertado",
      ultimaOfertaEm: serverTimestamp(),
      updatedAt: serverTimestamp(),
      totalOfertasRecebidas: (candidato.totalOfertasRecebidas || 0) + 1
    });

    // aqui você pode chamar sua função de push/FCM
    // await enviarPushOfertaFila({ empresaId, ofertaId: novaOferta.id, ...oferta });

    return {
      ok: true,
      ofertaId: novaOferta.id,
      filaId: candidato.id,
      clienteNome: candidato.clienteNome || "",
      tokenConfirmacao: oferta.tokenConfirmacao
    };
  } catch (error) {
    console.error("Erro ao ofertar vaga para fila:", error);
    return { ok: false, motivo: "erro_interno", error };
  }
}

/* =========================================================
   PROCESSA OFERTAS EXPIRADAS E REOFERTA
========================================================= */
export async function processarOfertasExpiradas(empresaId) {
  try {
    const ofertasRef = collection(db, "empresas", empresaId, OFERTAS_COLLECTION);

    const qPendentes = query(
      ofertasRef,
      where("status", "==", "pendente"),
      orderBy("expiraEm", "asc"),
      limit(50)
    );

    const snap = await getDocs(qPendentes);

    if (snap.empty) {
      return { ok: true, expiradas: 0, reofertas: 0 };
    }

    let expiradas = 0;
    let reofertas = 0;

    for (const ofertaDoc of snap.docs) {
      const oferta = ofertaDoc.data();
      const expiraMs = oferta.expiraEm?.toMillis?.() || 0;

      if (expiraMs > nowMs()) continue;

      const ofertaRef = doc(db, "empresas", empresaId, OFERTAS_COLLECTION, ofertaDoc.id);
      const filaRef = doc(db, "empresas", empresaId, FILA_COLLECTION, oferta.filaId);

      await updateDoc(ofertaRef, {
        status: "expirada",
        respondedAt: serverTimestamp()
      });

      await updateDoc(filaRef, {
        status: "aguardando",
        updatedAt: serverTimestamp()
      });

      expiradas++;

      const reoferta = await ofertarVagaParaFila(empresaId, {
        data: oferta.data,
        horario: oferta.horario,
        profissionalId: oferta.profissionalId || null,
        profissionalNome: oferta.profissionalNome || "",
        servicoId: oferta.servicoId,
        servicoNome: oferta.servicoNome || ""
      });

      if (reoferta.ok) reofertas++;
    }

    return { ok: true, expiradas, reofertas };
  } catch (error) {
    console.error("Erro ao processar ofertas expiradas:", error);
    return { ok: false, error };
  }
}

/* =========================================================
   CONFIRMA OFERTA COM TRAVA TRANSACIONAL
========================================================= */
export async function confirmarOfertaFila(empresaId, ofertaId) {
  const ofertaRef = doc(db, "empresas", empresaId, OFERTAS_COLLECTION, ofertaId);

  try {
    const resultado = await runTransaction(db, async (transaction) => {
      const ofertaSnap = await transaction.get(ofertaRef);

      if (!ofertaSnap.exists()) {
        throw new Error("oferta_nao_encontrada");
      }

      const oferta = ofertaSnap.data();

      if (oferta.status !== "pendente") {
        throw new Error("oferta_indisponivel");
      }

      const expiraMs = oferta.expiraEm?.toMillis?.() || 0;
      if (expiraMs <= nowMs()) {
        transaction.update(ofertaRef, {
          status: "expirada",
          respondedAt: serverTimestamp()
        });
        throw new Error("oferta_expirada");
      }

      const agRef = collection(db, "empresas", empresaId, AGENDAMENTOS_COLLECTION);

      let qAg = query(
        agRef,
        where("data", "==", oferta.data),
        where("horario", "==", oferta.horario),
        where("status", "in", ["confirmado", "pendente_confirmacao", "aguardando_pagamento"])
      );

      if (oferta.profissionalId) {
        qAg = query(
          agRef,
          where("data", "==", oferta.data),
          where("horario", "==", oferta.horario),
          where("profissionalId", "==", oferta.profissionalId),
          where("status", "in", ["confirmado", "pendente_confirmacao", "aguardando_pagamento"])
        );
      }

      const ocupados = await getDocs(qAg);
      if (!ocupados.empty) {
        transaction.update(ofertaRef, {
          status: "cancelada",
          respondedAt: serverTimestamp()
        });
        throw new Error("slot_ja_ocupado");
      }

      const novoAgendamentoRef = doc(collection(db, "empresas", empresaId, AGENDAMENTOS_COLLECTION));
      const filaRef = doc(db, "empresas", empresaId, FILA_COLLECTION, oferta.filaId);

      transaction.set(novoAgendamentoRef, {
        empresaId,
        clienteId: oferta.clienteId || null,
        clienteNome: oferta.clienteNome || "",
        clienteTelefone: oferta.clienteTelefone || "",
        servicoId: oferta.servicoId,
        servicoNome: oferta.servicoNome || "",
        profissionalId: oferta.profissionalId || null,
        profissionalNome: oferta.profissionalNome || "",
        data: oferta.data,
        horario: oferta.horario,
        origem: "fila_inteligente",
        status: "confirmado",
        valor: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ofertaFilaId: ofertaId
      });

      transaction.update(ofertaRef, {
        status: "aceita",
        respondedAt: serverTimestamp(),
        agendamentoId: novoAgendamentoRef.id
      });

      transaction.update(filaRef, {
        status: "atendido",
        updatedAt: serverTimestamp()
      });

      return {
        agendamentoId: novoAgendamentoRef.id,
        clienteNome: oferta.clienteNome || "",
        data: oferta.data,
        horario: oferta.horario
      };
    });

    return { ok: true, ...resultado };
  } catch (error) {
    console.error("Erro ao confirmar oferta:", error);
    return {
      ok: false,
      motivo: error?.message || "erro_confirmacao"
    };
  }
}

/* =========================================================
   RECUSA OFERTA
========================================================= */
export async function recusarOfertaFila(empresaId, ofertaId) {
  try {
    const ofertaRef = doc(db, "empresas", empresaId, OFERTAS_COLLECTION, ofertaId);
    const ofertaSnap = await getDoc(ofertaRef);

    if (!ofertaSnap.exists()) {
      return { ok: false, motivo: "oferta_nao_encontrada" };
    }

    const oferta = ofertaSnap.data();

    if (oferta.status !== "pendente") {
      return { ok: false, motivo: "oferta_indisponivel" };
    }

    const filaRef = doc(db, "empresas", empresaId, FILA_COLLECTION, oferta.filaId);

    await updateDoc(ofertaRef, {
      status: "recusada",
      respondedAt: serverTimestamp()
    });

    await updateDoc(filaRef, {
      status: "aguardando",
      updatedAt: serverTimestamp()
    });

    const reoferta = await ofertarVagaParaFila(empresaId, {
      data: oferta.data,
      horario: oferta.horario,
      profissionalId: oferta.profissionalId || null,
      profissionalNome: oferta.profissionalNome || "",
      servicoId: oferta.servicoId,
      servicoNome: oferta.servicoNome || ""
    });

    return {
      ok: true,
      reofertaFeita: !!reoferta.ok
    };
  } catch (error) {
    console.error("Erro ao recusar oferta:", error);
    return { ok: false, motivo: "erro_interno", error };
  }
}

/* =========================================================
   LISTENER PARA PAINEL ADMIN
========================================================= */
export function ouvirOfertasFila(empresaId, callback) {
  const ofertasRef = collection(db, "empresas", empresaId, OFERTAS_COLLECTION);

  const qOfertas = query(
    ofertasRef,
    orderBy("createdAt", "desc"),
    limit(100)
  );

  return onSnapshot(qOfertas, (snap) => {
    const lista = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    callback(lista);
  });
}

/* =========================================================
   LISTENER PARA FILA
========================================================= */
export function ouvirFilaEspera(empresaId, callback) {
  const filaRef = collection(db, "empresas", empresaId, FILA_COLLECTION);

  const qFila = query(
    filaRef,
    orderBy("createdAt", "desc"),
    limit(100)
  );

  return onSnapshot(qFila, (snap) => {
    const lista = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    callback(lista);
  });
}
