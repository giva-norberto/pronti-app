<?php
// =====================================================
// Webhook PHP para atualizar status de assinaturas
// =====================================================

// Carrega as bibliotecas instaladas via Composer
require __DIR__ . '/vendor/autoload.php';

use Kreait\Firebase\Factory;
use MercadoPago\Client\PreApproval\PreApprovalClient;
use MercadoPago\MercadoPagoConfig;

// -----------------------------------------------------
// --- INICIALIZAÇÃO SEGURA ---
// -----------------------------------------------------

// Recupera credenciais de variáveis de ambiente
$mercadoPagoToken = getenv('MERCADOPAGO_TOKEN');
$firebaseCredentialsPath = getenv('FIREBASE_CREDENTIALS_PATH'); // Ex: /home/seu_usuario/config/firebase-credentials.json

// Verifica se as variáveis estão definidas
if (!$mercadoPagoToken) {
    error_log("Token do Mercado Pago não definido.");
    http_response_code(500);
    die('Token do Mercado Pago não configurado.');
}

// Para ambientes tradicionais que usam JSON do Firebase
if (!$firebaseCredentialsPath) {
    error_log("Credenciais do Firebase não definidas.");
    http_response_code(500);
    die('Credenciais do Firebase não configuradas.');
}

try {
    // Inicializa Firebase
    $firebase = (new Factory)
        ->withServiceAccount($firebaseCredentialsPath) // ou ->withDefaultCredentials() se estiver no Cloud
        ->createFirestore();
    $db = $firebase->database();

    // Inicializa Mercado Pago
    MercadoPagoConfig::setAccessToken($mercadoPagoToken);

} catch (\Exception $e) {
    error_log('Falha na inicialização: ' . $e->getMessage());
    http_response_code(500);
    die('Erro de configuração do servidor.');
}

// -----------------------------------------------------
// --- LÓGICA DO WEBHOOK ---
// -----------------------------------------------------

// Recebe notificação do Mercado Pago
$json = file_get_contents('php://input');
$data = json_decode($json, true);

error_log("Webhook recebido: " . $json);

// Só processa notificações de assinaturas (preapproval)
if (isset($data['type']) && $data['type'] === 'preapproval') {
    try {
        $client = new PreApprovalClient();
        $preapproval = $client->get($data['id']);

        $assinaturaId = $preapproval->id;
        $statusMP = $preapproval->status;

        // Busca empresa pelo ID da assinatura no Firestore
        $assinaturasRef = $db->collectionGroup('assinatura')
            ->where('mercadoPagoAssinaturaId', '==', $assinaturaId);
        $snapshot = $assinaturasRef->documents();

        if ($snapshot->isEmpty()) {
            error_log("Nenhuma assinatura encontrada para o ID: " . $assinaturaId);
            http_response_code(200);
            echo "OK - Nenhuma assinatura correspondente";
            exit;
        }

        // Mapeia status do Mercado Pago para status interno
        $novoStatus = 'desconhecido';
        if ($statusMP === 'authorized') $novoStatus = 'ativo';
        if ($statusMP === 'cancelled') $novoStatus = 'cancelado';
        if ($statusMP === 'paused') $novoStatus = 'pausado';

        // Atualiza Firestore para cada assinatura encontrada
        foreach ($snapshot as $doc) {
            $empresaRef = $doc->reference()->parent()->parent();
            $empresaData = $empresaRef->snapshot()->data();
            $usuarioRef = $db->collection('usuarios')->document($empresaData['donoId']);

            // Atualiza status
            $doc->reference()->update([['path' => 'status', 'value' => $novoStatus]]);
            $empresaRef->update([['path' => 'status', 'value' => $novoStatus]]);
            $usuarioRef->update([['path' => 'isPremium', 'value' => ($novoStatus === 'ativo')]]);

            error_log("SUCESSO: Empresa " . $empresaRef->id() . " atualizada para status " . $novoStatus);
        }

    } catch (\Exception $e) {
        error_log("ERRO GRAVE no webhook PHP: " . $e->getMessage());
        http_response_code(500);
        echo "Erro interno ao processar webhook.";
        exit;
    }
}

// Resposta final para o Mercado Pago
http_response_code(200);
echo "OK";

?>
