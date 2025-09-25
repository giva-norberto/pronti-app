// ===================================================================================
// ARQUIVO messaging.js CORRIGIDO, SEGURO E COM LOGS DETALHADOS PARA FIREBASE PUSH
// ===================================================================================

// Importa as funções necessárias da SDK moderna do Firebase
import { app } from './firebase-config.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// ===================================================================================
// CHAVE VAPID (CERTIFICADO DE PUSH DA WEB) – A MESMA DO FIREBASE
// ===================================================================================
const VAPID_KEY = "BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w";

// --- Inicialização dos Serviços do Firebase ---
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// ===================================================================================
// REGISTRO DO SERVICE WORKER (OBRIGATÓRIO PARA PUSH)
// ===================================================================================
async function registrarServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            console.log('Tentando registrar o Service Worker...');
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

// ===================================================================================
// SALVAR TOKEN FCM NO FIRESTORE
// ===================================================================================
async function salvarTokenNoFirestore(token) {
    try {
        const user = auth.currentUser;
        if (user) {
            console.log(`Usuário logado encontrado: ${user.uid}`);
            
            const userRef = doc(db, 'usuarios', user.uid);
            const tokenRef = doc(userRef, 'tokens', token);
            
            console.log('Salvando token no Firestore...');
            await setDoc(tokenRef, { timestamp: serverTimestamp() });
            
            console.log('Token salvo com sucesso!');
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

// ===================================================================================
// SOLICITAR PERMISSÃO E OBTER TOKEN FCM
// ===================================================================================
async function solicitarPermissao() {
    console.log('Iniciando solicitação de permissão de notificação...');
    
    if (!VAPID_KEY || VAPID_KEY === "SUA_CHAVE_VAPID_PUBLICA_AQUI") {
        console.error("ERRO CRÍTICO: A VAPID_KEY não está configurada corretamente");
        alert("Erro de configuração: A chave de notificação (VAPID) não foi definida ou está incorreta.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('Permissão de notificação:', permission);

        if (permission === 'granted') {
            console.log('Permissão concedida, registrando Service Worker...');
            const swRegistration = await registrarServiceWorker();

            console.log('Obtendo token FCM...');
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: swRegistration
            });

            if (token) {
                console.log('Token FCM obtido com sucesso:', token);
                await salvarTokenNoFirestore(token);
            } else {
                console.warn('Token vazio: não foi possível obter o token FCM.');
                alert('Não foi possível registrar o dispositivo para notificações. Tente novamente.');
            }
        } else {
            console.warn('Permissão de notificação não concedida pelo usuário.');
            alert('Você escolheu não receber notificações.');
        }
    } catch (error) {
        console.error('Erro ao solicitar permissão ou obter token FCM:', error);
        alert("Não foi possível ativar as notificações. Verifique o navegador ou suporte a push.");
    }
}

// ===================================================================================
// DISPONIBILIZA FUNÇÃO GLOBAL PARA CHAMADA NO HTML
// ===================================================================================
window.solicitarPermissaoParaNotificacoes = solicitarPermissao;

// ===================================================================================
// DEBUG ADICIONAL
// ===================================================================================
console.log('[DEBUG] messaging.js carregado e pronto para uso.');
