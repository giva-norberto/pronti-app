// ======================================================================
// messaging.js - Serviço de notificações Firebase (COMPLETO)
// ======================================================================

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
// ✅ 1. IMPORTAÇÕES DO FIRESTORE ADICIONADAS
import { getFirestore, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Use a MESMA configuração do projeto central
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Singleton: Inicializa ou recupera instância única
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const messaging = getMessaging(app);
// ✅ 2. INSTÂNCIA DO FIRESTORE INICIALIZADA
const db = getFirestore(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso.');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  // ✅ 3. MÉTODO INITIALIZE ATUALIZADO PARA RECEBER O ID DO USUÁRIO
  async initialize(userId) {
    if (!userId) {
      console.error("[messaging.js] ERRO: O ID do usuário (userId) é necessário para inicializar as notificações.");
      return false;
    }
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

      // Pega o token e já tenta salvar no Firestore
      const token = await this.getMessagingToken(registration);
      if (token) {
        await this.sendTokenToServer(userId);
      }
      
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

  // ✅ 4. FUNÇÃO PARA GRAVAR NO FIREBASE (COMPLETA)
  async sendTokenToServer(userId) {
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio ao servidor.');
      return false;
    }

    try {
      // Cria a referência para o documento do usuário na sua coleção 'usuarios'
      const userDocRef = doc(db, 'usuarios', userId);

      // Atualiza o documento adicionando o novo token a um array chamado 'fcmTokens'.
      // O 'arrayUnion' é inteligente: ele só adiciona o token se ele já não estiver na lista.
      await updateDoc(userDocRef, {
          fcmTokens: arrayUnion(this.token)
      });

      console.log(`[messaging.js] Token salvo com sucesso para o usuário ${userId}`);
      return true;

    } catch (error) {
      console.error('[messaging.js] Erro ao salvar token no Firestore:', error);
      return false;
    }
  }

  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

// Exporta a instância para o escopo global
window.messagingService = new MessagingService();

// ✅ 5. FUNÇÃO GLOBAL ATUALIZADA PARA REQUERER O ID DO USUÁRIO
// É essa função que o seu botão "Ativar Notificações" deve chamar.
window.solicitarPermissaoParaNotificacoes = function(userId) {
  if (!userId) {
      alert("Erro: Você precisa estar logado para ativar as notificações.");
      console.error("[messaging.js] Tentativa de ativar notificações sem um userId.");
      return;
  }
  window.messagingService.initialize(userId);
};
