import React from "react";

export default function AlertCard({ open, onClose, onTrial, title, message }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "24px 18px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
        minWidth: 320,
        maxWidth: "90vw",
        textAlign: "center",
        border: "2px solid #0ec6d5"
      }}>
        <h3 style={{color: "#0ec6d5", marginBottom: 10, fontWeight: 700}}>
          {title || "Ops! Não encontramos sua empresa"}
        </h3>
        <div style={{marginBottom: 20, color: "#444", fontSize: 16}}>
          {message || "Deseja experimentar a versão de teste gratuita agora?"}
        </div>
        <div style={{display: "flex", justifyContent: "center", gap: 12}}>
          <button
            onClick={onTrial}
            style={{
              background: "#0ec6d5",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              padding: "8px 20px",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer"
            }}
          >
            Usar versão de teste
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#0ec6d5",
              border: "2px solid #0ec6d5",
              borderRadius: 5,
              padding: "8px 20px",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
