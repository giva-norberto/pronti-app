// ======================================================================
// messaging.js - Serviço de notificações Firebase (VERSÃO FINAL)
// ======================================================================

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { getFirestore, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Sua configuração do Firebase. Não foi alterada.
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicialização dos serviços Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const messaging = getMessaging(app);
const db = getFirestore(app);
const auth = getAuth(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso.');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  async initialize(userId) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error("[messaging.js] ERRO INTERNO: A inicialização foi chamada com um ID de usuário inválido:", userId);
      return false;
    }
    if (!this.isSupported) {
      console.warn('[messaging.js] Notificações não suportadas neste navegador');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[messaging.js] Permissão de notificação negada');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await this.waitForServiceWorker(registration);
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
      if (registration.active) { resolve(); return; }
      const worker = registration.installing || registration.waiting;
      if (worker) {
        const timeout = setTimeout(() => resolve(), 10000);
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') { clearTimeout(timeout); resolve(); }
        });
      } else { resolve(); }
    });
  }

  async getMessagingToken(registration) {
    try {
      const currentToken = await getToken(messaging, { vapidKey: this.vapidKey, serviceWorkerRegistration: registration });
      if (currentToken) {
        this.token = currentToken;
        localStorage.setItem('fcm_token', currentToken);
        return currentToken;
      }
      console.warn('[DEBUG][messaging.js] Nenhum token de registro disponível');
      return null;
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
    const title = payload.notification?.title || 'Novo Agendamento';
    const body = payload.notification?.body || 'Você tem um novo agendamento!';
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, { body: body, icon: '/icon.png', badge: '/badge.png', tag: 'agendamento' });
      notification.onclick = () => {
        window.focus();
        notification.close();
        window.location.href = '/agendamentos';
      };
    }
  }

  // ✅ REVISÃO 1: Proteção contra o erro "400 Bad Request"
  async sendTokenToServer(userId) {
    // Verificação de segurança para garantir que o userId é válido ANTES de chamar o Firestore
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error(
        `[messaging.js] ERRO CRÍTICO: Tentativa de salvar token com um ID de usuário inválido. Valor: '${userId}'. Operação cancelada.`
      );
      return false;
    }

    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio ao servidor.');
      return false;
    }

    try {
      console.log(`[messaging.js] Preparando para salvar token para o usuário VÁLIDO: ${userId}`);
      const userDocRef = doc(db, 'usuarios', userId);
      await updateDoc(userDocRef, { fcmTokens: arrayUnion(this.token) });
      console.log(`[messaging.js] Token salvo com sucesso para o usuário ${userId}`);
      return true;
    } catch (error) {
      console.error(`[messaging.js] Erro ao salvar token no Firestore para o usuário ${userId}:`, error);
      return false;
    }
  }

  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

window.messagingService = new MessagingService();

// ✅ REVISÃO 2: Função de ativação "inteligente" e mais fácil de usar
// Não precisa mais se preocupar em passar o ID do usuário pelo HTML.
window.solicitarPermissaoParaNotificacoes = function(userId) {
  // Se um ID for passado, usa ele.
  if (userId) {
    window.messagingService.initialize(userId);
    return;
  }
  
  // Se não, tenta pegar o usuário logado automaticamente.
  const currentUser = auth.currentUser;
  if (currentUser) {
    window.messagingService.initialize(currentUser.uid);
  } else {
    // Só mostra o erro se REALMENTE não houver ninguém logado.
    console.error("[messaging.js] Tentativa de ativar notificações sem usuário logado na sessão.");
    alert("Erro: Você precisa estar logado para ativar as notificações.");
  }
};
