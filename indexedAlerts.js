// --- Configuração do IndexedDB e controle de abas ---
const DB_NAME = 'pronti_alerts';
const DB_VERSION = 1;
const STORE_NAME = 'alerts';
const TAB_KEY = 'pronti_alerts_master'; // controle entre abas
const DONO_ID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // Troque dinamicamente no seu painel/app
const UM_DIA_MS = 24 * 60 * 60 * 1000;

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

// --- Salva alerta no IndexedDB, sobrescrevendo o campo notificado e createdAt se não existir ---
async function salvarAlertaLocal(alerta) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  // Garante que cada alerta tenha createdAt (timestamp em ms)
  const now = Date.now();
  tx.objectStore(STORE_NAME).put({ ...alerta, notificado: false, createdAt: alerta.createdAt || now });
  tx.oncomplete = () => db.close();
}

// --- Marca todos os alertas como notificados (em lote) ---
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

// --- Limpa alertas antigos (>24h) do IndexedDB ---
async function limparAlertasAntigos() {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  const agora = Date.now();
  request.onsuccess = () => {
    request.result.forEach(alerta => {
      if (alerta.createdAt && (agora - alerta.createdAt > UM_DIA_MS)) {
        store.delete(alerta.id);
      }
    });
  };
  tx.oncomplete = () => db.close();
}

// --- Controle de aba mestre (timestamp único sessionStorage + localStorage) ---
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

// --- Bipar apenas uma vez para todos os alertas não notificados ---
async function processarAlertas() {
  if (!isMasterTab()) return;

  await limparAlertasAntigos();

  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  request.onsuccess = async () => {
    // Filtra alertas não notificados, status relevante
    const pendentes = request.result.filter(alerta =>
      !alerta.notificado && ['novo', 'erro', 'pendente'].includes(alerta.status)
    );
    if (pendentes.length > 0) {
      // --- Bipa só uma vez e notifica agrupado ---
      if (Notification.permission === 'granted') {
        new Notification('Novo Agendamento!', {
          body: `Você tem ${pendentes.length} novo(s) agendamento(s)!`,
          icon: '/icon.png',
          badge: '/badge.png'
        });
      }
      const audio = new Audio('/alert.mp3');
      audio.play().catch(() => console.log('Som bloqueado até interação do usuário'));

      // Marca todos como notificados
      await marcarTodosNotificados(pendentes.map(a => a.id));
    }
  };
  tx.oncomplete = () => db.close();
}

// --- Listener Firestore para salvar alertas localmente ---
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

function iniciarListener() {
  const q = query(
    collection(db, "alerts"),
    where("paraDonoId", "==", DONO_ID),
    where("status", "in", ["novo", "erro", "pendente"])
  );

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (['added', 'modified'].includes(change.type)) {
        const alerta = { ...change.doc.data(), id: change.doc.id };
        await salvarAlertaLocal(alerta);
        // Não bipar aqui diretamente! Deixe só o loop cuidar.
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

  // Checa a cada 2 segundos para garantir bip único para todos pendentes e limpar antigos
  setInterval(processarAlertas, 2000);

  // Limpa aba mestre se fechar
  window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem(TAB_KEY);
    localStorage.removeItem(TAB_KEY);
  });
});
