<?php
// Carrega as ferramentas necessárias (que instalaremos com o Composer)
require __DIR__ . '/vendor/autoload.php';

use Kreait\Firebase\Factory;
use MercadoPago\Client\PreApproval\PreApprovalClient;
use MercadoPago\MercadoPagoConfig;

// --- INICIALIZAÇÃO SEGURA ---

// O ideal é guardar estas informações em variáveis de ambiente no seu painel de hospedagem
$mercadoPagoToken = getenv('MERCADOPAGO_TOKEN');
$firebaseCredentialsPath = getenv('FIREBASE_CREDENTIALS_PATH'); // Ex: /home/seu_usuario/config/firebase_credentials.json

// Se não tiver variáveis de ambiente, use um ficheiro de configuração SEGURO fora do nível raiz público
if (!$mercadoPagoToken) {
    // Exemplo: $config = require '/home/seu_usuario/config/config.php';
    // $mercadoPagoToken = $config['mp_token'];
    // $firebaseCredentialsPath = $config['firebase_path'];
}

if (!$firebaseCredentialsPath) {
    http_response_code(500);
    die('Credenciais do Firebase não configuradas.');
}

try {
    $firebase = (new Factory)->withServiceAccount($firebaseCredentialsPath);
    $db = $firebase->createFirestore()->database();
    MercadoPagoConfig::setAccessToken($mercadoPagoToken);
} catch (\Exception $e) {
    error_log('Falha na inicialização: ' . $e->getMessage());
    http_response_code(500);
    die('Erro de configuração do servidor.');
}


// --- LÓGICA DO WEBHOOK ---

// Recebe a notificação do Mercado Pago
$json = file_get_contents('php://input');
$data = json_decode($json, true);

error_log("Webhook recebido: " . $json);

if (isset($data['type']) && $data['type'] === 'preapproval') {
    try {
        $client = new PreApprovalClient();
        $preapproval = $client->get($data['id']);

        $assinaturaId = $preapproval->id;
        $statusMP = $preapproval->status;
        
        // Procura no Firestore qual empresa tem esta assinatura
        $assinaturasRef = $db->collectionGroup('assinatura')->where('mercadoPagoAssinaturaId', '==', $assinaturaId);
        $snapshot = $assinaturasRef->documents();

        if ($snapshot->isEmpty()) {
            error_log("Nenhuma assinatura encontrada para o ID: " . $assinaturaId);
            http_response_code(200);
            echo "OK - Nenhuma assinatura correspondente";
            exit;
        }

        $novoStatus = 'desconhecido';
        if ($statusMP === 'authorized') $novoStatus = 'ativo';
        if ($statusMP === 'cancelled') $novoStatus = 'cancelado';
        if ($statusMP === 'paused') $novoStatus = 'pausado';

        foreach ($snapshot as $doc) {
            $empresaRef = $doc->reference()->parent()->parent();
            $empresaData = $empresaRef->snapshot()->data();
            $usuarioRef = $db->collection('usuarios')->document($empresaData['donoId']);
            
            // Atualiza os documentos
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

http_response_code(200);
echo "OK";
?>
