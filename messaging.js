// ======================================================================
// messaging.js - Serviço de notificações Firebase
// REVISADO PARA USAR CONFIGURAÇÃO CENTRALIZADA
// ======================================================================

// --- PASSO 1: Importar instâncias centrais ---
// Em vez de inicializar o Firebase aqui, importamos 'app' e 'db'
// do seu arquivo de configuração principal.
// Certifique-se de que o caminho './firebase-config.js' está correto.
import { app, db } from './firebase-config.js';

// --- PASSO 2: Importar apenas as funções necessárias dos módulos ---
// Importamos as funções que vamos usar dos SDKs do Firebase.
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { doc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Importa a função principal do seu 'maestro' para obter dados do usuário.
import { verificarAcesso } from './userService.js';

// --- PASSO 3: Inicializar o serviço de Messaging ---
// Usamos a instância 'app' importada para inicializar o Messaging.
// Isso garante que ele opere na mesma sessão Firebase do resto do seu aplicativo.
const messaging = getMessaging(app );

// Mensagem de log para confirmar que o arquivo foi carregado corretamente.
console.log('[DEBUG][messaging.js] Módulo carregado, usando instância central do Firebase.');

// A classe encapsula toda a lógica de notificações.
class MessagingService {
  constructor() {
    // Armazena o token FCM do dispositivo.
    this.token = null;
    // Verifica se o navegador suporta as tecnologias necessárias (Service Worker, Notificações).
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    // Sua VAPID key pública para autenticar as solicitações de push.
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
  }

  // Método principal para iniciar o serviço de notificações.
  async initialize() {
    if (!this.isSupported) {
      console.warn('[messaging.js] Notificações não são suportadas neste navegador.');
      return false;
    }

    try {
      // Solicita permissão ao usuário para enviar notificações.
      const permission = await Notification.requestPermission();
      console.log('[DEBUG][messaging.js] Permissão de notificação:', permission);
      if (permission !== 'granted') {
        console.warn('[messaging.js] Permissão de notificação foi negada pelo usuário.');
        return false;
      }

      // Registra o Service Worker do Firebase, que é essencial para receber notificações em segundo plano.
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log('[DEBUG][messaging.js] Service Worker registrado com sucesso:', registration);
      
      // Espera o Service Worker ficar ativo para evitar condições de corrida.
      await this.waitForServiceWorker(registration);

      // Obtém o token FCM e configura o listener para mensagens em primeiro plano.
      await this.getMessagingToken(registration);
      this.setupForegroundMessageListener();

      console.log('[DEBUG][messaging.js] Serviço de Messaging inicializado com sucesso!');
      return true;

    } catch (error) {
      console.error('[messaging.js] Erro crítico ao inicializar o serviço de Messaging:', error);
      return false;
    }
  }

  // Função auxiliar para garantir que o Service Worker esteja ativo antes de prosseguir.
  async waitForServiceWorker(registration) {
    return new Promise((resolve) => {
      if (registration.active) return resolve();
      const worker = registration.installing || registration.waiting;
      if (worker) {
        const timeout = setTimeout(() => resolve(), 5000); // Timeout de 5s como segurança.
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
        localStorage.setItem('fcm_token', currentToken); // Salva no localStorage como backup.
        console.log('[DEBUG][messaging.js] Token FCM obtido:', currentToken);
        return currentToken;
      } else {
        console.warn('[DEBUG][messaging.js] Não foi possível obter o token FCM. O usuário pode ter negado a permissão ou há um problema de configuração.');
        return null;
      }
    } catch (error) {
      console.error('[messaging.js] Erro ao obter o token FCM:', error);
      return null;
    }
  }

  // Configura um listener para exibir notificações quando o app está aberto (em primeiro plano).
  setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem recebida em primeiro plano:', payload);
      this.showForegroundNotification(payload);
    });
  }

  // Cria e exibe a notificação na tela.
  showForegroundNotification(payload) {
    const title = payload.notification?.title || payload.data?.title || 'Nova Notificação';
    const body = payload.notification?.body || payload.data?.body || 'Você recebeu uma nova mensagem.';
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: payload.notification?.icon || '/icon.png',
        badge: '/badge.png',
        tag: 'prontiapp-notification' // Uma tag para agrupar ou substituir notificações.
      });
      // Define o que acontece quando o usuário clica na notificação.
      notification.onclick = () => {
        window.focus(); // Traz a janela do app para o foco.
        notification.close();
        // Opcional: redirecionar para uma página específica.
        // window.location.href = '/agendamentos';
      };
    }
  }

  // Envia o token FCM para o Firestore para que você possa enviar notificações para este dispositivo a partir do seu backend.
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
      // Usa a instância 'db' importada para criar a referência do documento.
      const ref = doc(db, "mensagensTokens", userId);

      // Salva ou atualiza o documento com os novos dados.
      await setDoc(ref, {
        empresaId: empresaId,
        userId: userId,
        fcmToken: this.token,
        updatedAt: new Date(),
        ativo: true,
        tipo: "web",
        navegador: navigator.userAgent || "Não identificado",
      }, { merge: true }); // 'merge: true' evita sobrescrever outros campos se o documento já existir.

      console.log('[messaging.js] Token salvo/atualizado no Firestore com sucesso!');
      return true;
    } catch (err) {
      // Se o erro persistir aqui, é provável que seja um problema de rede/firewall,
      // já que as regras e a inicialização estão corretas.
      console.error('[messaging.js] ERRO CRÍTICO ao salvar token no Firestore:', err);
      return false;
    }
  }

  // Função para salvar alertas (não relacionada ao token, mas usa o mesmo 'db').
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

// --- PASSO 4: Expor a funcionalidade para o restante do aplicativo ---
// Cria uma instância única da classe e a anexa ao objeto 'window' para ser facilmente acessível.
window.messagingService = new MessagingService();

// Função global que orquestra todo o processo de pedir permissão e salvar o token.
window.solicitarPermissaoParaNotificacoes = async function() {
  const ok = await window.messagingService.initialize();
  if (ok) {
    try {
      // Usa sua função 'verificarAcesso' para obter os dados necessários.
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
