// ======================================================================
// messaging.js - Serviço de notificações Firebase (CDN version)
// ======================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso.');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  // Solicita permissão e registra o service worker
  async initialize() {
    if (!this.isSupported) {
      console.warn('[messaging.js] Notificações não suportadas neste navegador');
      return false;
    }

    try {
      console.log('[DEBUG][messaging.js] Iniciando solicitação de permissão de notificação...');
      
      // Solicita permissão
      const permission = await Notification.requestPermission();
      console.log('[DEBUG][messaging.js] Permissão de notificação:', permission);
      
      if (permission !== 'granted') {
        console.warn('[messaging.js] Permissão de notificação negada');
        return false;
      }

      // Registra o service worker
      console.log('[DEBUG][messaging.js] Tentando registrar Service Worker...');
      
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      console.log('[DEBUG][messaging.js] Service Worker registrado com sucesso:', registration);

      // Aguarda o service worker estar ativo
      await this.waitForServiceWorker(registration);

      // Obtém o token FCM
      await this.getMessagingToken(registration);

      // Configura listener para mensagens em primeiro plano
      this.setupForegroundMessageListener();

      console.log('[DEBUG][messaging.js] Messaging inicializado com sucesso!');
      return true;

    } catch (error) {
      console.error('[messaging.js] Erro ao inicializar messaging:', error);
      return false;
    }
  }

  // Aguarda o service worker estar ativo
  async waitForServiceWorker(registration) {
    return new Promise((resolve) => {
      console.log('[DEBUG][messaging.js] Aguardando Service Worker ativo...');
      
      if (registration.active) {
        console.log('[DEBUG][messaging.js] Service Worker já está ativo');
        resolve();
        return;
      }

      const worker = registration.installing || registration.waiting;
      if (worker) {
        console.log('[DEBUG][messaging.js] Aguardando worker state change...');
        
        // Timeout para evitar travamento
        const timeout = setTimeout(() => {
          console.log('[DEBUG][messaging.js] Timeout - SW não ativou, mas continuando mesmo assim');
          resolve();
        }, 10000); // timeout aumentado para 10s
        
        worker.addEventListener('statechange', () => {
          console.log('[DEBUG][messaging.js] Worker state:', worker.state);
          if (worker.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          }
        });
      } else {
        console.log('[DEBUG][messaging.js] Nenhum worker encontrado - continuando');
        resolve();
      }
    });
  }

  // Obtém o token FCM
  async getMessagingToken(registration) {
    try {
      console.log('[DEBUG][messaging.js] Tentando obter token FCM...');
      // Garantia: Passa explicitamente o registration para o getToken
      const currentToken = await getToken(messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        console.log('[DEBUG][messaging.js] Token FCM obtido:', currentToken);
        this.token = currentToken;
        
        // Salva o token no localStorage para uso posterior
        localStorage.setItem('fcm_token', currentToken);
        
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

  // Configura listener para mensagens em primeiro plano
  setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem recebida em primeiro plano:', payload);
      
      // Mostra notificação personalizada quando o app está em primeiro plano
      this.showForegroundNotification(payload);
    });
  }

  // Mostra notificação quando o app está em primeiro plano
  showForegroundNotification(payload) {
    const title = payload.notification?.title || payload.data?.title || 'Novo Agendamento';
    const body = payload.notification?.body || payload.data?.body || 'Você tem um novo agendamento!';
    
    // Cria uma notificação personalizada
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
        // Redireciona para a página de agendamentos
        window.location.href = '/agendamentos';
      };
    }
  }

  // Envia token para o servidor (para ser chamado após login)
  async sendTokenToServer(userId, empresaId) {
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio');
      return false;
    }

    try {
      // Aqui você enviaria o token para seu backend/Firestore
      console.log('[DEBUG][messaging.js] Enviando token para servidor:', {
        userId,
        empresaId,
        token: this.token
      });

      // Exemplo de como salvar no Firestore (adapte conforme sua estrutura)
      // await updateDoc(doc(db, 'users', userId), {
      //   fcmToken: this.token,
      //   tokenUpdatedAt: new Date()
      // });

      return true;
    } catch (error) {
      console.error('[messaging.js] Erro ao enviar token para servidor:', error);
      return false;
    }
  }

  // Obtém o token atual
  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

// Exporta a instância para o escopo global (necessário para onclick no HTML)
window.messagingService = new MessagingService();

// Função global para botão permitir notificações
window.solicitarPermissaoParaNotificacoes = function() {
  window.messagingService.initialize();
};
