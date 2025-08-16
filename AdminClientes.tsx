// AdminClientes.js (ou .tsx para TypeScript)

import React, { useEffect, useState } from "react";
// ATENÇÃO: Corrija os imports para apontar para seus arquivos reais do Firebase
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./config/firebase";
import { useAuth } from "./useAuth";

// Definindo o tipo de Cliente
type Cliente = {
  uid: string;
  email: string;
  nome?: string;
  plan?: string;
  trialEnds?: string;
  trialDays?: number; // Nosso novo campo
  premiumSince?: string;
  status?: string;
  ultimaAtividade?: string;
};

export function AdminClientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  // NOVO: Estado para guardar os valores dos inputs de trial
  const [diasEditados, setDiasEditados] = useState<{ [uid: string]: number }>({});

  const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // Substitua pelo seu UID de admin

  async function fetchClientes() {
    setLoading(true);
    // ATENÇÃO: Ajuste a coleção para "empresarios" se for o caso
    const snap = await getDocs(collection(db, "empresarios"));
    const lista: Cliente[] = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as Cliente);
    setClientes(lista);
    setLoading(false);
  }
  
  useEffect(() => {
    if (user && user.uid === ADMIN_UID) {
      fetchClientes();
    }
  }, [user]);

  // NOVO: Função para salvar os dias de trial
  const handleSaveTrialDays = async (clienteUid: string) => {
    const days = diasEditados[clienteUid];
    if (typeof days !== 'number' || days < 0) {
      alert("Por favor, insira um número válido de dias.");
      return;
    }
    
    try {
      const clienteRef = doc(db, "empresarios", clienteUid);
      await updateDoc(clienteRef, {
        trialDays: days
      });
      alert(`Dias de trial para o cliente ${clienteUid} atualizado para ${days}!`);
      fetchClientes(); // Recarrega a lista para mostrar o novo valor
    } catch (error) {
      console.error("Erro ao atualizar dias de trial:", error);
      alert("Ocorreu um erro ao salvar.");
    }
  };

  // NOVO: Função para atualizar o estado enquanto você digita
  const handleDaysChange = (uid: string, value: string) => {
    setDiasEditados(prev => ({
      ...prev,
      [uid]: Number(value)
    }));
  };

  if (!user || user.uid !== ADMIN_UID) {
    return <div style={{padding: 32, textAlign: "center"}}>Acesso restrito.</div>;
  }
  if (loading) return <div style={{padding: 32}}>Carregando clientes...</div>;

  return (
    <div style={{padding: 32}}>
      <h2 style={{fontWeight: "bold", fontSize: 22, marginBottom: 24}}>Gestão de Clientes</h2>
      <table border={1} cellPadding={8} style={{width: "100%", borderCollapse: "collapse"}}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nome</th>
            <th>Trial Ends</th>
            <th style={{width: "200px"}}>Dias de Trial (Padrão)</th> {/* NOVA COLUNA */}
          </tr>
        </thead>
        <tbody>
          {clientes.map(cli => (
            <tr key={cli.uid}>
              <td>{cli.email}</td>
              <td>{cli.nome || "-"}</td>
              <td>{cli.trialEnds ? new Date(cli.trialEnds).toLocaleDateString() : "N/A"}</td>
              
              {/* NOVA CÉLULA COM INPUT E BOTÃO */}
              <td style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <input
                  type="number"
                  value={diasEditados[cli.uid] ?? cli.trialDays ?? 15}
                  onChange={(e) => handleDaysChange(cli.uid, e.target.value)}
                  style={{width: '60px', padding: '4px'}}
                />
                <button onClick={() => handleSaveTrialDays(cli.uid)}>
                  Salvar
                </button>
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
