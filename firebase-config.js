// ======================================================================
// ARQUIVO: firebase-config.js (VERSÃO ÚNICA E CENTRAL)
// DESCRIÇÃO: Este arquivo inicializa e exporta todas as instâncias
//            do Firebase necessárias para o aplicativo.
// ======================================================================

// --- 1. IMPORTAÇÕES DOS MÓDULOS DO FIREBASE ---
// Funções para inicializar e obter a instância do app Firebase.
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
// Função para acessar o Firestore (banco de dados NoSQL).
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
// Funções para o serviço de Autenticação (login, logout, etc.).
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// Função para acessar o Cloud Storage (armazenamento de arquivos).
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// --- 2. CONFIGURAÇÃO DO PROJETO FIREBASE ---
// Estas são as suas "chaves" públicas para conectar ao seu projeto no Firebase.
// É seguro mantê-las no código do front-end.
const firebaseConfig = {
  apiKey: "AIzaSyA1CL5SbSWXe9843dgiopnmahCsrsF--us", // Chave de API para identificar o projeto
  authDomain: "pronti-app-37c6e.firebaseapp.com",     // Domínio para autenticação
  projectId: "pronti-app-37c6e",                      // ID do projeto
  storageBucket: "pronti-app-37c6e.appspot.com",      // Local de armazenamento (formato correto para a config)
  messagingSenderId: "736700619274",                  // ID para o serviço de mensagens
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"   // ID do aplicativo web
};

// --- 3. INICIALIZAÇÃO SEGURA DO APP (PADRÃO SINGLETON) ---
// Esta função garante que o Firebase seja inicializado apenas UMA VEZ.
// Se tentarmos inicializar várias vezes, pode causar erros.
const getFirebaseApp = () => {
  // Verifica se já existe algum app inicializado.
  if (getApps().length === 0) {
    // Se não houver, inicializa um novo.
    return initializeApp(firebaseConfig);
  } else {
    // Se já houver, apenas retorna a instância existente.
    return getApp();
  }
};

// --- 4. CRIAÇÃO E EXPORTAÇÃO DAS INSTÂNCIAS DOS SERVIÇOS ---
// Obtém a instância única do app Firebase.
const app = getFirebaseApp();

// Obtém a instância do serviço de Autenticação.
const auth = getAuth(app);

// Obtém a instância do serviço de Armazenamento de Arquivos (Storage).
const storage = getStorage(app);

// Obtém a instância do provedor de login com Google.
const provider = new GoogleAuthProvider();

// **PONTO DE ATENÇÃO #1 (Opcional, mas boa prática):**
// Força o pop-up de seleção de conta do Google toda vez que o login for acionado.
// Isso evita que o Google entre automaticamente com a última conta logada.
provider.setCustomParameters({
  prompt: 'select_account'
});

// **PONTO DE ATENÇÃO #2 (CRÍTICO - CORREÇÃO PRINCIPAL):**
// Conecta ao banco de dados Firestore. A forma mais comum e recomendada
// é usar o banco de dados "(default)", que é o que a linha abaixo faz.
// Usar `getFirestore(app, "pronti-app")` conecta a um banco de dados NOMEADO,
// o que exige configuração extra e pode ser a fonte de erros se não for intencional.
const db = getFirestore(app);

// **PONTO DE ATENÇÃO #3 (Opcional, mas boa prática):**
// Define como o login do usuário será salvo.
// `browserLocalPersistence` faz com que o usuário continue logado
// mesmo que feche a aba ou o navegador.
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    // Se houver algum erro ao definir a persistência, ele será mostrado no console.
    console.error("Erro ao definir a persistência do login:", error);
  });

// --- 5. EXPORTAÇÕES FINAIS ---
// Exporta todas as instâncias para que possam ser importadas e usadas
// em qualquer outro arquivo do seu projeto (ex: menu-lateral.js, login.js, etc.).
export { app, db, auth, storage, provider };
