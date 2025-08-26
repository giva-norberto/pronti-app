// Arquivo: admin-clientes.js

// Importa o React e o ReactDOM para renderizar a página
import React, { useState, useEffect, useCallback } from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client";

// ===================================================================
//                        PONTO CRUCIAL
// Importa a conexão do Firebase que VOCÊ já criou, evitando conflito.
// ===================================================================
import { auth, db } from "./vitrini-firebase.js"; 

// Importa as funções do Firestore que vamos usar
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

function AdminClientes( ) {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const carregarEmpresas = useCallback(async () => {
        setDataLoading(true);
        setError(null);
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
            setError("Falha ao buscar dados: " + e.message);
        } finally {
            setDataLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user && user.uid === ADMIN_UID) {
            carregarEmpresas();
        }
    }, [user, carregarEmpresas]);

    if (authLoading) {
        return <div className="loading">Verificando autenticação...</div>;
    }

    if (!user) {
        return <div className="restricted">Acesso negado. Por favor, faça o login.</div>;
    }

    if (user.uid !== ADMIN_UID) {
        return <div className="restricted">Acesso restrito. Apenas administradores. (Seu UID: {user.uid})</div>;
    }

    return (
        <div className="container">
            <h2>Gestão de Empresas e Funcionários</h2>
            {dataLoading && <div className="loading">Carregando dados...</div>}
            {error && <div className="restricted" style={{color: 'red'}}><strong>Erro:</strong> {error}</div>}
            {!dataLoading && !error && empresas.length === 0 && <p>Nenhuma empresa encontrada.</p>}
            
            {empresas.map(emp => (
                <div className="empresa" key={emp.uid}>
                    <div><strong>Empresa:</strong> {emp.nome || emp.email || emp.uid}</div>
                    {/* Resto do seu código para mostrar os dados... */}
                </div>
            ))}
        </div>
    );
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<AdminClientes />);
