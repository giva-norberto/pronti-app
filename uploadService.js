// Arquivo: uploadService.js
// Responsabilidade: Fazer upload de qualquer arquivo para o Firebase Storage.

// Importa o serviço de Storage que já foi inicializado
import { storage } from "./firebase-config.js"; 
// Importa as funções necessárias do SDK do Storage
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * Faz o upload de um arquivo para um caminho específico no Firebase Storage.
 * Faz validação de tamanho (padrão 2MB) e tipo (imagem).
 * @param {File} file O objeto do arquivo (vindo de um <input type="file">).
 * @param {string} storagePath O caminho completo onde o arquivo será salvo (ex: 'logos/empresa_xyz/logo.png').
 * @param {string} [userId] (Opcional) ID do usuário para validação de segurança (se quiser usar).
 * @param {number} [maxSizeBytes=2097152] Tamanho máximo permitido (padrão 2MB).
 * @returns {Promise<string>} Uma Promise que, quando resolvida, retorna a URL de download pública do arquivo.
 */
export async function uploadFile(file, storagePath, userId, maxSizeBytes = 2 * 1024 * 1024) {
    if (!file || !storagePath) {
        throw new Error("Um arquivo e um caminho de destino são obrigatórios para o upload.");
    }

    // Valida tamanho máximo
    if (file.size > maxSizeBytes) {
        throw new Error(`Arquivo muito grande. Máximo permitido: ${maxSizeBytes / (1024*1024)} MB.`);
    }

    // Valida tipo da imagem
    if (!file.type.match('image/.*')) {
        throw new Error("Somente arquivos de imagem são permitidos.");
    }

    try {
        const storageRef = ref(storage, storagePath);

        console.log(`Iniciando upload para: ${storagePath}`);
        const uploadResult = await uploadBytes(storageRef, file);

        const downloadURL = await getDownloadURL(uploadResult.ref);
        console.log(`Upload concluído! URL: ${downloadURL}`);

        return downloadURL;

    } catch (error) {
        console.error("Erro no serviço de upload:", error);
        throw new Error("Falha ao fazer o upload do arquivo.");
    }
}
