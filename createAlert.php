<?php
// Inclui o autoloader do Composer e a sua classe de notificações
require 'vendor/autoload.php';
require_once 'FireBaseNotifications.class.php';

// Define o cabeçalho da resposta como JSON
header('Content-Type: application/json');

try {
    // --- CONFIGURAÇÕES ---
    // Chave do servidor (ainda necessária para a sua classe FireBaseNotifications.class.php)
    $firebaseServerKey = 'SUA_ANTIGA_SERVER_KEY_DO_FIREBASE'; // Cole a chave aqui por enquanto

    // --- INICIALIZA O FIRESTORE COM AUTENTICAÇÃO SEGURA ---
    // 1. Baixe o arquivo JSON da sua conta de serviço no Console do Firebase
    //    (Configurações do Projeto -> Contas de Serviço -> Gerar nova chave privada)
    // 2. Coloque o arquivo JSON na mesma pasta que este script e renomeie para 'firebase_credentials.json'
    $firestore = new \Google\Cloud\Firestore\FirestoreClient([
        'projectId' => 'pronti-app-37c6e',
        'keyFilePath' => __DIR__ . '/firebase_credentials.json'
    ]);

    // --- RECEBE OS DADOS DA REQUISIÇÃO ---
    // Idealmente, os dados viriam de um POST de um formulário ou de uma chamada de API
    $donoId = $_POST['donoId'] ?? '';
    $empresaId = $_POST['empresaId'] ?? '';
    $titulo = $_POST['titulo'] ?? 'Novo Agendamento';
    $mensagem = $_POST['mensagem'] ?? 'Você tem um novo agendamento!';

    // Validação básica
    if (empty($donoId) || empty($empresaId)) {
        throw new Exception("Parâmetros obrigatórios ausentes: donoId e empresaId.");
    }

    // --- BUSCA O TOKEN FCM DO DONO NA COLEÇÃO CORRETA ---
    // ✅ CORREÇÃO: Buscando na coleção 'mensagensTokens' que configuramos
    $tokenDocRef = $firestore->collection('mensagensTokens')->document($donoId);
    $tokenSnapshot = $tokenDocRef->snapshot();

    if (!$tokenSnapshot->exists()) {
        throw new Exception("Token FCM não encontrado para o dono ID: " . $donoId);
    }

    $fcmToken = $tokenSnapshot->data()['fcmToken'] ?? '';

    if (empty($fcmToken)) {
        throw new Exception("O documento do token existe, mas o campo fcmToken está vazio.");
    }

    // --- ENVIA A NOTIFICAÇÃO ---
    $firebaseNotifications = new FireBaseNotifications($firebaseServerKey);
    
    // Você pode customizar o payload para incluir mais dados, se sua classe permitir
    $payload = [
        'notification' => [
            'title' => $titulo,
            'body' => $mensagem,
            'badge' => '1',
            'sound' => 'default'
        ],
        'data' => [
            'empresaId' => $empresaId,
            'tipo' => 'novo_agendamento'
        ]
    ];

    // Supondo que sua classe tenha um método para enviar um payload completo.
    // Se não, o método sendToTokens pode ser suficiente.
    $firebaseResult = $firebaseNotifications->sendToTokens([$fcmToken], $titulo, $mensagem);

    // --- Resposta de Sucesso ---
    echo json_encode([
        'success' => true,
        'message' => 'Notificação enviada com sucesso.',
        'firebaseResult' => $firebaseResult
    ]);

} catch (Exception $e) {
    // --- Resposta de Erro ---
    http_response_code(400 ); // Define um código de erro HTTP
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
