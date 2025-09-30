// indexedAlerts.js
const DB_NAME = 'pronti_alerts';
const DB_VERSION = 1;
const STORE_NAME = 'alerts';

// --- Inicializa IndexedDB ---
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

// --- Adiciona alerta no IndexedDB ---
async function salvarAlertaLocal(alerta) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ ...alerta, notificado: false });
  tx.oncomplete = () => db.close();
}

// --- Marca alerta como notificado ---
async function marcarNotificado(id) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(id);
  request.onsuccess = () => {
    const alerta = request.result;
    if (alerta) {
      alerta.notificado = true;
      store.put(alerta);
    }
  };
  tx.oncomplete = () => db.close();
}

// --- Dispara notificações locais dos alertas não notificados ---
async function processarAlertas() {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  request.onsuccess = () => {
    request.result.forEach((alerta) => {
      if (!alerta.notificado) {
        // Notificação visual
        if (Notification.permission === 'granted') {
          new Notification(alerta.titulo || 'Novo Agendamento', {
            body: alerta.mensagem,
            icon: '/icon.png',
            badge: '/badge.png'
          });
        }

        // Som de alerta
        const audio = new Audio('/alert.mp3');
        audio.play().catch(() => console.log('Som bloqueado até interação do usuário'));

        // Marca como notificado
        marcarNotificado(alerta.id);
      }
    });
  };
  tx.oncomplete = () => db.close();
}

// --- Listener do Firestore para salvar alertas localmente ---
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const donoId = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

function iniciarListener() {
  const q = query(
    collection(db, "alerts"),
    where("paraDonoId", "==", donoId),
    where("status", "in", ["novo", "erro"])
  );

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        const alerta = { ...change.doc.data(), id: change.doc.id };
        await salvarAlertaLocal(alerta);
        processarAlertas();
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
  processarAlertas(); // processa alertas que já estão no IndexedDB
});
