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
    // ... (função sem alterações)
  }

  async waitForServiceWorker(registration) {
    // ... (função sem alterações)
  }

  async getMessagingToken(registration) {
    // ... (função sem alterações)
  }

  setupForegroundMessageListener() {
    // ... (função sem alterações)
  }

  showForegroundNotification(payload) {
    // ... (função sem alterações)
  }

  // ✅ PROTEÇÃO CONTRA O ERRO "400 Bad Request"
  async sendTokenToServer(userId) {
    // Verificação de segurança para garantir que o userId é válido ANTES de chamar o Firestore
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error(
        `[messaging.js] ERRO CRÍTICO: Tentativa de salvar token com um ID de usuário inválido. Valor: '${userId}'. Operação cancelada.`
      );
      return false; // Cancela a operação
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
    // ... (função sem alterações)
  }
}

window.messagingService = new MessagingService();

// ✅ FUNÇÃO "INTELIGENTE" QUE BUSCA O USUÁRIO SOZINHA
window.solicitarPermissaoParaNotificacoes = function(userId) {
  if (userId) {
    window.messagingService.initialize(userId);
    return;
  }
  
  const currentUser = auth.currentUser;
  if (currentUser) {
    window.messagingService.initialize(currentUser.uid);
  } else {
    console.error("[messaging.js] Tentativa de ativar notificações sem usuário logado na sessão.");
    alert("Erro: Você precisa estar logado para ativar as notificações.");
  }
};
