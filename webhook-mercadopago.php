<?php
// =====================================================
// Webhook PHP para atualizar status de assinaturas
// VERSÃO REVISADA: Usa a 'external_reference' para identificar e atualizar o cliente.
// =====================================================

require __DIR__ . '/vendor/autoload.php';

use Kreait\Firebase\Factory;
use MercadoPago\Client\PreApproval\PreApprovalClient;
use MercadoPago\MercadoPagoConfig;

// -----------------------------------------------------
// Configuração Segura e Correta (SUA LÓGICA ORIGINAL - MANTIDA 100%)
// -----------------------------------------------------

// 1. Pega o Token do Mercado Pago a partir das variáveis de ambiente do seu hosting
$mercadoPagoToken = getenv('MERCADOPAGO_TOKEN');
if (!$mercadoPagoToken) {
    http_response_code(500);
    // Adiciona um log para depuração
    error_log('Token do Mercado Pago não configurado nas variáveis de ambiente.');
    die('Token do Mercado Pago não configurado.');
}
MercadoPagoConfig::setAccessToken($mercadoPagoToken);

// 2. Pega o CAMINHO para a sua chave do Firebase a partir das variáveis de ambiente
$firebaseCredentialsPath = getenv('FIREBASE_CREDENTIALS_PATH');
if (!$firebaseCredentialsPath) {
    http_response_code(500);
    // Adiciona um log para depuração
    error_log('Caminho das credenciais do Firebase não configurado nas variáveis de ambiente.');
    die('Caminho das credenciais do Firebase não configurado.');
}

try {
    // 3. Autentica no Firebase usando o seu ficheiro de chave JSON
    $firebase = (new Factory)->withServiceAccount($firebaseCredentialsPath);
    $db = $firebase->createFirestore()->database();
} catch (\Exception $e) {
    error_log("Erro na inicialização do Firebase: " . $e->getMessage());
    http_response_code(500);
    die("Erro de configuração do servidor.");
}

// -----------------------------------------------------
// Recebe e Processa a Notificação do Mercado Pago
// -----------------------------------------------------

// Pega os dados enviados pelo Mercado Pago
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Garante que é uma notificação de assinatura (preapproval)
if (isset($data['type']) && $data['type'] === 'preapproval' && isset($data['id'])) {
    
    try {
        $client = new PreApprovalClient();
        // Busca os dados completos da assinatura no Mercado Pago para garantir a veracidade
        $preapproval = $client->get($data['id']);

        // ✅ PASSO 1: PEGAR A 'EXTERNAL_REFERENCE'
        // Esta é a informação mais importante. Ela contém o ID da sua empresa no Firestore,
        // que foi enviado pelo seu site no momento da compra.
        $empresaId = $preapproval->external_reference;

        if (!$empresaId) {
            // Se, por algum motivo, a referência não veio, não podemos continuar.
            // Isso pode acontecer em testes antigos ou se o link for acessado sem a referência.
            throw new \Exception('external_reference (ID da empresa) não foi encontrada na notificação da assinatura.');
        }

        // Mapeia o status recebido do Mercado Pago para os status do seu sistema
        $statusMP = $preapproval->status;
        $novoStatus = match($statusMP) {
            'authorized' => 'ativo',
            'cancelled'  => 'cancelado',
            'paused'     => 'pausado',
            default      => 'desconhecido',
        };

        // ✅ PASSO 2: ACESSAR OS DOCUMENTOS DIRETAMENTE
        // Com o ID da empresa em mãos, não precisamos mais pesquisar. Vamos direto aos documentos.
        $empresaRef = $db->collection('empresarios')->document($empresaId);
        $empresaSnapshot = $empresaRef->snapshot();

        if (!$empresaSnapshot->exists()) {
            throw new \Exception("Empresa com ID '{$empresaId}' não encontrada no Firestore.");
        }

        $empresaData = $empresaSnapshot->data();
        $donoId = $empresaData['donoId'];

        if (!$donoId) {
             throw new \Exception("A empresa '{$empresaId}' não tem um donoId associado.");
        }

        $usuarioRef = $db->collection('usuarios')->document($donoId);

        // ✅ PASSO 3: ATUALIZAR O STATUS (O "DESBLOQUEIO" AUTOMÁTICO)
        // Define se o usuário deve ser considerado Premium
        $isPremiumValue = ($novoStatus === 'ativo');
        
        // Atualiza o documento do usuário
        $usuarioRef->update([
            ['path' => 'isPremium', 'value' => $isPremiumValue]
        ]);
        
        // Atualiza o documento da empresa
        $empresaRef->update([
            ['path' => 'statusAssinatura', 'value' => $novoStatus],
            // É uma boa prática guardar o ID da assinatura para futuras consultas
            ['path' => 'mercadoPagoAssinaturaId', 'value' => $preapproval->id]
        ]);
        
        // Log de sucesso para você poder acompanhar
        error_log("Webhook processado com sucesso! Empresa: {$empresaId}, Novo Status: {$novoStatus}");

    } catch (\Exception $e) {
        // Se algo der errado, registramos o erro para análise
        error_log("Erro ao processar webhook: " . $e->getMessage());
        http_response_code(500); // Informa ao MP que algo deu errado
        exit;
    }
}

// Responde "OK" para o Mercado Pago para confirmar que a notificação foi recebida com sucesso.
http_response_code(200);
echo "OK";

?>
