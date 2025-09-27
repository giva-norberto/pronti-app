// ======================================================================
// messaging.js - Serviço de notificações Firebase (ESPELHO DO CENTRAL)
// ======================================================================

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Configuração IGUAL ao firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // <-- CORRETO!
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Singleton do app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const messaging = getMessaging(app);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso (configuração igual ao central).');

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

        // === GRAVAÇÃO AUTOMÁTICA NO FIRESTORE ===
        const user = auth.currentUser;
        if (user && user.uid) {
          await setDoc(doc(db, "users", user.uid), { fcmToken: currentToken }, { merge: true });
          console.log(`[DEBUG][messaging.js] Token FCM salvo no Firestore para user ${user.uid}`);
        } else {
          console.warn('[messaging.js] Usuário não autenticado, não foi possível salvar o token no Firestore.');
        }
        // ========================================

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

  async sendTokenToServer(userId, empresaId) {
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio');
      return false;
    }
    // Seu código para enviar ao backend...
    return true;
  }

  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

// Exporta a instância para o escopo global (para uso no HTML)
window.messagingService = new MessagingService();
window.solicitarPermissaoParaNotificacoes = function() {
  window.messagingService.initialize();
};
