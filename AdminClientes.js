import React, { useState, useEffect, useCallback } from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// =================================================================================
// 1. CONFIGURE SEU FIREBASE AQUI
// Verifique se estas chaves estão corretas e não são apenas placeholders.
// =================================================================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// =================================================================================
// 2. VERIFIQUE O UID DO ADMINISTRADOR
// Este é o ID do usuário que tem permissão para ver esta página.
// =================================================================================
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

// Inicializa o Firebase
let app, db, auth;
let firebaseError = null;
try {
  app = initializeApp(firebaseConfig );
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error("Erro Crítico na Inicialização do Firebase:", e);
  firebaseError = e.message; // Captura o erro de inicialização
}

function AdminClientes() {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("Verificando login..."); // Mensagem de status
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Observa o estado da autenticação
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthStatus(`Logado como: ${currentUser.email} (UID: ${currentUser.uid})`);
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
        setError("Nenhuma empresa encontrada no banco de dados.");
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
      setError(`Falha ao buscar dados do Firestore: ${e.message}. Verifique as regras de segurança.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.uid === ADMIN_UID) {
      carregarEmpresas();
    }
  }, [user, carregarEmpresas]);

  // =================================================================================
  // RENDERIZAÇÃO COM MENSAGENS DE DIAGNÓSTICO
  // =================================================================================

  // Se o Firebase falhou ao inicializar
  if (firebaseError) {
    return <div className="container" style={{color: 'red'}}>
      <h2>Erro Crítico</h2>
      <p>O Firebase não pôde ser inicializado. Verifique suas credenciais `firebaseConfig` no arquivo `admin-clientes.js`.</p>
      <p><strong>Detalhe:</strong> {firebaseError}</p>
    </div>;
  }

  // Renderiza o status da autenticação e erros
  const renderDiagnostico = () => {
    return (
      <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
        <h3 style={{marginTop: 0}}>Diagnóstico da Página</h3>
        <p><strong>Status da Autenticação:</strong> {authStatus}</p>
        {user && user.uid !== ADMIN_UID && (
          <p style={{ color: 'red' }}>
            <strong>Aviso de Permissão:</strong> O usuário logado não é o administrador (UID esperado: {ADMIN_UID}).
          </p>
        )}
        {error && <p style={{ color: 'red' }}><strong>Erro de Dados:</strong> {error}</p>}
      </div>
    );
  };

  if (loading && (!user || user.uid === ADMIN_UID)) {
    return <div className="container">{renderDiagnostico()} <div className="loading">Carregando empresas...</div></div>;
  }

  if (!user || user.uid !== ADMIN_UID) {
    return <div className="container">{renderDiagnostico()} <div className="restricted">Acesso restrito.</div></div>;
  }

  // Renderização principal (se tudo estiver correto)
  return (
    <div className="container">
      {renderDiagnostico()}
      <h2>Gestão de Empresas e Funcionários</h2>
      {empresas.map(empresa => (
        <div className="empresa" key={empresa.uid}>
          {/* O resto do seu código de exibição de empresas... */}
        </div>
      ))}
    </div>
  );
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<AdminClientes />);
