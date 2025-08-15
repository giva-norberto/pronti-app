import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Garante que o usuário tenha o campo trialStart salvo no Firestore.
 * Cria o documento se não existir.
 */
export async function ensureTrialStart() {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "usuarios", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Primeiro acesso: cria documento já com trialStart
    await setDoc(userRef, {
      nome: user.displayName,
      email: user.email,
      trialStart: new Date().toISOString(),
      isPremium: false
    });
  } else if (!userSnap.data().trialStart) {
    // Documento existe mas não tem trialStart: adiciona o campo
    await updateDoc(userRef, {
      trialStart: new Date().toISOString()
    });
  }
}
