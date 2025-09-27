<?php
require_once 'FireBaseNotifications.class.php';
require 'vendor/autoload.php';

use Google\Cloud\Firestore\FirestoreClient;

header('Content-Type: application/json');

try {
    // === CONFIGURAÇÕES ===
    $firebaseServerKey = 'SUA_SERVER_KEY_DO_FIREBASE';
    $donoId = $_POST['donoId'] ?? '';
    $empresaId = $_POST['empresaId'] ?? '';
    $titulo = $_POST['titulo'] ?? 'Novo Agendamento';
    $mensagem = $_POST['mensagem'] ?? 'Você tem um novo agendamento!';

    if (!$donoId || !$empresaId) {
        throw new Exception("Parâmetros obrigatórios ausentes: donoId e empresaId.");
    }

    // === INICIALIZA FIRESTORE ===
    $firestore = new FirestoreClient(['projectId' => 'pronti-app-37c6e']);

    // === REFERÊNCIA AO DOCUMENTO DE ALERTA ===
    $docId = $empresaId . '_' . $donoId;
    $docRef = $firestore->collection('alerts')->document($docId);

    // === CRIA OU ATUALIZA DOCUMENTO ===
    $now = new \Google\Cloud\Core\Timestamp(new DateTime());
    $docRef->set([
        'empresaId' => $empresaId,
        'donoId' => $donoId,
        'titulo' => $titulo,
        'mensagem' => $mensagem,
        'status' => 'ativo',
        'createdAt' => $now,
        'updatedAt' => $now
    ], ['merge' => true]); // merge = true garante atualização se já existir

    // === BUSCA TOKEN DO USUÁRIO ===
    $tokenDoc = $firestore->collection('userTokens')->document($donoId)->snapshot();
    $token = $tokenDoc->exists() ? ($tokenDoc['fcmToken'] ?? '') : '';

    if (!$token) {
        throw new Exception("Token FCM não encontrado para o dono.");
    }

    // === ENVIA NOTIFICAÇÃO ===
    $firebase = new FireBaseNotifications($firebaseServerKey);
    $firebaseResult = $firebase->sendToTokens([$token], $titulo, $mensagem);

    echo json_encode([
        'success' => true,
        'firebaseResult' => $firebaseResult
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
