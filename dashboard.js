<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pronti - Dashboard</title>
    <link href="style.css" rel="stylesheet" type="text/css" />
    <style>
        body {
            background: #f6f8fc;
            font-family: 'Inter', Arial, sans-serif;
        }
        .dashboard-container {
            max-width: 1020px;
            margin: 38px auto 0;
            padding: 0 18px 28px;
        }
        .dashboard-header {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 16px;
            margin-bottom: 18px;
        }
        .btn-voltar {
            background: #e6eaff;
            color: #1e3a8a;
            border: none;
            border-radius: 8px;
            padding: 7px 18px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.17s;
            box-shadow: 0 1px 4px #b0e1ff22;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-voltar:hover {
            background: #cfe1fa;
        }
        .dashboard-header h1 {
            font-size: 1.55rem;
            font-weight: 700;
            color: #222a52;
            margin: 0;
        }
        .dashboard-filtros {
            margin-bottom: 18px;
        }
        .dashboard-filtros label {
            font-weight: 600;
            margin-right: 8px;
            color: #223;
        }
        .dashboard-filtros input[type="date"] {
            padding: 7px 12px;
            border-radius: 6px;
            border: 1.2px solid #d6dbef;
            font-size: 1rem;
            background: #fff;
            color: #1a1a1a;
        }
        .dashboard-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
            gap: 18px;
            margin-bottom: 24px;
        }
        .dashboard-card {
            background: linear-gradient(120deg, #f7fafd 65%, #e9f3fd 100%);
            border-radius: 14px;
            box-shadow: 0 4px 18px 0 #b4e2fa18, 0 2px 6px #ddeafd55;
            padding: 20px 18px 16px 18px;
            min-height: 108px;
            display: flex;
            flex-direction: column;
            gap: 7px;
            position: relative;
        }
        .dashboard-card h3 {
            font-size: 1.09rem;
            font-weight: 700;
            color: #2e3b65;
            margin: 0 0 2px 0;
        }
        .dashboard-card .card-valor {
            font-size: 1.45rem;
            font-weight: 800;
            color: #1d6ad9;
            margin-bottom: 0;
        }
        .dashboard-card .card-sub {
            font-size: 1.01rem;
            color: #7c8bac;
            margin-bottom: 0;
        }
        .dashboard-card .card-destaque {
            font-size: 1.13rem;
            font-weight: 700;
            color: #175a9c;
            margin-bottom: 0;
        }
        .dashboard-card .card-icone {
            position: absolute;
            top: 12px;
            right: 16px;
            font-size: 1.6em;
            opacity: 0.16;
        }
        .dashboard-card .card-info {
            font-size: 0.97rem;
            color: #37698f;
            margin-top: 4px;
        }
        /* Card de sugestão IA */
        .dashboard-card.ia {
            background: linear-gradient(120deg, #f8fff1 65%, #e6fae9 100%);
            color: #157e39;
        }
        .dashboard-card.ia .card-icone {
            color: #157e39;
            opacity: 0.13;
        }
        .dashboard-card.ia .card-info {
            color: #157e39;
            font-weight: 600;
        }
        /* Card de resumo financeiro */
        .dashboard-card.resumo .card-valor {
            color: #e38a1d;
        }
        .agenda-titulo {
            font-size: 1.19rem;
            font-weight: 700;
            color: #234;
            margin: 22px 0 10px 3px;
        }
        .agenda-resultado {
            margin-bottom: 28px;
        }
        .card-agendamento {
            display: flex;
            align-items: center;
            background: #fafdff;
            border-radius: 10px;
            box-shadow: 0 1px 7px #e5eafd41;
            padding: 10px 16px 10px 14px;
            margin-bottom: 8px;
            gap: 14px;
        }
        .card-agendamento .horario-destaque {
            background: #e0f2fe;
            color: #1584d3;
            font-weight: 700;
            font-size: 1.06rem;
            border-radius: 7px;
            padding: 2.5px 10px 2px 10px;
            margin-right: 8px;
            min-width: 60px;
            display: inline-block;
            text-align: center;
        }
        .card-agendamento .agendamento-info {
            display: flex;
            flex-direction: column;
            gap: 1.5px;
        }
        .aviso-horarios {
            background: #fcefd8;
            color: #a27010;
            border-radius: 8px;
            padding: 13px 14px;
            box-shadow: 0 2px 8px #f6e9c2;
            text-align: center;
            font-size: 1.03rem;
            margin-bottom: 14px;
        }
        @media (max-width: 700px) {
            .dashboard-container {
                padding: 0 4px 16px;
            }
            .dashboard-cards {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <div class="dashboard-header">
            <button id="btn-voltar" class="btn-voltar">
                &#8592; Voltar
            </button>
            <h1>Resumo do seu dia</h1>
        </div>
        <div class="dashboard-filtros">
            <label for="filtro-data">Escolha a data:</label>
            <input type="date" id="filtro-data" />
        </div>
        <div class="dashboard-cards">
            <!-- Card 1: Serviço em destaque -->
            <div class="dashboard-card">
                <span class="card-icone">💇</span>
                <h3>Serviço em destaque</h3>
                <div class="card-destaque" id="servico-destaque">-</div>
            </div>
            <!-- Card 2: Profissional em destaque -->
            <div class="dashboard-card">
                <span class="card-icone">🧑‍💼</span>
                <h3>Profissional em destaque</h3>
                <div class="card-destaque" id="prof-destaque-nome">-</div>
                <div class="card-info" id="prof-destaque-qtd"></div>
            </div>
            <!-- Card 3: Resumo do dia -->
            <div class="dashboard-card resumo">
                <span class="card-icone">📈</span>
                <h3>Resumo do dia</h3>
                <div class="card-sub">Agendamentos: <span class="card-valor" id="total-agendamentos-dia">-</span></div>
                <div class="card-sub">Faturamento: <span class="card-valor" id="faturamento-previsto">-</span></div>
                <div class="card-sub">Ocupação: <span class="card-valor" id="percentual-ocupacao">-</span></div>
            </div>
            <!-- Card 4: Sugestão da IA -->
            <div class="dashboard-card ia">
                <span class="card-icone">🤖</span>
                <h3>Sugestão da IA</h3>
                <div class="card-info" id="ia-sugestao">-</div>
            </div>
        </div>
        <div class="agenda-titulo">Agenda do dia</div>
        <div class="agenda-resultado" id="agenda-resultado"></div>
    </div>
    <script src="dashboard.js" type="module"></script>
</body>
</html>
