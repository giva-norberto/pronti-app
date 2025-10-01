// --- IndexedDB e controle de abas ---
const DB_NAME = 'pronti_alerts';
const DB_VERSION = 1;
const STORE_NAME = 'alerts';
const TAB_KEY = 'pronti_alerts_master';
const DONO_ID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // ajuste dinâmico se precisar
const UM_DIA_MS = 24 * 60 * 60 * 1000;

// --- Firestore imports ---
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

// --- IndexedDB helpers ---
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function salvarAlertaLocal(alerta) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const now = Date.now();
  tx.objectStore(STORE_NAME).put({ ...alerta, notificado: false, createdAt: alerta.createdAt || now });
  tx.oncomplete = () => db.close();
}

async function marcarTodosNotificados(ids) {
  if (!ids.length) return;
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const id of ids) {
    const req = store.get(id);
    req.onsuccess = () => {
      const alerta = req.result;
      if (alerta && !alerta.notificado) {
        alerta.notificado = true;
        store.put(alerta);
      }
    };
  }
  tx.oncomplete = () => db.close();
}

async function limparAlertasAntigos() {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const agora = Date.now();
  const request = store.getAll();
  request.onsuccess = () => {
    request.result.forEach(alerta => {
      if (alerta.createdAt && (agora - alerta.createdAt > UM_DIA_MS)) {
        store.delete(alerta.id);
      }
    });
  };
  tx.oncomplete = () => db.close();
}

// --- Marcar como lido no Firestore ---
async function marcarStatusLidoFirestore(id) {
  try {
    const ref = doc(db, "filaDeNotificacoes", id);
    await updateDoc(ref, { status: "lido" });
  } catch (e) {
    console.error("Erro ao marcar como lido no Firestore:", e);
  }
}

// --- Controle de aba mestre ---
function isMasterTab() {
  let myId = sessionStorage.getItem(TAB_KEY);
  if (!myId) {
    myId = Date.now().toString();
    sessionStorage.setItem(TAB_KEY, myId);
    localStorage.setItem(TAB_KEY, myId);
    return true;
  }
  return localStorage.getItem(TAB_KEY) === myId;
}

// --- Bipar e notificar agrupado ---
async function processarAlertas() {
  if (!isMasterTab()) return;

  await limparAlertasAntigos();

  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  request.onsuccess = async () => {
    // Filtra alertas não notificados e status válido
    const pendentes = request.result.filter(
      alerta =>
        !alerta.notificado &&
        ['novo', 'erro', 'pendente'].includes(alerta.status)
    );
    if (pendentes.length > 0) {
      // --- Bipa só uma vez e notifica agrupado ---
      if (Notification.permission === 'granted') {
        new Notification('Novo Agendamento!', {
          body: `Você tem ${pendentes.length} novo(s) agendamento(s)!`,
          icon: '/icon.png',
          badge: '/badge.png'
        });
      } else {
        alert(`Você tem ${pendentes.length} novo(s) agendamento(s)!`);
      }
      const audio = new Audio('/alert.mp3');
      audio.play().catch(() => console.log('Som bloqueado até interação do usuário'));

      // Marca todos como notificados no IndexedDB e Firestore
      for (const alerta of pendentes) {
        await marcarTodosNotificados([alerta.id]);
        await marcarStatusLidoFirestore(alerta.id);
      }
    }
  };
  tx.oncomplete = () => db.close();
}

// --- Listener Firestore para salvar alertas localmente ---
function iniciarListener() {
  const q = query(
    collection(db, "filaDeNotificacoes"),
    where("paraDonoId", "==", DONO_ID),
    where("status", "in", ["novo", "erro", "pendente"])
  );

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (['added', 'modified'].includes(change.type)) {
        const alerta = { ...change.doc.data(), id: change.doc.id };
        await salvarAlertaLocal(alerta);
      }
    });
  });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
  iniciarListener();
  processarAlertas();

  // Checa a cada 2 segundos para bipar/notificar e limpar antigos
  setInterval(processarAlertas, 2000);

  // Limpa aba mestre se fechar
  window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem(TAB_KEY);
    localStorage.removeItem(TAB_KEY);
  });
});
