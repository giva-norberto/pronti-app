import React, { useState, useEffect, useCallback } from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client"; // Importação corrigida
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Config Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig );
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

function AdminClientes() {
  const [user, setUser] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Observa auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const carregarEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "empresarios"));
      const lista = await Promise.all(
        snap.docs.map(async (empresaDoc) => {
          const profSnap = await getDocs(collection(db, "empresarios", empresaDoc.id, "profissionais"));
          return {
            uid: empresaDoc.id,
            ...empresaDoc.data(),
            funcionarios: profSnap.docs.map(p => ({ id: p.id, ...p.data() }))
          };
        })
      );
      setEmpresas(lista);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.uid === ADMIN_UID) {
      carregarEmpresas();
    } else if (user) {
        setLoading(false); // Para de carregar se o usuário não for admin
    }
  }, [user, carregarEmpresas]);

  async function bloquearEmpresa(uid, bloquear) {
    try {
      await updateDoc(doc(db, "empresarios", uid), { bloqueado: bloquear });
      const profSnap = await getDocs(collection(db, "empresarios", uid, "profissionais"));
      await Promise.all(profSnap.docs.map(p =>
        updateDoc(doc(db, "empresarios", uid, "profissionais", p.id), { bloqueado: bloquear })
      ));
      await carregarEmpresas();
    } catch (e) {
      console.error(e);
      alert("Erro ao bloquear/desbloquear empresa");
    }
  }

  if (!user && loading) return <div className="loading">Aguardando login...</div>;
  if (user && user.uid !== ADMIN_UID) return <div className="restricted">Acesso restrito.</div>;
  if (loading) return <div className="loading">Carregando empresas...</div>;

  return (
    <div className="container">
      <h2>Gestão de Empresas e Funcionários</h2>
      {empresas.length === 0 && <div style={{ color:"#888", fontStyle:"italic"}}>Nenhuma empresa cadastrada.</div>}
      {empresas.map(empresa => (
        <div className="empresa" key={empresa.uid}>
          <div className="empresa-header">
            <div>
              <div><strong>Empresa:</strong> {empresa.nome || empresa.email || empresa.uid}</div>
              <div><strong>Status:</strong> <span className="empresa-status" style={{color: empresa.bloqueado?"#dc2626":"#10b981"}}>{empresa.bloqueado?"Bloqueada":"Ativa"}</span></div>
            </div>
            <button className={empresa.bloqueado?"btn-unblock":"btn-block"} onClick={()=>bloquearEmpresa(empresa.uid,!empresa.bloqueado)}>
              {empresa.bloqueado?"Desbloquear Empresa":"Bloquear Empresa"}
            </button>
          </div>
          <div style={{marginTop:16}}>
            <strong>Funcionários:</strong>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th>Nome</th><th>Email</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {empresa.funcionarios.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "#aaa" }}>Nenhum funcionário</td></tr>
                ) : empresa.funcionarios.map(func => (
                  <tr key={func.id} className={func.bloqueado?"blocked":""}>
                    <td>{func.nome || "-"}</td>
                    <td>{func.email || "-"}</td>
                    <td><span style={{color: func.bloqueado ? "#dc2626" : "#10b981"}}>{func.bloqueado ? "Bloqueado" : "Ativo"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// Renderiza o componente na div#root
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<AdminClientes />);
