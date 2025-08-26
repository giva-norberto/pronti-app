import React, { useEffect, useState, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./config/firebase";
import { useAuth } from "./useAuth";

export function AdminClientes() {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // ID da empresa sendo bloqueada/desbloqueada
  const ADMIN_UID = "BX6Q7HrVMrcCBqe72r7K76EBPkX2"; // Seu UID de admin

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
      console.error("Erro ao carregar empresas:", e);
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
      setActionLoading(uid);
      await updateDoc(doc(db, "empresarios", uid), { bloqueado: bloquear });

      const profSnap = await getDocs(collection(db, "empresarios", uid, "profissionais"));
      await Promise.all(profSnap.docs.map(p =>
        updateDoc(doc(db, "empresarios", uid, "profissionais", p.id), { bloqueado: bloquear })
          .catch(err => console.error(`Erro ao atualizar funcionário ${p.id}:`, err))
      ));

      await carregarEmpresas();
    } catch (e) {
      console.error("Erro ao bloquear/desbloquear empresa:", e);
      alert("Erro ao bloquear/desbloquear empresa.");
    } finally {
      setActionLoading(null);
    }
  }

  if (!user) return <div style={{ padding: 32, textAlign: "center" }}>Aguardando login...</div>;
  if (user.uid !== ADMIN_UID) return <div style={{ padding: 32, textAlign: "center" }}>Acesso restrito.</div>;
  if (loading) return <div style={{ padding: 32 }}>Carregando empresas...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontWeight: "bold", fontSize: 22, marginBottom: 24 }}>Gestão de Empresas e Funcionários</h2>
      {empresas.length === 0 && (
        <div style={{ color: "#888", fontStyle: "italic" }}>Nenhuma empresa cadastrada.</div>
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
              <strong>Empresa:</strong> {empresa.nome || empresa.email || empresa.uid}<br/>
              <strong>Dono:</strong> {empresa.nome || "-"} ({empresa.email || "-"})<br/>
              <strong>Status:</strong>{" "}
              {empresa.bloqueado ? (
                <span style={{ color: "#dc2626" }}>Bloqueada</span>
              ) : (
                <span style={{ color: "#10b981" }}>Ativa</span>
              )}
            </div>
            <button
              disabled={actionLoading === empresa.uid}
              style={{
                background: empresa.bloqueado ? "#10b981" : "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "6px 18px",
                fontWeight: 600,
                cursor: actionLoading === empresa.uid ? "not-allowed" : "pointer",
                opacity: actionLoading === empresa.uid ? 0.6 : 1
              }}
              onClick={() => bloquearEmpresa(empresa.uid, !empresa.bloqueado)}
            >
              {actionLoading === empresa.uid ? "Aguarde..." : (empresa.bloqueado ? "Desbloquear Empresa" : "Bloquear Empresa")}
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
                    <td colSpan={3} style={{ textAlign: "center", color: "#aaa" }}>Nenhum funcionário</td>
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
