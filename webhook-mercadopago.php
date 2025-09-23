<?php
// =====================================================
// Webhook PHP para atualizar status de assinaturas
// VERSÃO CORRIGIDA: Usa o ficheiro de credenciais para autenticar no Firebase
// =====================================================

require __DIR__ . '/vendor/autoload.php';

use Kreait\Firebase\Factory;
use MercadoPago\Client\PreApproval\PreApprovalClient;
use MercadoPago\MercadoPagoConfig;

// -----------------------------------------------------
// Configuração Segura e Correta
// -----------------------------------------------------

// 1. Pega o Token do Mercado Pago a partir das variáveis de ambiente do seu hosting
$mercadoPagoToken = getenv('MERCADOPAGO_TOKEN');
if (!$mercadoPagoToken) {
    http_response_code(500);
    die('Token do Mercado Pago não configurado.');
}
MercadoPagoConfig::setAccessToken($mercadoPagoToken);

// 2. Pega o CAMINHO para a sua chave do Firebase a partir das variáveis de ambiente
$firebaseCredentialsPath = getenv('FIREBASE_CREDENTIALS_PATH');
if (!$firebaseCredentialsPath) {
    http_response_code(500);
    die('Caminho das credenciais do Firebase não configurado.');
}

try {
    // 3. ✅ CORREÇÃO: Autentica no Firebase usando o seu ficheiro de chave JSON
    $firebase = (new Factory)->withServiceAccount($firebaseCredentialsPath);
    $db = $firebase->createFirestore()->database();
} catch (\Exception $e) {
    error_log("Erro na inicialização: " . $e->getMessage());
    http_response_code(500);
    die("Erro de configuração do servidor.");
}


// -----------------------------------------------------
// Recebe notificação (A sua lógica original, que está perfeita)
// -----------------------------------------------------
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Só processa assinaturas
if (isset($data['type']) && $data['type'] === 'preapproval') {
    try {
        $client = new PreApprovalClient();
        $preapproval = $client->get($data['id']);

        $statusMP = $preapproval->status;
        $assinaturaId = $preapproval->id;

        // Mapear status
        $novoStatus = match($statusMP) {
            'authorized' => 'ativo',
            'cancelled'  => 'cancelado',
            'paused'     => 'pausado',
            default      => 'desconhecido',
        };

        // Busca assinatura no Firestore
        $assinaturasRef = $db->collectionGroup('assinatura')
            ->where('mercadoPagoAssinaturaId', '==', $assinaturaId);
        $snapshot = $assinaturasRef->documents();

        if (!$snapshot->isEmpty()) {
            foreach ($snapshot as $doc) {
                $empresaRef = $doc->reference()->parent()->parent();
                $empresaData = $empresaRef->snapshot()->data();
                $usuarioRef = $db->collection('usuarios')->document($empresaData['donoId']);

                // Atualiza status
                $doc->reference()->update([['path' => 'status', 'value' => $novoStatus]]);
                $empresaRef->update([['path' => 'status', 'value' => $novoStatus]]);
                $usuarioRef->update([['path' => 'isPremium', 'value' => ($novoStatus === 'ativo')]]);
            }
        }

    } catch (\Exception $e) {
        error_log("Erro no webhook: " . $e->getMessage());
        http_response_code(500);
        exit;
    }
}

// Retorna OK para o Mercado Pago
http_response_code(200);
echo "OK";
