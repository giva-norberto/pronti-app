// ===================================================================================
// ARQUIVO messaging.js CORRIGIDO E SEGURO PARA NOTIFICAÇÕES PUSH FIREBASE
// ===================================================================================

// Importa as funções necessárias da SDK moderna do Firebase
import { app } from './firebase-config.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// ===================================================================================
// CORREÇÃO: A Chave VAPID (Certificado de Push da Web) foi inserida abaixo.
// ===================================================================================
const VAPID_KEY = "BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w";

// --- Inicialização dos Serviços do Firebase ---
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// ===================================================================================
// REGISTRO SEGURO DO SERVICE WORKER (OBRIGATÓRIO PARA PUSH)
// ===================================================================================
async function registrarServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('Service Worker registrado com sucesso:', registration);
            return registration;
        } catch (error) {
            console.error('Erro ao registrar Service Worker:', error);
            alert('Não foi possível registrar o Service Worker para notificações.');
            throw error;
        }
    } else {
        alert('Seu navegador não suporta notificações push.');
        throw new Error('Service Worker não suportado');
    }
}

/**
 * Salva o token FCM de um dispositivo no Firestore, associado ao usuário logado.
 * @param {string} token - O token FCM gerado para o dispositivo.
 */
async function salvarTokenNoFirestore(token) {
    try {
        const user = auth.currentUser;
        if (user) {
            console.log(`Usuário logado encontrado: ${user.uid}`);
            
            // Define o caminho no Firestore: /usuarios/{userId}/tokens/{fcmToken}
            const userRef = doc(db, 'usuarios', user.uid);
            const tokenRef = doc(userRef, 'tokens', token);
            
            // Salva o token com um timestamp de quando foi adicionado
            await setDoc(tokenRef, {
                timestamp: serverTimestamp()
            });
            
            console.log('Token salvo no Firestore com sucesso!');
            alert('Notificações ativadas com sucesso!');
        } else {
            console.warn('Nenhum usuário logado para salvar o token.');
            alert('Você precisa estar logado para ativar as notificações.');
        }
    } catch (error) {
        console.error('Erro ao salvar o token no Firestore:', error);
        alert('Ocorreu um erro ao salvar suas preferências de notificação.');
    }
}

/**
 * Função principal que solicita a permissão do usuário para receber notificações.
 * Se a permissão for concedida, obtém o token FCM e o salva no Firestore.
 */
async function solicitarPermissao() {
    console.log('Iniciando solicitação de permissão de notificação...');

    // Verificação de segurança para garantir que a VAPID_KEY foi configurada
    if (!VAPID_KEY || VAPID_KEY === "COLE_SUA_CHAVE_VAPID_AQUI") {
        console.error("ERRO CRÍTICO: A VAPID_KEY não foi configurada em messaging.js");
        alert("Erro de configuração: A chave de notificação (VAPID) não foi definida pelo desenvolvedor.");
        return;
    }

    try {
        // Pede a permissão ao usuário através do pop-up do navegador
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Permissão de notificação concedida.');

            // REGISTRA O SERVICE WORKER ANTES DE PEGAR O TOKEN
            const swRegistration = await registrarServiceWorker();

            // Obtém o token do dispositivo usando a VAPID key e o service worker registration
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: swRegistration
            });

            if (token) {
                console.log('Token FCM do dispositivo:', token);
                await salvarTokenNoFirestore(token);
            } else {
                console.warn('Não foi possível obter o token. A permissão foi concedida, mas o token está vazio.');
                alert('Não foi possível registrar o dispositivo para notificações. Tente novamente.');
            }
        } else {
            console.warn('Permissão de notificação não concedida pelo usuário.');
            alert('Você escolheu não receber notificações.');
        }
    } catch (error) {
        console.error('Erro durante o processo de permissão ou obtenção do token:', error);
        alert("Não foi possível ativar as notificações. Verifique as configurações do seu navegador ou se o seu dispositivo suporta notificações push.");
    }
}

// Para que a função `solicitarPermissao` possa ser chamada pelo `onclick="..."` no HTML,
// nós a tornamos acessível globalmente através do objeto 'window'.
window.solicitarPermissaoParaNotificacoes = solicitarPermissao;
