// admin.js

// Importa as funções do React que acabamos de carregar via CDN no HTML
const { useState, useEffect } = React;

// Importa seu componente da tabela de clientes
// ATENÇÃO: Verifique se o nome e o caminho do arquivo estão corretos!
import { AdminClientes } from './AdminClientes.js';

// Encontra a div 'root' no nosso HTML
const container = document.getElementById('root');

// Cria a 'raiz' da nossa aplicação React
const root = ReactDOM.createRoot(container);

// Renderiza (desenha) o seu componente AdminClientes dentro da div 'root'
root.render(
  React.createElement(AdminClientes)
);
