import React, { useEffect, useState, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./config/firebase";
import { useAuth } from "./useAuth";

export function AdminClientes() {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // Substitua pelo seu UID de admin

  const carregarEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "empresarios"));
      const lista = [];
      for (const empresaDoc of snap.docs) {
        const empresa = { uid: empresaDoc.id, ...empresaDoc.data(), funcionarios: [] };
        // Busca funcionários
        const profSnap = await getDocs(collection(db, "empresarios", empresaDoc.id, "profissionais"));
        empresa.funcionarios = profSnap.docs.map(p => ({
          id: p.id,
          ...p.data()
        }));
        lista.push(empresa);
      }
      setEmpresas(lista);
    } catch (e) {
      alert("Erro ao carregar empresas!");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.uid === ADMIN_UID) {
      carregarEmpresas();
    }
  }, [user, carregarEmpresas]);

  async function bloquearEmpresa(uid, bloquear) {
    try {
      await updateDoc(doc(db, "empresarios", uid), { bloqueado: bloquear });
      const profSnap = await getDocs(collection(db, "empresarios", uid, "profissionais"));
      const updates = [];
      profSnap.forEach(prof => {
        updates.push(updateDoc(doc(db, "empresarios", uid, "profissionais", prof.id), { bloqueado: bloquear }));
      });
      await Promise.all(updates);
      await carregarEmpresas();
    } catch (e) {
      alert("Erro ao bloquear/desbloquear empresa.");
    }
  }

  if (!user || user.uid !== ADMIN_UID) {
    return <div style={{ padding: 32, textAlign: "center" }}>Acesso restrito.</div>;
  }
  if (loading) return <div style={{ padding: 32 }}>Carregando empresas...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontWeight: "bold", fontSize: 22, marginBottom: 24 }}>
        Gestão de Empresas e Funcionários
      </h2>
      {empresas.length === 0 && (
        <div style={{ color: "#888", fontStyle: "italic" }}>
          Nenhuma empresa cadastrada.
        </div>
      )}
      {empresas.map(empresa => (
        <div
          key={empresa.uid}
          style={{
            border: "1px solid #eee",
            marginBottom: 32,
            borderRadius: 8,
            padding: 16,
            background: "#fafbfc"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <strong>Empresa:</strong> {empresa.nome || empresa.email || empresa.uid}
              <br />
              <strong>Dono:</strong> {empresa.nome || "-"} ({empresa.email || "-"})
              <br />
              <strong>Status:</strong>{" "}
              {empresa.bloqueado ? (
                <span style={{ color: "#dc2626" }}>Bloqueada</span>
              ) : (
                <span style={{ color: "#10b981" }}>Ativa</span>
              )}
            </div>
            <button
              style={{
                background: empresa.bloqueado ? "#10b981" : "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "6px 18px",
                fontWeight: 600,
                cursor: "pointer"
              }}
              onClick={() => bloquearEmpresa(empresa.uid, !empresa.bloqueado)}
            >
              {empresa.bloqueado ? "Desbloquear Empresa" : "Bloquear Empresa"}
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <strong>Funcionários:</strong>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {empresa.funcionarios.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "#aaa" }}>
                      Nenhum funcionário
                    </td>
                  </tr>
                )}
                {empresa.funcionarios.map(func => (
                  <tr key={func.id} style={func.bloqueado ? { background: "#fde2e2" } : {}}>
                    <td>{func.nome || "-"}</td>
                    <td>{func.email || "-"}</td>
                    <td>
                      {func.bloqueado ? (
                        <span style={{ color: "#dc2626" }}>Bloqueado</span>
                      ) : (
                        <span style={{ color: "#10b981" }}>Ativo</span>
                      )}
                    </td>
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
