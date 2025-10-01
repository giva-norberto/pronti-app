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

// Flag para evitar processamento simultâneo
let processandoAlertas = false;

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
  tx.objectStore(STORE_NAME).put({ 
    ...alerta, 
    notificado: false, 
    createdAt: alerta.createdAt || now 
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function marcarTodosNotificados(ids) {
  if (!ids.length) return;
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  const promises = ids.map(id => {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const alerta = req.result;
        if (alerta && !alerta.notificado) {
          alerta.notificado = true;
          store.put(alerta);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  });

  await Promise.all(promises);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function limparAlertasAntigos() {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const agora = Date.now();
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      request.result.forEach(alerta => {
        if (alerta.createdAt && (agora - alerta.createdAt > UM_DIA_MS)) {
          store.delete(alerta.id);
        }
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Marcar como lido no Firestore ---
async function marcarStatusLidoFirestore(id) {
  try {
    const ref = doc(db, "filaDeNotificacoes", id);
    await updateDoc(ref, { status: "lido" });
    console.log(`Alerta ${id} marcado como lido no Firestore`);
  } catch (e) {
    console.error("Erro ao marcar como lido no Firestore:", e);
    throw e; // Propaga o erro para retry se necessário
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
  if (!isMasterTab() || processandoAlertas) return;
  
  processandoAlertas = true;
  
  try {
    await limparAlertasAntigos();

    const db = await abrirDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const pendentes = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Filtra alertas não notificados e status válido
        const resultado = request.result.filter(
          alerta =>
            !alerta.notificado &&
            ['novo', 'erro', 'pendente'].includes(alerta.status)
        );
        resolve(resultado);
      };
      request.onerror = () => reject(request.error);
    });
    
    tx.oncomplete = () => db.close();

    if (pendentes.length > 0) {
      console.log(`Processando ${pendentes.length} alertas pendentes`);
      
      // --- Toca o som e mostra notificação PRIMEIRO ---
      try {
        const audio = new Audio('/alert.mp3');
        await audio.play();
      } catch (err) {
        console.log('Som bloqueado ou erro ao tocar:', err);
      }

      if (Notification.permission === 'granted') {
        new Notification('Novo Agendamento!', {
          body: `Você tem ${pendentes.length} novo(s) agendamento(s)!`,
          icon: '/icon.png',
          badge: '/badge.png'
        });
      } else {
        alert(`Você tem ${pendentes.length} novo(s) agendamento(s)!`);
      }

      // --- Marca como notificado DEPOIS de tocar/notificar ---
      const ids = pendentes.map(a => a.id);
      await marcarTodosNotificados(ids);
      
      // --- Atualiza Firestore em paralelo ---
      const firestorePromises = pendentes.map(alerta => 
        marcarStatusLidoFirestore(alerta.id).catch(err => {
          console.error(`Falha ao atualizar ${alerta.id}:`, err);
          // Não bloqueia os outros
        })
      );
      
      await Promise.allSettled(firestorePromises);
      console.log('Alertas processados com sucesso');
    }
  } catch (error) {
    console.error('Erro ao processar alertas:', error);
  } finally {
    processandoAlertas = false;
  }
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
        console.log('Novo alerta recebido:', alerta.id);
        await salvarAlertaLocal(alerta);
        // Processa imediatamente quando recebe novo alerta
        processarAlertas();
      }
    });
  });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Iniciando sistema de alertas...');
  
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
  
  iniciarListener();
  processarAlertas();

  // Checa a cada 5 segundos (reduzido de 2s para evitar sobrecarga)
  setInterval(processarAlertas, 5000);

  // Limpa aba mestre se fechar
  window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem(TAB_KEY);
    localStorage.removeItem(TAB_KEY);
  });
});
