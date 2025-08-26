// Arquivo: admin-clientes.js (VERSÃO DE TESTE SIMPLES)

import React from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client";

function TesteSimples( ) {
  // Este componente apenas mostra uma mensagem de sucesso.
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial', fontSize: '18px' }}>
      <h1 style={{ color: 'green' }}>Teste de Renderização OK!</h1>
      <p>Se você está vendo esta mensagem, o React está funcionando corretamente.</p>
      <p>O próximo passo é reconectar o Firebase.</p>
    </div>
  );
}

// Pega o elemento 'root' do HTML
const container = document.getElementById('root');

// Renderiza o componente de teste dentro do 'root'
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<TesteSimples />);
} else {
  // Se não encontrar a div 'root', mostra um alerta de erro crítico.
  alert("ERRO CRÍTICO: A div com id='root' não foi encontrada no arquivo HTML. Verifique o admin-clientes.html.");
}
