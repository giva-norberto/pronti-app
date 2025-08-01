// vitrini-firebase.js

// 1. Importa todas as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    addDoc,
    Timestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCnGK3j90_UpBdRpu5nhSs-nY84I_e0cAk",
    authDomain: "pronti-app-37c6e.firebaseapp.com",
    projectId: "pronti-app-37c6e",
    storageBucket: "pronti-app-37c6e.appspot.com",
    messagingSenderId: "736700619274",
    appId: "1:736700619274:web:557aa247905e5df3"
};

// Inicialização dos serviços
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 2. Exporta as instâncias E re-exporta as funções importadas
export {
    app,
    db,
    auth,
    provider,
    // Funções de Autenticação
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    // Funções do Firestore
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    addDoc,
    Timestamp,
    updateDoc
};
