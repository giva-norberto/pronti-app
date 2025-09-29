// ======================================================================
// messaging.js - Revisado para se conectar com user-service.js
// ======================================================================

// REVISÃO: Importações foram organizadas e a do user-service foi adicionada.
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// REVISÃO: Importa a função principal do seu user-service para obter a sessão do usuário.
import { verificarAcesso } from './user-service.js';

// --- Configuração do Firebase (sem alteração) ---
const firebaseConfig = {
  apiKey: "AIzaSyCkJt49sM3n_hIQOyEwzgOmzzdPlsF9PW4",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.firebasestorage.app",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// --- Inicialização dos Serviços (sem alteração) ---
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const messaging = getMessaging(); // A partir do v9, getMessaging() é suficiente se o app já foi inicializado.
const VAPID_KEY = 'BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w';

console.log('[DEBUG][messaging.js] messaging.js carregado e pronto para uso.');

// ======================================================================
// REVISÃO: A lógica da classe foi transformada em funções mais simples e diretas
// para facilitar a integração com o user-service.js.
// ======================================================================

/**
 * Função interna que usa a SUA lógica original para salvar o token.
 * Nenhuma lógica foi alterada aqui, apenas o nome da coleção foi mantido.
 * @param {string} userId - ID do usuário.
 * @param {string} empresaId - ID da empresa.
 * @param {string} token - Token FCM do dispositivo.
 */
async function sendTokenToServer(userId, empresaId, token) {
  if (!token) {
    console.warn('[Messaging] Tentativa de salvar sem um token.');
    return;
  }
  try {
    const ref = doc(db, "mensagensTokens", userId);
    // Usando a sua lógica original de setDoc com merge: true
    await setDoc(ref, {
      empresaId: empresaId,
      userId: userId,
      fcmToken: token,
      updatedAt: serverTimestamp() // Usando serverTimestamp para consistência
    }, { merge: true });

    console.log('[Messaging] Token salvo no Firestore com sucesso!');
  } catch (err) {
    console.error('[Messaging] Erro ao salvar token no Firestore:', err);
  }
}

/**
 * Função principal que o botão "Ativar Notificações" vai chamar.
 * Ela orquestra todo o processo de forma segura.
 */
export async function solicitarPermissaoEAtivarNotificacoes() {
  console.log('[Messaging] Processo de ativação de notificações iniciado...');
  
  try {
    // 1. CHAMA O SEU USER-SERVICE para obter a sessão atual.
    const sessionProfile = await verificarAcesso();
    const { user, empresaId } = sessionProfile;

    if (!user || !empresaId) {
      throw new Error("Sessão inválida. Usuário ou Empresa não encontrados.");
    }
    console.log(`[Messaging] Sessão válida encontrada para: ${user.uid}`);

    // 2. Pede permissão ao usuário.
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Permissão para notificações foi negada.');
      return;
    }

    // 3. Obtém o token do dispositivo.
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) {
      alert('Não foi possível registrar o dispositivo para notificações. Tente recarregar a página.');
      return;
    }

    // 4. Chama a função para salvar o token com os dados obtidos do user-service.
    await sendTokenToServer(user.uid, empresaId, currentToken);
    alert('Notificações ativadas com sucesso neste dispositivo!');

  } catch (error) {
    console.error("[Messaging] Falha no processo de ativação:", error);
    alert(`Ocorreu um erro: ${error.message}`);
  }
}

/**
 * Inicia o listener para receber mensagens quando o site está aberto.
 * É recomendado chamar esta função assim que a página principal do seu app carrega.
 */
export function iniciarListenerDeNotificacoes() {
  onMessage(messaging, (payload) => {
    console.log('[Messaging] Mensagem recebida em primeiro plano:', payload);
    const title = payload.notification?.title || 'Nova Mensagem';
    const options = {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/icon.png'
    };
    new Notification(title, options);
  });
  console.log('[Messaging] Listener para notificações em primeiro plano está ativo.');
}

/**
 * Esta é a sua função original para salvar alertas.
 * Nenhuma alteração foi feita nela. Ela pode ser usada por outras partes do seu sistema.
 * @param {string} empresaId
 * @param {string} clienteNome
 * @param {string} servico
 * @param {string} horario
 */
export async function saveAlert(empresaId, clienteNome, servico, horario) {
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
