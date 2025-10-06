// ======================================================================
// messaging.js - Serviço de notificações Firebase
// ✅ REVISADO E CORRIGIDO PARA iOS/Android/Desktop
// ======================================================================

import { app, db } from './firebase-config.js';
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { doc, setDoc, collection, addDoc, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { verificarAcesso } from './userService.js';

// --- INÍCIO DA MELHORIA DE ÁUDIO ---
let audioUnlocked = false;

/**
 * Desbloqueia o contexto de áudio do navegador.
 * A palavra-chave 'export' torna esta função importável em outros arquivos.
 */
export function unlockAudio() {
  if (audioUnlocked) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);

    audioUnlocked = true;
    console.log('[Audio] Contexto de áudio desbloqueado por interação do usuário.');
  } catch (error) {
    console.error('[Audio] Falha ao tentar desbloquear o contexto de áudio:', error);
  }
}
// --- FIM DA MELHORIA DE ÁUDIO ---

const messaging = getMessaging(app);
console.log('[DEBUG][messaging.js] Módulo carregado, usando instância central do Firebase.');

class MessagingService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
    this.vapidKey = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';
    // Base64 para bip curto compatível com iOS
    this.bipBase64 = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YagAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg==";
  }

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
      this.setupForegroundMessageListener();
      console.log('[DEBUG][messaging.js] Serviço de Messaging inicializado com sucesso!');
      return true;
    } catch (error) {
      console.error('[messaging.js] Erro crítico ao inicializar o serviço de Messaging:', error);
      return false;
    }
  }

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

  setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
      console.log('[messaging.js] Mensagem PUSH recebida em primeiro plano:', payload);
      this.showForegroundNotification(payload);
    });
  }

  showForegroundNotification(payload) {
    const title = payload.notification?.title || payload.data?.title || 'Nova Notificação';
    const body = payload.notification?.body || payload.data?.body || 'Você recebeu uma nova mensagem.';
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: payload.notification?.icon || payload.data?.icon || '/icon.png',
        badge: '/badge.png',
        tag: 'prontiapp-notification'
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      try {
        // --- BIP usando Audio Base64 compatível com iOS ---
        if (audioUnlocked) {
          const audio = new Audio(this.bipBase64);
          audio.volume = 1.0;
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error('[Audio] Falha ao tocar o bip da notificação:', error);
            });
          }
        }
      } catch (err) {
        console.error('[Audio] Falha ao tocar bip da notificação:', err);
      }
    }
  }

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

  getCurrentToken() {
    return this.token || localStorage.getItem('fcm_token');
  }
}

window.messagingService = new MessagingService();

window.solicitarPermissaoParaNotificacoes = async function() {
  unlockAudio();

  const ok = await window.messagingService.initialize();
  if (ok) {
    try {
      if (window.mostrarMensagemNotificacao) {
        window.mostrarMensagemNotificacao('Ótimo! As notificações estão ativas.', 'success');
        document.querySelector('.notification-button').style.display = 'none';
      }
      const sessionProfile = await verificarAcesso();
      if (!sessionProfile || !sessionProfile.user || !sessionProfile.empresaId) {
          console.error('[messaging.js] Perfil de sessão inválido. Não foi possível salvar o token.');
          return;
      }
      const userId = sessionProfile.user.uid;
      const empresaId = sessionProfile.empresaId;
      
      await window.messagingService.sendTokenToServer(userId, empresaId);

      iniciarOuvinteDeNotificacoes(userId);

    } catch (e) {
      console.error('[messaging.js] Erro ao configurar notificações após permissão:', e);
    }
  } else {
    if (window.mostrarMensagemNotificacao) {
        window.mostrarMensagemNotificacao('Você precisa permitir as notificações no seu navegador.', 'error');
    }
  }
};

let unsubscribeDeFila = null;

export function iniciarOuvinteDeNotificacoes(donoId) {
    if (unsubscribeDeFila) {
        unsubscribeDeFila();
    }
    if (!donoId) {
        console.warn('[Ouvinte] donoId não fornecido. O ouvinte não será iniciado.');
        return;
    }
    const q = query(
        collection(db, "filaDeNotificacoes"),
        where("donoId", "==", donoId),
        where("status", "==", "pendente")
    );
    unsubscribeDeFila = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const bilhete = change.doc.data();
                const bilheteId = change.doc.id;
                console.log("✅ [Ouvinte] Novo bilhete de notificação recebido:", bilhete);
                if (window.messagingService) {
                    const payload = {
                        data: {
                            title: bilhete.titulo,
                            body: bilhete.mensagem
                        }
                    };
                    window.messagingService.showForegroundNotification(payload);
                    console.log("✅ [Ouvinte] Notificação exibida com som.");
                } else {
                    console.error("❌ [Ouvinte] 'window.messagingService' não está definido.");
                }

                const docRef = doc(db, "filaDeNotificacoes", bilheteId);
                updateDoc(docRef, { status: "processado" })
                    .then(() => console.log(`✅ Bilhete ${bilheteId} atualizado para 'processado'.`))
                    .catch(err => console.error(`[Ouvinte] Erro ao atualizar bilhete ${bilheteId}:`, err));
            }
        });
    }, (error) => {
        console.error("❌ Erro no listener da fila de notificações:", error);
    });
    console.log(`✅ Ouvinte de notificações iniciado para o dono: ${donoId}`);
}

export function pararOuvinteDeNotificacoes() {
    if (unsubscribeDeFila) {
        unsubscribeDeFila();
        unsubscribeDeFila = null;
        console.log("🛑 Ouvinte de notificações parado.");
    }
}
