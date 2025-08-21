import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Garante que o usuário tenha os campos trialStart e trialEnds salvos no Firestore.
 * Cria o documento se não existir.
 * O trial dura 15 dias a partir do primeiro acesso (trialStart é o dia 1, trialEnds é o fim do último dia).
 * trialEnds sempre será às 23:59:59 do 15º dia, independente do horário em que o usuário acessou.
 */
export async function ensureTrialStart() {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "usuarios", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Primeiro acesso: cria documento já com trialStart e trialEnds
    const trialStart = new Date();
    const trialEnds = new Date(trialStart);
    trialEnds.setDate(trialEnds.getDate() + 15); // soma 15 dias
    trialEnds.setHours(23, 59, 59, 999); // fim do dia do 15º dia
    await setDoc(userRef, {
      nome: user.displayName,
      email: user.email,
      trialStart: trialStart.toISOString(),
      trialEnds: trialEnds.toISOString(),
      isPremium: false
    });
  } else {
    const data = userSnap.data();
    if (!data.trialStart || !data.trialEnds) {
      let trialStart, trialEnds;
      if (data.trialStart) {
        trialStart = new Date(data.trialStart);
        trialEnds = data.trialEnds ? new Date(data.trialEnds) : new Date(trialStart);
        if (!data.trialEnds) {
          trialEnds.setDate(trialStart.getDate() + 15);
          trialEnds.setHours(23, 59, 59, 999);
        }
      } else {
        trialStart = new Date();
        trialEnds = new Date(trialStart);
        trialEnds.setDate(trialEnds.getDate() + 15);
        trialEnds.setHours(23, 59, 59, 999);
      }
      await updateDoc(userRef, {
        trialStart: trialStart.toISOString(),
        trialEnds: trialEnds.toISOString()
      });
    }
  }
}
