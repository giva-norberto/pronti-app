// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbtpWQ7r4qlIktOOP93nQQxUyO9ReP1NA",
  authDomain: "pronti-app.firebaseapp.com",
  projectId: "pronti-app",
  storageBucket: "pronti-app.appspot.com",
  messagingSenderId: "18706493173",
  appId: "1:18706493173:web:b7798e2e6c2a18e65ef689"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
