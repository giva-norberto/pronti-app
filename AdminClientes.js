import React, { useState, useEffect, useCallback } from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// =================================================================================
// SUAS CREDENCIAIS DO FIREBASE (AGORA CORRETAS )
// =================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBOfsPIr0VLCuZsIzOFPsdm6kdhLb1VvP8",
  authDomain: "pronti-app-37c6e.firebaseapp.com",
  projectId: "pronti-app-37c6e",
  storageBucket: "pronti-app-37c6e.appspot.com", // Corrigi para .appspot.com, que é o padrão
  messagingSenderId: "736700619274",
  appId: "1:736700619274:web:557aa247905e56fa7e5df3"
};

// =================================================================================
// UID DO ADMINISTRADOR (VERIFIQUE SE ESTÁ CORRETO)
// =================================================================================
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// Inicializa o Firebase
let app, db, auth;
let firebaseError = null;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error("Erro Crítico na Inicialização do Firebase:", e);
  firebaseError = e.message;
}

function AdminClientes() {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("Verificando login...");
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthStatus(`Logado como: ${currentUser.email || 'Email não disponível'} (UID: ${currentUser.uid})`);
      } else {
        setUser(null);
        setAuthStatus("Nenhum usuário logado.");
      }
    });
    return () => unsubscribe();
  }, []);

  const carregarEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "empresarios"));
      if (snap.empty) {
        setError("Nenhuma empresa encontrada na coleção 'empresarios'.");
      }
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
      console.error("Erro ao carregar empresas:", e);
      setError(`Falha ao buscar dados do Firestore: ${e.message}. Verifique suas regras de segurança no Console do Firebase.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.uid === ADMIN_UID) {
      carregarEmpresas();
    } else {
      setLoading(false);
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

  if (firebaseError) {
    return <div className="container" style={{color: 'red'}}><h2>Erro Crítico</h2><p>O Firebase não pôde ser inicializado.</p><p><strong>Detalhe:</strong> {firebaseError}</p></div>;
  }

  const renderDiagnostico = () => (
    <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
      <h3 style={{marginTop: 0}}>Diagnóstico da Página</h3>
      <p><strong>Status da Conexão:</strong> {auth ? 'Firebase conectado com sucesso.' : 'Falha na conexão.'}</p>
      <p><strong>Status da Autenticação:</strong> {authStatus}</p>
      {user && user.uid !== ADMIN_UID && <p style={{ color: 'red' }}><strong>Aviso de Permissão:</strong> O usuário logado não é o administrador (UID esperado: {ADMIN_UID}).</p>}
      {error && <p style={{ color: 'red' }}><strong>Erro de Dados:</strong> {error}</p>}
    </div>
  );

  if (loading && (!user || user.uid === ADMIN_UID)) {
    return <div className="container">{renderDiagnostico()}<div className="loading">Carregando empresas...</div></div>;
  }

  if (!user || user.uid !== ADMIN_UID) {
    return <div className="container">{renderDiagnostico()}<div className="restricted">Acesso restrito. Apenas o administrador pode ver esta página.</div></div>;
  }

  return (
    <div className="container">
      {renderDiagnostico()}
      <h2>Gestão de Empresas e Funcionários</h2>
      {empresas.length === 0 && !error && <div style={{ color:"#888", fontStyle:"italic"}}>Nenhuma empresa para exibir.</div>}
      {empresas.map(emp => (
        <div className="empresa" key={emp.uid}>
          <div className="empresa-header">
            <div>
              <div><strong>Empresa:</strong> {emp.nome || emp.email || emp.uid}</div>
              <div><strong>Status:</strong> <span className="empresa-status" style={{color: emp.bloqueado?"#dc2626":"#10b981"}}>{emp.bloqueado?"Bloqueada":"Ativa"}</span></div>
            </div>
            <button className={emp.bloqueado?"btn-unblock":"btn-block"} onClick={()=>bloquearEmpresa(emp.uid,!emp.bloqueado)}>
              {emp.bloqueado?"Desbloquear Empresa":"Bloquear Empresa"}
            </button>
          </div>
          <div style={{marginTop:16}}>
            <strong>Funcionários:</strong>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}><th>Nome</th><th>Email</th><th>Status</th></tr>
              </thead>
              <tbody>
                {emp.funcionarios.length===0 ? (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "#aaa" }}>Nenhum funcionário</td></tr>
                ) : emp.funcionarios.map(f => (
                  <tr key={f.id} className={f.bloqueado?"blocked":""}>
                    <td>{f.nome||"-"}</td>
                    <td>{f.email||"-"}</td>
                    <td><span style={{color:f.bloqueado?"#dc2626":"#10b981"}}>{f.bloqueado?"Bloqueado":"Ativo"}</span></td>
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

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<AdminClientes />);
