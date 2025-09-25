// ======================================================================
//           ARQUIVO firebase-messaging-sw.js (VERSÃO CORRIGIDA)
// ======================================================================

// Explicação: Service Workers não usam 'import'. Eles usam 'importScripts'
// para carregar as bibliotecas necessárias. Usamos as versões "compat"
// que são feitas para funcionar neste ambiente.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Suas credenciais do Firebase (as mesmas do seu app)
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa o app do Firebase para que o serviço de mensagens funcione
firebase.initializeApp(firebaseConfig);

// Obtém a instância do serviço de Mensagens
const messaging = firebase.messaging();

// Daqui para frente, o Firebase gerencia as mensagens recebidas em segundo plano.
// Você pode adicionar mais lógica aqui no futuro se precisar personalizar notificações.
