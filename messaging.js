// ======================================================================
// messaging.js - Serviço de notificações Firebase (ESPELHO DA CENTRAL)
// ======================================================================

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
// >>> Firestore já estava importado <<<
import { getFirestore, doc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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
const db = getFirestore(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso (espelhando firebase-config.js).');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  // >>> ADIÇÃO: O método agora recebe os IDs necessários <<<
  async initialize(userId, empresaId) {
    if (!userId || !empresaId) {
        console.error("[messaging.js] ERRO: userId e empresaId são obrigatórios para inicializar.");
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

      // >>> ADIÇÃO: Se o token for obtido, chama a função para salvar no Firestore <<<
      const token = await this.getMessagingToken(registration);
      if (token) {
        await this.sendTokenToServer(userId, empresaId);
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
    // Nenhuma alteração nesta função
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
    // Nenhuma alteração nesta função
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
    // Nenhuma alteração nesta função
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem recebida em primeiro plano:', payload);
      this.showForegroundNotification(payload);
    });
  }

  showForegroundNotification(payload) {
    // Nenhuma alteração nesta função
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
    // Nenhuma alteração na lógica, apenas adicionado um log para depuração
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio');
      return false;
    }
    try {
      console.log(`[messaging.js] Preparando para salvar token para userId: ${userId}, empresaId: ${empresaId}`);
      const ref = doc(db, "mensagensTokens", userId);

      // A opção { merge: true } é a chave: ela CRIA o documento se não existir,
      // ou ATUALIZA os campos se ele já existir. Exatamente o que você pediu.
      await setDoc(ref, {
        empresaId: empresaId,
        userId: userId,
        fcmToken: this.token,
        updatedAt: new Date()
      }, { merge: true });

      console.log('[messaging.js] Token salvo no Firestore com sucesso!');
      return true;
    } catch (err) {
      console.error('[messaging.js] Erro ao salvar token no Firestore:', err);
      return false;
    }
  }

  async saveAlert(empresaId, clienteNome, servico, horario) {
    // Nenhuma alteração nesta função. addDoc sempre cria um novo documento.
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
    // Nenhuma alteração nesta função
    return this.token || localStorage.getItem('fcm_token');
  }
}

// Exporta a instância para o escopo global (para uso no HTML)
window.messagingService = new MessagingService();

// >>> ADIÇÃO: A função global agora passa os IDs para o método initialize <<<
window.solicitarPermissaoParaNotificacoes = function(userId, empresaId) {
  if (!userId || !empresaId) {
      alert("Erro: ID do usuário e ID da empresa são necessários para ativar as notificações.");
      return;
  }
  window.messagingService.initialize(userId, empresaId);
};
