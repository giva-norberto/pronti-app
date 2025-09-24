// Importa as funções necessárias da SDK moderna do Firebase e da sua configuração
import { app } from './firebase-config.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// ===================================================================================
// !!! AÇÃO NECESSÁRIA: COLE SUA CHAVE VAPID (Web Push Certificate) AQUI !!!
// 1. Vá para o Console do Firebase
// 2. Clique na Engrenagem ⚙️ > Configurações do Projeto
// 3. Vá para a aba "Cloud Messaging"
// 4. Em "Configuração da Web", encontre "Certificados de push da Web" e clique em "Gerar par de chaves"
// 5. Copie a chave longa e cole abaixo.
// ===================================================================================
const VAPID_KEY = "COLE_SUA_CHAVE_VAPID_AQUI";

// Inicializa os serviços do Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Função auxiliar para salvar o token no Firestore
async function salvarTokenNoFirestore(token) {
    try {
        const user = auth.currentUser;
        if (user) {
            console.log(`Usuário logado encontrado: ${user.uid}`);
            const userRef = doc(db, 'usuarios', user.uid);
            const tokenRef = doc(userRef, 'tokens', token);
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
    }
}

// Função PRINCIPAL para solicitar a permissão do usuário
async function solicitarPermissao() {
    console.log('Iniciando solicitação de permissão...');

    if (!VAPID_KEY || VAPID_KEY === "COLE_SUA_CHAVE_VAPID_AQUI") {
        console.error("ERRO: A VAPID_KEY não foi configurada em messaging.js");
        alert("Erro de configuração: A chave de notificação (VAPID) não foi definida pelo desenvolvedor.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Permissão de notificação concedida.');
            
            // Obtém o token usando a VAPID key
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) {
                console.log('Token FCM do dispositivo:', token);
                await salvarTokenNoFirestore(token);
            } else {
                console.warn('Não foi possível obter o token. A permissão foi concedida, mas o token está vazio.');
            }
        } else {
            console.warn('Permissão de notificação não concedida.');
            alert('Você não permitiu as notificações.');
        }
    } catch (error) {
        console.error('Erro ao solicitar permissão ou obter token:', error);
        alert("Não foi possível obter permissão. Verifique as configurações do seu navegador ou se o seu dispositivo suporta notificações push.");
    }
}

// Atrelamos a função ao objeto window para que ela seja acessível pelo `onclick` no HTML
window.solicitarPermissaoParaNotificacoes = solicitarPermissao;

