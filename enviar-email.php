<?php
// enviar-email.php
// Recomendado: instalar PHPMailer via composer: composer require phpmailer/phpmailer
// Configurar variáveis de ambiente no servidor: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME, API_SECRET

header('Content-Type: application/json');

// --- Autenticação simples por header (substitua por verificação de sessão/JWT) ---
$apiSecretHeader = $_SERVER['HTTP_X_API_SECRET'] ?? '';
$expectedSecret = getenv('API_SECRET') ?: ''; // configure no ambiente
if (!$expectedSecret || $apiSecretHeader !== $expectedSecret) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'msg' => 'Unauthorized']);
    exit;
}

// Limpeza básica e validação
$to = $_POST['to'] ?? '';
$subject = $_POST['subject'] ?? '';
$message = $_POST['message'] ?? '';

if (empty($to) || empty($subject) || empty($message)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'msg' => 'Campos insuficientes']);
    exit;
}

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'msg' => 'E-mail inválido']);
    exit;
}

// Evita header injection (segurança pequena)
if (preg_match('/[\r\n]/', $subject) || preg_match('/[\r\n]/', $to)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'msg' => 'Campos inválidos']);
    exit;
}

require 'vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$smtpHost = getenv('SMTP_HOST');
$smtpPort = getenv('SMTP_PORT') ?: 587;
$smtpUser = getenv('SMTP_USER');
$smtpPass = getenv('SMTP_PASS');
$mailFrom = getenv('MAIL_FROM') ?: 'no-reply@seusite.com';
$mailFromName = getenv('MAIL_FROM_NAME') ?: 'Agendamentos';

try {
    $mail = new PHPMailer(true);
    // $mail->SMTPDebug = 2; // debug verbose
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = (int)$smtpPort;

    $mail->setFrom($mailFrom, $mailFromName);
    $mail->addAddress($to);

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $message;

    if (!$mail->send()) {
        // registra ou retorna erro
        http_response_code(500);
        echo json_encode(['status' => 'error', 'msg' => 'Erro ao enviar e-mail']);
        exit;
    }

    echo json_encode(['status' => 'ok']);
    exit;
} catch (Exception $e) {
    error_log('Mailer Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'msg' => 'Erro interno no envio']);
    exit;
}
