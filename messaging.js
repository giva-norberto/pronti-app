// ===================================================================================
// ARQUIVO messaging.js – Revisado, seguro e otimizado para Firebase Push Web (Firebase v10.x)
// ===================================================================================

import { app } from './firebase-config.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// ===================================================================================
// CONFIGURAÇÕES
// ===================================================================================
const VAPID_KEY = "BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w"; // <-- CHAVE NOVA!

const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// ===================================================================================
// LOGGING UTILITY
// ===================================================================================
function logDebug(msg, ...args) {
    console.log(`[DEBUG][messaging.js] ${msg}`, ...args);
}

// ===================================================================================
// REGISTRO DO SERVICE WORKER COM ESPERA ATIVA
// ===================================================================================
async function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker não suportado neste navegador.');
    }

    logDebug('Tentando registrar Service Worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Espera ativação do SW antes de prosseguir (garante que o SW está ativo)
    const esperarAtivacao = (sw) => new Promise(resolve => {
        if (!sw || sw.state === 'activated') return resolve();
        sw.addEventListener('statechange', e => {
            if (e.target.state === 'activated') resolve();
        });
    });

    await Promise.all([
        esperarAtivacao(registration.installing),
        esperarAtivacao(registration.waiting),
        esperarAtivacao(registration.active)
    ]);

    logDebug('Service Worker registrado e ativado:', registration);
    return registration;
}

// ===================================================================================
// SALVAR TOKEN FCM NO FIRESTORE
// ===================================================================================
async function salvarTokenNoFirestore(token) {
    try {
        const user = auth.currentUser;
        if (!user) {
            logDebug('Nenhum usuário logado para salvar o token.');
            return;
        }

        logDebug('Usuário logado:', user.uid);
        const userRef = doc(db, 'usuarios', user.uid);
        const tokenRef = doc(userRef, 'tokens', token);
        await setDoc(tokenRef, { timestamp: serverTimestamp() });
        logDebug('Token do usuário salvo com sucesso:', token);

        // Exemplo: salvar notificação para o dono da empresa (opcional)
        // Se user.empresaId existir no objeto do usuário
        if (user.empresaId) {
            const donoRef = collection(db, 'empresas', user.empresaId, 'notificacoes');
            await addDoc(donoRef, { tipo: 'reserva', usuarioId: user.uid, timestamp: serverTimestamp() });
            logDebug('Notificação de reserva salva para o dono da empresa');
        }

    } catch (error) {
        console.error('[ERROR] Falha ao salvar token/notificação:', error);
    }
}

// ===================================================================================
// SOLICITAR PERMISSÃO DE NOTIFICAÇÃO E OBTER TOKEN FCM
// ===================================================================================
async function solicitarPermissaoParaNotificacoes() {
    logDebug('Iniciando solicitação de permissão de notificação...');

    if (!VAPID_KEY) {
        console.error('[ERROR] VAPID_KEY não configurada');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        logDebug('Permissão de notificação:', permission);

        if (permission !== 'granted') {
            logDebug('Permissão negada pelo usuário.');
            return;
        }

        const swRegistration = await registrarServiceWorker();

        // Atenção: getToken (modular API)
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration
        });

        if (!token) {
            logDebug('Não foi possível obter o token FCM.');
            return;
        }

        logDebug('Token FCM obtido com sucesso:', token);
        await salvarTokenNoFirestore(token);

        // Recebimento de mensagens em foreground
        onMessage(messaging, (payload) => {
            logDebug('Mensagem recebida em foreground:', payload);
            const notificationTitle = payload.notification?.title || payload.data?.title || "Nova notificação";
            const notificationOptions = {
                body: payload.notification?.body || payload.data?.body || "",
                icon: payload.notification?.icon || payload.data?.icon || "/icon.png",
                image: payload.notification?.image || payload.data?.image || undefined
            };
            // Exibe notification se permitido
            if (Notification.permission === 'granted') {
                new Notification(notificationTitle, notificationOptions);
            }
        });

    } catch (error) {
        console.error('[ERROR] Falha ao solicitar permissão ou obter token FCM:', error);
    }
}

// ===================================================================================
// DISPONIBILIZA FUNÇÃO GLOBAL PARA TESTES NO CONSOLE
// ===================================================================================
window.solicitarPermissaoParaNotificacoes = solicitarPermissaoParaNotificacoes;
window.messaging = messaging;
window.getToken = getToken; // Para testes manuais!
window.auth = auth;
window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.serverTimestamp = serverTimestamp;
logDebug('messaging.js carregado e pronto para uso.');
