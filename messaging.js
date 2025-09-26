// ===================================================================================
// ARQUIVO messaging.js  – Revisado com espera de ativação do Service Worker
// ===================================================================================

import { app } from './firebase-config.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

const VAPID_KEY = "BAdbSkQO73zQ0hz3lOeyXjSSGO78NhJaLYYjKtzmfMxmnEL8u_7tvYkrQUYotGD5_qv0S5Bfkn3YI6E9ccGMB4w";

const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// ===================================================================================
// REGISTRO DO SERVICE WORKER – Aguarda ficar “activated”
// ===================================================================================
async function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        alert('Seu navegador não suporta notificações push.');
        throw new Error('Service Worker não suportado');
    }

    console.log('[DEBUG] Tentando registrar o Service Worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Aguarda o estado "activated"
    const esperarAtivacao = (sw) => new Promise(resolve => {
        if (!sw) return resolve();
        if (sw.state === 'activated') return resolve();
        sw.addEventListener('statechange', e => {
            if (e.target.state === 'activated') resolve();
        });
    });
    await Promise.all([
        esperarAtivacao(registration.installing),
        esperarAtivacao(registration.waiting),
        esperarAtivacao(registration.active)
    ]);

    console.log('[DEBUG] Service Worker registrado e ativado:', registration);
    return registration;
}

// ===================================================================================
// SALVAR TOKEN NO FIRESTORE
// ===================================================================================
async function salvarTokenNoFirestore(token) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('[DEBUG] Nenhum usuário logado para salvar o token.');
            alert('Você precisa estar logado para ativar as notificações.');
            return;
        }

        console.log('[DEBUG] Usuário logado encontrado:', user.uid);
        const userRef = doc(db, 'usuarios', user.uid);
        const tokenRef = doc(userRef, 'tokens', token);
        await setDoc(tokenRef, { timestamp: serverTimestamp() });
        console.log('[DEBUG] Token do usuário salvo com sucesso:', token);

        // Opcional: notificação de reserva para o dono da empresa
        if (user.empresaId) {
            const donoRef = collection(db, 'empresas', user.empresaId, 'notificacoes');
            await addDoc(donoRef, { 
                tipo: 'reserva', 
                usuarioId: user.uid, 
                timestamp: serverTimestamp() 
            });
            console.log('[DEBUG] Notificação de reserva salva para o dono da empresa');
        }

        alert('Notificações ativadas com sucesso!');
    } catch (error) {
        console.error('[DEBUG] Erro ao salvar o token ou notificação no Firestore:', error);
        alert('Ocorreu um erro ao salvar suas preferências de notificação.');
    }
}

// ===================================================================================
// SOLICITAR PERMISSÃO E OBTER TOKEN FCM
// ===================================================================================
async function solicitarPermissao() {
    console.log('[DEBUG] Iniciando solicitação de permissão de notificação...');
    
    if (!VAPID_KEY) {
        console.error("[DEBUG] ERRO: VAPID_KEY não configurada");
        alert("Erro de configuração: VAPID_KEY ausente.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('[DEBUG] Permissão de notificação:', permission);

        if (permission !== 'granted') {
            console.warn('[DEBUG] Permissão negada pelo usuário.');
            alert('Você escolheu não receber notificações.');
            return;
        }

        console.log('[DEBUG] Permissão concedida, registrando Service Worker...');
        const swRegistration = await registrarServiceWorker();

        console.log('[DEBUG] Obtendo token FCM...');
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration
        });

        if (!token) {
            console.warn('[DEBUG] Token vazio: não foi possível obter o token FCM.');
            alert('Não foi possível registrar o dispositivo para notificações. Tente novamente.');
            return;
        }

        console.log('[DEBUG] Token FCM obtido com sucesso:', token);
        await salvarTokenNoFirestore(token);

        // Recebe mensagens em foreground
        onMessage(messaging, (payload) => {
            console.log('[DEBUG] Mensagem recebida em foreground:', payload);
            const notificationTitle = payload.data?.title || "Nova notificação";
            const notificationOptions = {
                body: payload.data?.body || "",
                icon: payload.data?.icon || "/icon.png",
                image: payload.data?.image || undefined
            };
            new Notification(notificationTitle, notificationOptions);
        });

    } catch (error) {
        console.error('[DEBUG] Erro ao solicitar permissão ou obter token FCM:', error);
        alert("Não foi possível ativar as notificações. Verifique o navegador ou suporte a push.");
    }
}

// ===================================================================================
window.solicitarPermissaoParaNotificacoes = solicitarPermissao;
console.log('[DEBUG] messaging.js carregado e pronto para uso.');
