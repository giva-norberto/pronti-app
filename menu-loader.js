import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Retorna o perfil do usuário autenticado e suas permissões (isOwner, isIntermediario)
 * 
 * - isOwner: true se for dono da empresa (empresa.donoId === uid)
 * - isIntermediario: true se papel do membro for 'intermediario'
 * 
 * @returns { perfil, isOwner, isIntermediario }
 */
export async function verificarAcesso() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado");

  // 1. Procurar empresa onde sou dono
  const empresasDono = await getDocs(
    query(collection(db, "empresas"), where("donoId", "==", user.uid))
  );
  if (!empresasDono.empty) {
    // Usuário é dono
    console.debug("Debug (verificarAcesso): Usuário identificado como DONO.");
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

  // 2. Procurar empresa onde sou funcionário/intermediário (busca por array de equipe)
  // ATENÇÃO: ajuste o nome do campo conforme seu banco (pode ser 'equipeUids' ou 'equipe')
  const empresasEquipe = await getDocs(
    query(collection(db, "empresas"), where("equipe", "array-contains", user.uid))
  );

  if (!empresasEquipe.empty) {
    // Agora identificando o papel detalhado:
    const empresaData = empresasEquipe.docs[0].data();

    // Supondo array 'equipeDetalhes' com objetos {uid, papel, ...}
    // Se não tiver 'equipeDetalhes', pode estar tudo em 'equipe' como objetos, ajuste conforme necessário!
    const equipeDetalhes = empresaData.equipeDetalhes || (empresaData.equipe && Array.isArray(empresaData.equipe) && typeof empresaData.equipe[0] === 'object' ? empresaData.equipe : []);
    const membro = equipeDetalhes.find(m => m.uid === user.uid);

    const papel = membro?.papel || 'funcionario';

    console.debug("Debug (verificarAcesso): Usuário identificado como FUNCIONÁRIO/INTERMEDIARIO.", papel);

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

  // 3. Sem vínculo válido
  console.debug("Debug (verificarAcesso): Usuário não tem vínculo com empresa.");
  throw new Error("Usuário não vinculado a nenhuma empresa.");
}
