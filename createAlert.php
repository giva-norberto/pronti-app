<?php
require_once 'FireBaseNotifications.class.php';
require 'vendor/autoload.php'; // se você estiver usando o SDK do Firebase PHP

use Google\Cloud\Firestore\FirestoreClient;

try {
    // === CONFIGURAÇÕES ===
    $firebaseServerKey = 'SUA_SERVER_KEY_DO_FIREBASE';
    $donoId = $_POST['donoId'] ?? ''; // ID do dono da empresa
    $empresaId = $_POST['empresaId'] ?? '';
    $titulo = $_POST['titulo'] ?? 'Novo Agendamento';
    $mensagem = $_POST['mensagem'] ?? 'Você tem um novo agendamento!';

    if (!$donoId || !$empresaId) {
        throw new Exception("donoId e empresaId são obrigatórios.");
    }

    // === INICIALIZA FIRESTORE ===
    $firestore = new FirestoreClient([
        'projectId' => 'pronti-app-37c6e'
    ]);

    // === REFERÊNCIA AO DOCUMENTO DE ALERTA ===
    $docRef = $firestore->collection('alerts')->document($empresaId . '_' . $donoId);

    // === CRIA DOCUMENTO SE NÃO EXISTIR ===
    $snapshot = $docRef->snapshot();
    if (!$snapshot->exists()) {
        $docRef->set([
            'empresaId' => $empresaId,
            'donoId' => $donoId,
            'titulo' => $titulo,
            'mensagem' => $mensagem,
            'createdAt' => new \Google\Cloud\Core\Timestamp(new DateTime()),
            'updatedAt' => new \Google\Cloud\Core\Timestamp(new DateTime()),
            'status' => 'ativo'
        ]);
    } else {
        // Atualiza apenas a mensagem e updatedAt
        $docRef->update([
            ['path' => 'mensagem', 'value' => $mensagem],
            ['path' => 'updatedAt', 'value' => new \Google\Cloud\Core\Timestamp(new DateTime())]
        ]);
    }

    // === BUSCA TOKEN DO USUÁRIO ===
    $tokenDoc = $firestore->collection('userTokens')->document($donoId)->snapshot();
    if (!$tokenDoc->exists()) {
        throw new Exception("Token do dono não encontrado no Firestore.");
    }
    $token = $tokenDoc['fcmToken'] ?? '';

    if (!$token) {
        throw new Exception("Token FCM vazio para o dono.");
    }

    // === ENVIA NOTIFICAÇÃO VIA FireBaseNotifications ===
    $firebase = new FireBaseNotifications($firebaseServerKey);
    $result = $firebase->sendToTokens([$token], $titulo, $mensagem);

    echo json_encode([
        'success' => true,
        'firebaseResult' => $result
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
