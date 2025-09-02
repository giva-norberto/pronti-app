// Arquivo: admin-clientes.js (Versão Final SEM JSX) - Firebase 10.13.2

import React from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client";
import { auth, db } from "./vitrini-firebase.js"; // USA SUA CONEXÃO EXISTENTE
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const e = React.createElement;
const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2";

function AdminClientes( ) {
    const [user, setUser] = React.useState(null);
    const [authLoading, setAuthLoading] = React.useState(true);
    const [dataLoading, setDataLoading] = React.useState(false);
    const [empresas, setEmpresas] = React.useState([]);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const carregarEmpresas = React.useCallback(async () => {
        setDataLoading(true);
        setError(null);
        try {
            const snap = await getDocs(collection(db, "empresarios"));
            const lista = await Promise.all(
                snap.docs.map(async (empresaDoc) => {
                    const profSnap = await getDocs(collection(db, "empresarios", empresaDoc.id, "profissionais"));
                    return { uid: empresaDoc.id, ...empresaDoc.data(), funcionarios: profSnap.docs.map(p => ({ id: p.id, ...p.data() })) };
                })
            );
            setEmpresas(lista);
        } catch (err) {
            setError("Falha ao buscar dados: " + err.message);
        } finally {
            setDataLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (user && user.uid === ADMIN_UID) {
            carregarEmpresas();
        }
    }, [user, carregarEmpresas]);

    if (authLoading) {
        return e('div', { className: 'loading' }, 'Verificando autenticação...');
    }
    if (!user) {
        return e('div', { className: 'restricted' }, 'Acesso negado. Por favor, faça o login.');
    }
    if (user.uid !== ADMIN_UID) {
        return e('div', { className: 'restricted' }, `Acesso restrito. Apenas administradores. (Seu UID: ${user.uid})`);
    }

    return e('div', { className: 'container' },
        e('h2', null, 'Gestão de Empresas e Funcionários'),
        dataLoading && e('div', { className: 'loading' }, 'Carregando dados...'),
        error && e('div', { className: 'restricted', style: { color: 'red' } }, e('strong', null, 'Erro: '), error),
        !dataLoading && !error && empresas.length === 0 && e('p', null, 'Nenhuma empresa encontrada.'),
        empresas.map(emp => 
            e('div', { className: 'empresa', key: emp.uid },
                e('div', { className: 'empresa-header' },
                    e('div', null,
                        e('div', null, e('strong', null, 'Empresa: '), emp.nome || emp.email || emp.uid),
                        e('div', null, e('strong', null, 'Status: '), e('span', { className: 'empresa-status', style: { color: emp.bloqueado ? '#dc2626' : '#10b981' } }, emp.bloqueado ? 'Bloqueada' : 'Ativa'))
                    ),
                    e('button', { className: emp.bloqueado ? 'btn-unblock' : 'btn-block', onClick: () => { /* Lógica de bloquear aqui */ } }, emp.bloqueado ? 'Desbloquear' : 'Bloquear')
                ),
                e('div', { style: { marginTop: 16 } },
                    e('strong', null, 'Funcionários:'),
                    e('table', { style: { width: '100%', marginTop: 8, borderCollapse: 'collapse' } },
                        e('thead', null, e('tr', { style: { background: '#f3f4f6' } }, e('th', null, 'Nome'), e('th', null, 'Email'), e('th', null, 'Status'))),
                        e('tbody', null, 
                            emp.funcionarios.length === 0 
                            ? e('tr', null, e('td', { colSpan: 3, style: { textAlign: 'center', color: '#aaa' } }, 'Nenhum funcionário'))
                            : emp.funcionarios.map(f => e('tr', { key: f.id, className: f.bloqueado ? 'blocked' : '' }, e('td', null, f.nome || '-'), e('td', null, f.email || '-'), e('td', null, e('span', { style: { color: f.bloqueado ? '#dc2626' : '#10b981' } }, f.bloqueado ? 'Bloqueado' : 'Ativo'))))
                        )
                    )
                )
            )
        )
    );
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(e(AdminClientes));
