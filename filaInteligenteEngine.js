import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";
import { db } from "./vitrini-firebase.js";
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ---- FUNÇÕES PONTE -----

export async function ofertarVagaParaFila(empresaId, vaga) {
  const fn = httpsCallable(getFunctions(), "ofertarVagaParaFila");
  const res = await fn({ empresaId, vaga });
  return res.data;
}
export async function processarOfertasExpiradas(empresaId) {
  const fn = httpsCallable(getFunctions(), "processarOfertasExpiradas");
  const res = await fn({ empresaId });
  return res.data;
}
export async function confirmarOfertaFila(empresaId, ofertaId) {
  const fn = httpsCallable(getFunctions(), "confirmarOfertaFila");
  const res = await fn({ empresaId, ofertaId });
  return res.data;
}
export async function recusarOfertaFila(empresaId, ofertaId) {
  const fn = httpsCallable(getFunctions(), "recusarOfertaFila");
  const res = await fn({ empresaId, ofertaId });
  return res.data;
}

// ---- LISTENERS DE LEITURA -----

export function ouvirOfertasFila(empresaId, callback) {
  const ofertasRef = collection(db, "empresarios", empresaId, "ofertas_fila");
  const qOfertas = query(ofertasRef, orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(qOfertas, (snap) => {
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(lista);
  });
}
export function ouvirFilaEspera(empresaId, callback) {
  const filaRef = collection(db, "empresarios", empresaId, "fila_espera");
  const qFila = query(filaRef, orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(qFila, (snap) => {
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(lista);
  });
}
