// ======================================================================
// messaging.js - Serviço de notificações Firebase
// REVISÃO FINAL: Lógica de 'ouvinte' da fila de notificações foi removida
// para corrigir o erro de permissão e seguir o fluxo correto do FCM.
// ======================================================================

// --- PASSO 1: Importar instâncias centrais ---
import { app, db } from './firebase-config.js';

// --- PASSO 2: Importar apenas as funções necessárias dos módulos ---
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { doc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Importa a função principal do seu userService para obter dados do usuário.
import { verificarAcesso } from './userService.js';

// --- PASSO 3: Inicializar o serviço de Messaging ---
const messaging = getMessaging(app);

// Mensagem de log para confirmar que o arquivo foi carregado corretamente.
console.log('[DEBUG][messaging.js] Módulo carregado, usando instância central do Firebase.');

// A classe encapsula a lógica de notificações do NAVEGADOR.
class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  // Método principal para iniciar o serviço de notificações.
  async initialize() {
    if (!this.isSupported) {
      console.warn('[messaging.js] Notificações não são suportadas neste navegador.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[DEBUG][messaging.js] Permissão de notificação:', permission);
      if (permission !== 'granted') {
        console.warn('[messaging.js] Permissão de notificação foi negada pelo usuário.');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log('[DEBUG][messaging.js] Service Worker registrado com sucesso:', registration);
      
      await this.waitForServiceWorker(registration);

      await this.getMessagingToken(registration);
      this.setupForegroundMessageListener(); // Configura o listener para PUSH.

      console.log('[DEBUG][messaging.js] Serviço de Messaging inicializado com sucesso!');
      return true;

    } catch (error) {
      console.error('[messaging.js] Erro crítico ao inicializar o serviço de Messaging:', error);
      return false;
    }
  }

  // Função auxiliar para garantir que o Service Worker esteja ativo.
  async waitForServiceWorker(registration) {
    return new Promise((resolve) => {
      if (registration.active) return resolve();
      const worker = registration.installing || registration.waiting;
      if (worker) {
        const timeout = setTimeout(() => resolve(), 5000);
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

  // Obtém o token de registro do dispositivo do Firebase Cloud Messaging.
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
        console.warn('[DEBUG][messaging.js] Não foi possível obter o token FCM.');
        return null;
      }
    } catch (error) {
      console.error('[messaging.js] Erro ao obter o token FCM:', error);
      return null;
    }
  }

  // ✅ CORREÇÃO: Esta função agora ouve as notificações PUSH enviadas pela sua Cloud Function.
  // Este é o comportamento correto, em vez de ouvir a fila do Firestore.
  setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem PUSH recebida em primeiro plano:', payload);
      this.showForegroundNotification(payload);
    });
  }

  // Cria e exibe a notificação na tela.
  showForegroundNotification(payload) {
    const title = payload.notification?.title || 'Nova Notificação';
    const body = payload.notification?.body || 'Você recebeu uma nova mensagem.';
    
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: payload.notification?.icon || '/icon.png',
        badge: '/badge.png',
        tag: 'prontiapp-notification'
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  // Envia o token FCM para o Firestore (lógica 100% mantida).
  async sendTokenToServer(userId, empresaId) {
    if (!this.token) {
      console.warn('[messaging.js] Token não disponível para ser salvo no servidor.');
      return false;
    }
    if (!userId || !empresaId) {
      console.error('[messaging.js] Erro: userId ou empresaId não foram fornecidos para salvar o token.');
      return false;
    }
    try {
      const ref = doc(db, "mensagensTokens", userId);
      await setDoc(ref, {
        empresaId: empresaId,
        userId: userId,
        fcmToken: this.token,
        updatedAt: new Date(),
        ativo: true,
        tipo: "web",
        navegador: navigator.userAgent || "Não identificado",
      }, { merge: true });

      console.log('[messaging.js] Token salvo/atualizado no Firestore com sucesso!');
      return true;
    } catch (err) {
      console.error('[messaging.js] ERRO CRÍTICO ao salvar token no Firestore:', err);
      return false;
    }
  }

  // Função para salvar alertas (lógica 100% mantida).
  async saveAlert(empresaId, clienteNome, servico, horario) {
    try {
      const alertsRef = collection(db, "alerts");
      await addDoc(alertsRef, {
        empresaId,
        clienteNome,
        servico,
        horario,
        createdAt: new Date(),
        status: "novo"
      });
      console.log('[messaging.js] Alerta de agendamento salvo no Firestore.');
      return true;
    } catch (err) {
      console.error('[messaging.js] Erro ao salvar alerta no Firestore:', err);
      return false;
    }
  }

  // Retorna o token FCM atual.
  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

// --- LÓGICA DE ATIVAÇÃO ---
// Instancia o serviço.
window.messagingService = new MessagingService();

// Função global que o seu botão "Ativar Notificações" chama.
window.solicitarPermissaoParaNotificacoes = async function() {
  const ok = await window.messagingService.initialize();
  if (ok) {
    try {
      const sessionProfile = await verificarAcesso();
      if (!sessionProfile || !sessionProfile.user || !sessionProfile.empresaId) {
          console.error('[messaging.js] Perfil de sessão inválido. Não foi possível salvar o token.');
          return;
      }
      const userId = sessionProfile.user.uid;
      const empresaId = sessionProfile.empresaId;
      
      console.log('[DEBUG][messaging.js] Chamando sendTokenToServer com:', { userId, empresaId });
      await window.messagingService.sendTokenToServer(userId, empresaId);
    } catch (e) {
      console.error('[messaging.js] Erro ao obter o perfil de sessão para salvar o token:', e);
    }
  }
};

// ✅ CORREÇÃO: As funções de 'ouvinte' da fila foram completamente removidas
// para evitar o erro de permissão e alinhar com a arquitetura correta do FCM.
