/**
 * Este arquivo inicializa o Firebase Cloud Messaging e fornece
 * uma função para solicitar permissão de notificação ao usuário.
 */

// Cole aqui a sua configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBOfsPIrVLCuZsIzOFPsdm6kdhLb1VvP8",
    authDomain: "pronti-app-37c6e.firebaseapp.com",
    projectId: "pronti-app-37c6e",
    storageBucket: "pronti-app-37c6e.appspot.com",
    messagingSenderId: "736700619274",
    appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o Firebase
// O objeto 'firebase' precisa estar disponível. Certifique-se de carregar
// os scripts do Firebase no seu HTML antes deste arquivo.
firebase.initializeApp(firebaseConfig);

// Pega a instância do serviço de Messaging
const messaging = firebase.messaging();

/**
 * Solicita ao usuário permissão para receber notificações e, se concedida,
 * exibe o token FCM no console.
 */
function solicitarPermissaoParaNotificacoes() {
    console.log('Iniciando solicitação de permissão...');

    messaging.requestPermission()
        .then(function() {
            console.log('Permissão de notificação concedida.');
            return messaging.getToken();
        })
        .then(function(token) {
            console.log('Token FCM do dispositivo:', token);
            alert('Permissão concedida! O token está no console.');
            
            // Futuramente, aqui chamaremos a função para salvar o token.
            // salvarTokenNoFirestore(token);
        })
        .catch(function(err) {
            console.error('Não foi possível obter permissão.', err);
            alert('Você não permitiu as notificações.');
        });
}
