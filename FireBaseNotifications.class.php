<?php
class FireBaseNotifications {
    private $serverApiKey = "SUA_SERVER_KEY_DO_FIREBASE"; // pega em Configurações do projeto -> Cloud Messaging
    private $firebaseUrl = "https://fcm.googleapis.com/fcm/send";

    /**
     * Envia notificação para tokens específicos
     * @param array $tokens Array de tokens FCM
     * @param string $titulo Título da notificação
     * @param string $mensagem Corpo da notificação
     * @param string|null $icone URL do ícone
     * @param string|null $imagem URL da imagem
     */
    public function sendToTokens(array $tokens, string $titulo, string $mensagem, string $icone = null, string $imagem = null) {
        if(empty($tokens)) return false;

        $msg = [
            'title' => $titulo,
            'body'  => $mensagem,
            'icon'  => $icone,
            'image' => $imagem
        ];

        $payload = [
            'registration_ids' => $tokens,
            'data' => $msg,
            'priority' => 'high'
        ];

        return $this->executeCurl($payload);
    }

    /**
     * Envia notificação para um tópico
     * @param string $topic Nome do tópico (ex: "clientes")
     * @param string $titulo
     * @param string $mensagem
     * @param string|null $icone
     * @param string|null $imagem
     */
    public function sendToTopic(string $topic, string $titulo, string $mensagem, string $icone = null, string $imagem = null) {
        $msg = [
            'title' => $titulo,
            'body'  => $mensagem,
            'icon'  => $icone,
            'image' => $imagem
        ];

        $payload = [
            'to' => "/topics/{$topic}",
            'data' => $msg,
            'priority' => 'high'
        ];

        return $this->executeCurl($payload);
    }

    // Executa requisição CURL para FCM
    private function executeCurl(array $payload) {
        $headers = [
            'Authorization: key=' . $this->serverApiKey,
            'Content-Type: application/json'
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->firebaseUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

        $result = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if($error) return ['success' => false, 'error' => $error];
        return ['success' => true, 'response' => json_decode($result, true)];
    }
}
