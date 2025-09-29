// ======================================================================
// messaging.js - Serviço de notificações Firebase (ESPELHO DA CENTRAL)
// ======================================================================

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Use a MESMA configuração do projeto central
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app", // igual ao seu central!
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Singleton: Inicializa ou recupera instância única
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const messaging = getMessaging(app);
const db = getFirestore(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso (espelhando firebase-config.js).');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  async initialize() {
    if (!this.isSupported) {
      console.warn('[messaging.js] Notificações não suportadas neste navegador');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[DEBUG][messaging.js] Permissão de notificação:', permission);
      if (permission !== 'granted') {
        console.warn('[messaging.js] Permissão de notificação negada');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log('[DEBUG][messaging.js] Service Worker registrado com sucesso:', registration);
      await this.waitForServiceWorker(registration);

      await this.getMessagingToken(registration);
      this.setupForegroundMessageListener();

      console.log('[DEBUG][messaging.js] Messaging inicializado com sucesso!');
      return true;

    } catch (error) {
      console.error('[messaging.js] Erro ao inicializar messaging:', error);
      return false;
    }
  }

  async waitForServiceWorker(registration) {
    return new Promise((resolve) => {
      if (registration.active) {
        resolve();
        return;
      }
      const worker = registration.installing || registration.waiting;
      if (worker) {
        const timeout = setTimeout(() => resolve(), 10000);
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async getMessagingToken(registration) {
    try {
      const currentToken = await getToken(messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        this.token = currentToken;
        localStorage.setItem('fcm_token', currentToken);
        console.log('[DEBUG][messaging.js] Token FCM obtido:', currentToken);
        return currentToken;
      } else {
        console.warn('[DEBUG][messaging.js] Nenhum token de registro disponível');
        return null;
      }
    } catch (error) {
      console.error('[messaging.js] Erro ao obter token FCM:', error);
      return null;
    }
  }

  setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem recebida em primeiro plano:', payload);
      this.showForegroundNotification(payload);
    });
  }

  showForegroundNotification(payload) {
    const title = payload.notification?.title || payload.data?.title || 'Novo Agendamento';
    const body = payload.notification?.body || payload.data?.body || 'Você tem um novo agendamento!';
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: payload.notification?.icon || '/icon.png',
        badge: '/badge.png',
        tag: 'agendamento'
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
        window.location.href = '/agendamentos';
      };
    }
  }

  // >>> CORRIGIDO: grava token diretamente no Firestore <<<
  async sendTokenToServer(userId, empresaId) {
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio');
      return false;
    }
    if (!userId || !empresaId) {
      console.error('[messaging.js] userId ou empresaId não definido!');
      return false;
    }
    try {
      const ref = doc(db, "mensagensTokens", userId);

      // Sempre faz MERGE para garantir que os campos são criados/atualizados corretamente
      await setDoc(ref, {
        empresaId: empresaId,
        userId: userId,
        fcmToken: this.token,
        updatedAt: new Date(),
        ativo: true,
        tipo: "web",
        navegador: navigator.userAgent || "",
      }, { merge: true });

      console.log('[messaging.js] Token salvo/atualizado no Firestore com sucesso!');
      return true;
    } catch (err) {
      console.error('[messaging.js] Erro ao salvar token no Firestore:', err);
      return false;
    }
  }

  async saveAlert(empresaId, clienteNome, servico, horario) {
    try {
      const alertsRef = collection(db, "alerts");
      await addDoc(alertsRef, {
        empresaId: empresaId,
        clienteNome: clienteNome,
        servico: servico,
        horario: horario,
        createdAt: new Date(),
        status: "novo"
      });
      console.log('[messaging.js] Alerta salvo no Firestore com sucesso!');
      return true;
    } catch (err) {
      console.error('[messaging.js] Erro ao salvar alerta no Firestore:', err);
      return false;
    }
  }

  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

// Exporta a instância para o escopo global (para uso no HTML)
// ATENÇÃO: É OBRIGATÓRIO CHAMAR sendTokenToServer APÓS O initialize!
window.messagingService = new MessagingService();
window.solicitarPermissaoParaNotificacoes = async function(userId, empresaId) {
  const ok = await window.messagingService.initialize();
  if (ok) {
    await window.messagingService.sendTokenToServer(userId, empresaId);
  }
};
