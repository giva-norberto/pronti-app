import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com",
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// Inicializa só UMA VEZ
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, db, auth, provider };
