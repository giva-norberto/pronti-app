// ===================================================================================
// ARQUIVO messaging.js CORRIGIDO, SEGURO, COM LOGS DETALHADOS E ADAPTADO PARA PUSH WEB
// ===================================================================================

// Importa as funções necessárias da SDK moderna do Firebase
import { app } from './firebase-config.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

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
            console.log('[DEBUG] Tentando registrar o Service Worker...');
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('[DEBUG] Service Worker registrado com sucesso:', registration);
            return registration;
        } catch (error) {
            console.error('[DEBUG] Erro ao registrar Service Worker:', error);
            alert('Não foi possível registrar o Service Worker para notificações.');
            throw error;
        }
    } else {
        alert('Seu navegador não suporta notificações push.');
        throw new Error('Service Worker não suportado');
    }
}

// ===================================================================================
// SALVAR TOKEN FCM NO FIRESTORE (usuario e dono)
// ===================================================================================
async function salvarTokenNoFirestore(token) {
    try {
        const user = auth.currentUser;
        if (user) {
            console.log('[DEBUG] Usuário logado encontrado:', user.uid);
            
            // Caminho do usuário
            const userRef = doc(db, 'usuarios', user.uid);
            const tokenRef = doc(userRef, 'tokens', token);
            await setDoc(tokenRef, { timestamp: serverTimestamp() });
            console.log('[DEBUG] Token do usuário salvo com sucesso:', token);

            // Caminho do dono da empresa para envio de notificação sobre reserva
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
        } else {
            console.warn('[DEBUG] Nenhum usuário logado para salvar o token.');
            alert('Você precisa estar logado para ativar as notificações.');
        }
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
    
    if (!VAPID_KEY || VAPID_KEY === "SUA_CHAVE_VAPID_PUBLICA_AQUI") {
        console.error("[DEBUG] ERRO CRÍTICO: A VAPID_KEY não está configurada corretamente");
        alert("Erro de configuração: A chave de notificação (VAPID) não foi definida ou está incorreta.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('[DEBUG] Permissão de notificação:', permission);

        if (permission === 'granted') {
            console.log('[DEBUG] Permissão concedida, registrando Service Worker...');
            const swRegistration = await registrarServiceWorker();

            console.log('[DEBUG] Obtendo token FCM...');
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: swRegistration
            });

            if (token) {
                console.log('[DEBUG] Token FCM obtido com sucesso:', token);
                await salvarTokenNoFirestore(token);

                // Ativar recebimento de mensagens em foreground
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

            } else {
                console.warn('[DEBUG] Token vazio: não foi possível obter o token FCM.');
                alert('Não foi possível registrar o dispositivo para notificações. Tente novamente.');
            }
        } else {
            console.warn('[DEBUG] Permissão de notificação não concedida pelo usuário.');
            alert('Você escolheu não receber notificações.');
        }
    } catch (error) {
        console.error('[DEBUG] Erro ao solicitar permissão ou obter token FCM:', error);
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
