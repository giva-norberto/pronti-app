import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Retorna uma Promise que resolve com o papel do usuário autenticado:
 * { perfil, role: 'dono' | 'funcionario' | 'intermediario', empresaId }
 */
export async function verificarAcesso() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        reject(new Error("Usuário não autenticado"));
        return;
      }

      // 1. DONO
      const empresasDono = await getDocs(
        query(collection(db, "empresarios"), where("donoId", "==", user.uid))
      );
      if (!empresasDono.empty) {
        resolve({
          perfil: {
            nome: user.displayName || "Usuário",
            email: user.email,
            uid: user.uid,
            fotoUrl: user.photoURL || "",
            status: "ativo"
          },
          role: "dono",
          empresaId: empresasDono.docs[0].id
        });
        return;
      }

      // 2. FUNCIONÁRIO OU INTERMEDIÁRIO (array equipe)
      const empresasEquipe = await getDocs(
        query(collection(db, "empresarios"), where("equipe", "array-contains", user.uid))
      );

      if (!empresasEquipe.empty) {
        const empresaData = empresasEquipe.docs[0].data();
        let papel = "funcionario";
        if (Array.isArray(empresaData.equipeDetalhes)) {
          const membro = empresaData.equipeDetalhes.find(m => m.uid === user.uid);
          if (membro && membro.papel === "intermediario") papel = "intermediario";
        }
        resolve({
          perfil: {
            nome: user.displayName || "Usuário",
            email: user.email,
            uid: user.uid,
            fotoUrl: user.photoURL || "",
            status: "ativo"
          },
          role: papel,
          empresaId: empresasEquipe.docs[0].id
        });
        return;
      }

      // 3. Sem vínculo
      reject(new Error("Usuário não vinculado a nenhuma empresa."));
    });
  });
}
