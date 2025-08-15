<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pronti - Clientes</title>
    <link href="style.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
    <!-- FontAwesome (opcional) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .main-content {
            margin-left: 220px;
            padding: 40px 32px 32px 32px;
        }
        @media (max-width: 900px) {
            .main-content { margin-left: 60px; }
        }
        /* Modal de confirmação */
        .modal-overlay {
            position: fixed;
            left: 0; top: 0;
            width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        .modal-overlay.show { display: flex; }
        .modal-box {
            background: #fff;
            border-radius: 10px;
            padding: 28px;
            max-width: 400px;
            width: 90vw;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18);
            text-align: center;
        }
        .modal-botoes {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
        }
        .btn-modal {
            margin: 6px 0;
            padding: 10px 24px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
        }
        .btn-cancelar { background: #eee; color: #333;}
        .btn-confirmar { background: #ff6b6b; color: #fff;}
    </style>
</head>
<body>
    <!-- Menu lateral incluso dinamicamente -->
    <div id="sidebar-placeholder"></div>

    <main class="main-content">
        <h1>Meus Clientes</h1>
        <a href="novo-cliente.html" class="btn-new">Cadastrar Novo Cliente</a>
        <div id="lista-clientes" style="margin-top: 20px;"></div>
    </main>

    <!-- Modal de confirmação -->
    <div id="modal-confirmacao" class="modal-overlay">
        <div class="modal-box">
            <h3 id="modal-titulo">Confirmar Exclusão</h3>
            <p id="modal-mensagem">Você tem certeza?</p>
            <div class="modal-botoes">
                <button id="btn-modal-cancelar" class="btn-modal btn-cancelar">Cancelar</button>
                <button id="btn-modal-confirmar" class="btn-modal btn-confirmar">Sim, Excluir</button>
            </div>
        </div>
    </div>

    <script>
    // Inclui o menu-lateral.html dinamicamente (padrão unificado)
    document.addEventListener("DOMContentLoaded", function() {
      fetch('menu-lateral.html')
        .then(res => res.text())
        .then(html => {
          document.getElementById('sidebar-placeholder').innerHTML = html;
          // Destaca o item clientes após inclusão do menu
          const links = document.querySelectorAll('.sidebar-links a');
          links.forEach(link => link.classList.remove('active'));
          const clientesLink = document.querySelector('.sidebar-links a[href="clientes.html"]');
          if (clientesLink) {
              clientesLink.classList.add('active');
          }
        });
    });
    </script>
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="clientes.js" type="module"></script>
</body>
</html>
