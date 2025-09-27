// ======================================================================
// messaging.js - Versão Definitiva, Completa e Corrigida
// ======================================================================

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
// ✅ ADIÇÃO 1: Importa as funções do Firestore e Autenticação
import { getFirestore, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";


// Sua configuração original. Não foi alterada.
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Singleton e inicialização dos serviços Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const messaging = getMessaging(app);
// ✅ ADIÇÃO 2: Inicializa o Firestore e a Autenticação
const db = getFirestore(app);
const auth = getAuth(app);

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso.');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  // ✅ CORREÇÃO 1: O método 'initialize' agora precisa do ID do usuário para funcionar
  async initialize(userId) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error("[messaging.js] ERRO FATAL: A inicialização foi chamada sem um ID de usuário válido. Operação cancelada.");
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

      // Se o token foi obtido com sucesso, chama a função para salvar
      if (token) {
        await this.sendTokenToServer(userId);
      }
      
      this.setupForegroundMessageListener();
      console.log('[DEBUG][messaging.js] Messaging inicializado com sucesso para o usuário:', userId);
      return true;

    } catch (error) {
      console.error('[messaging.js] Erro ao inicializar messaging:', error);
      return false;
    }
  }

  async waitForServiceWorker(registration) {
    // Esta função está correta, não precisa de alterações.
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
    // Esta função está correta, não precisa de alterações.
    try {
      const currentToken = await getToken(messaging, { vapidKey: this.vapidKey, serviceWorkerRegistration: registration });
      if (currentToken) {
        this.token = currentToken;
        localStorage.setItem('fcm_token', currentToken);
        console.log('[DEBUG][messaging.js] Token FCM obtido:', currentToken);
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
    // Esta função está correta, não precisa de alterações.
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem recebida em primeiro plano:', payload);
      this.showForegroundNotification(payload);
    });
  }

  showForegroundNotification(payload) {
    // Esta função está correta, não precisa de alterações.
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

  // ✅ CORREÇÃO 2: Preenche a função que estava vazia com a lógica de salvar
  async sendTokenToServer(userId) {
    // Adiciona uma verificação de segurança para evitar erros de 'Bad Request'
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.error(`[messaging.js] ERRO CRÍTICO ao salvar: ID de usuário inválido ('${userId}').`);
        return false;
    }
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para envio ao servidor.');
      return false;
    }

    try {
      console.log(`[messaging.js] Salvando token no Firestore para o usuário: ${userId}`);
      const userDocRef = doc(db, 'usuarios', userId);
      // 'arrayUnion' garante que o mesmo token não seja adicionado várias vezes
      await updateDoc(userDocRef, { fcmTokens: arrayUnion(this.token) });
      console.log(`[messaging.js] Token salvo com sucesso!`);
      return true;
    } catch (error) {
      console.error(`[messaging.js] FALHA AO SALVAR TOKEN no Firestore para o usuário ${userId}:`, error);
      return false;
    }
  }

  getCurrentToken() {
    // Esta função está correta, não precisa de alterações.
    return this.token || localStorage.getItem('fcm_token');
  }
}

window.messagingService = new MessagingService();

// ✅ CORREÇÃO 3: Torna a função global "inteligente" para encontrar o usuário sozinha
window.solicitarPermissaoParaNotificacoes = function(userId) {
  // Se o ID do usuário for passado diretamente, usa ele.
  if (userId) {
    window.messagingService.initialize(userId);
    return;
  }
  
  // Se não, tenta encontrar o usuário logado na sessão atual.
  const currentUser = auth.currentUser;
  if (currentUser) {
    // Se encontrou, usa o ID (uid) dele.
    window.messagingService.initialize(currentUser.uid);
  } else {
    // Se realmente não encontrou ninguém, avisa o usuário.
    alert("Erro: Você precisa estar logado para ativar as notificações.");
  }
};
