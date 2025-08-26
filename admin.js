import { SuperAdminPainel } from './SuperAdminPainel.js';
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

// Checagem de admin (ajuste seu UID)
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ADMIN_UID = "SEU_UID_ADMIN_AQUI";
onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) {
    window.location.href = "login.html";
    return;
  }
  root.render(
    React.createElement(SuperAdminPainel)
  );
});
