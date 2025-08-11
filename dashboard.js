import { getAuth } from "firebase/auth";
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "firebase/firestore";

const auth = getAuth();
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Suponha que você já tem empresaId do contexto do dashboard
    // Busca agendamentos onde o user é dono da empresa OU cliente
    const empresaRef = await getDoc(doc(db, "empresarios", empresaId));
    const donoId = empresaRef.data().donoId;
    let q;
    if (user.uid === donoId) {
      q = query(collection(db, "empresarios", empresaId, "agendamentos"));
    } else {
      q = query(
        collection(db, "empresarios", empresaId, "agendamentos"),
        where("clienteUid", "==", user.uid)
      );
    }
    const snap = await getDocs(q);
    // Renderize os cards do dashboard normalmente
  } else {
    // Usuário não autenticado
    alert("Faça login para acessar o dashboard!");
  }
});
