import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./config/firebase"; // ajuste esse import se necessário
import { useAuth } from "./useAuth"; // ajuste o caminho conforme seu projeto

type Cliente = {
  uid: string;
  email: string;
  nome?: string;
  plan?: string;
  trialEnds?: string;
  premiumSince?: string;
  status?: string;
  ultimaAtividade?: string;
};

export function AdminClientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Substitua pelo seu UID do admin. 
  // Você pode achar no painel do Firebase Auth ou com user.uid logado como admin.
  const ADMIN_UID = "SEU_UID_AQUI";

  useEffect(() => {
    if (!user || user.uid !== ADMIN_UID) return;
    async function fetchClientes() {
      setLoading(true);
      const snap = await getDocs(collection(db, "usuarios"));
      const lista: Cliente[] = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as Cliente);
      setClientes(lista);
      setLoading(false);
    }
    fetchClientes();
  }, [user]);

  if (!user || user.uid !== ADMIN_UID) {
    return <div style={{padding: 32, textAlign: "center"}}>Acesso restrito.</div>;
  }

  if (loading) return <div style={{padding: 32}}>Carregando clientes...</div>;

  return (
    <div style={{padding: 32}}>
      <h2 style={{fontWeight: "bold", fontSize: 22, marginBottom: 24}}>Clientes</h2>
      <table border={1} cellPadding={8} style={{width: "100%", borderCollapse: "collapse"}}>
        <thead>
          <tr>
            <th>UID</th>
            <th>Email</th>
            <th>Nome</th>
            <th>Plano</th>
            <th>Trial Ends</th>
            <th>Premium Desde</th>
            <th>Status</th>
            <th>Última Atividade</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map(cli => (
            <tr key={cli.uid}>
              <td>{cli.uid}</td>
              <td>{cli.email}</td>
              <td>{cli.nome || "-"}</td>
              <td>{cli.plan || "-"}</td>
              <td>{cli.trialEnds ? new Date(cli.trialEnds).toLocaleDateString() : "-"}</td>
              <td>{cli.premiumSince ? new Date(cli.premiumSince).toLocaleDateString() : "-"}</td>
              <td>{cli.status || "-"}</td>
              <td>{cli.ultimaAtividade ? new Date(cli.ultimaAtividade).toLocaleString() : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
