import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Retorna o perfil do usuário autenticado e suas permissões (isOwner, isIntermediario)
 */
export async function verificarAcesso() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado");

  // 1. DONO
  const empresasDono = await getDocs(
    query(collection(db, "empresarios"), where("donoId", "==", user.uid))
  );
  if (!empresasDono.empty) {
    return {
      perfil: {
        nome: user.displayName || "Usuário",
        email: user.email,
        uid: user.uid,
        fotoUrl: user.photoURL || "",
        status: "ativo"
      },
      isOwner: true,
      isIntermediario: false
    };
  }

  // 2. FUNCIONÁRIO/INTERMEDIARIO (testa existencia do campo equipe)
  const empresasEquipe = await getDocs(
    query(collection(db, "empresarios"), where("equipe", "array-contains", user.uid))
  );

  if (!empresasEquipe.empty) {
    // Identifica papel
    const empresaData = empresasEquipe.docs[0].data();
    // Se seu campo equipe for só array de UIDs, não terá papel/intermediário
    let papel = 'funcionario';
    if (Array.isArray(empresaData.equipeDetalhes)) {
      const membro = empresaData.equipeDetalhes.find(m => m.uid === user.uid);
      if (membro && membro.papel) papel = membro.papel;
    }
    return {
      perfil: {
        nome: user.displayName || "Usuário",
        email: user.email,
        uid: user.uid,
        fotoUrl: user.photoURL || "",
        status: "ativo"
      },
      isOwner: false,
      isIntermediario: papel === 'intermediario'
    };
  }

  // 3. Sem vínculo
  throw new Error("Usuário não vinculado a nenhuma empresa.");
}
