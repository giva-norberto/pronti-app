// Arquivo: uploadService.js
// Responsabilidade: Fazer upload de qualquer arquivo para o Firebase Storage.

// Importa o serviço de Storage que já foi inicializado
import { storage } from "./firebase-config.js"; 
// Importa as funções necessárias do SDK do Storage
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * Faz o upload de um arquivo para um caminho específico no Firebase Storage.
 * @param {File} file O objeto do arquivo (vindo de um <input type="file">).
 * @param {string} storagePath O caminho completo onde o arquivo será salvo (ex: 'logos/empresa_xyz/logo.png').
 * @returns {Promise<string>} Uma Promise que, quando resolvida, retorna a URL de download pública do arquivo.
 */
export async function uploadFile(file, storagePath) {
    // Validação para garantir que recebemos os parâmetros necessários
    if (!file || !storagePath) {
        throw new Error("Um arquivo e um caminho de destino são obrigatórios para o upload.");
    }

    try {
        // 1. Cria uma referência para o local no Storage
        const storageRef = ref(storage, storagePath);

        // 2. Faz o upload do arquivo para essa referência
        console.log(`Iniciando upload para: ${storagePath}`);
        const uploadResult = await uploadBytes(storageRef, file);
        
        // 3. Pega a URL pública de download do arquivo que acabamos de subir
        const downloadURL = await getDownloadURL(uploadResult.ref);
        console.log(`Upload concluído! URL: ${downloadURL}`);

        // 4. Retorna a URL para quem chamou a função
        return downloadURL;

    } catch (error) {
        // Se der algum erro (ex: falta de permissão), ele será capturado aqui.
        console.error("Erro no serviço de upload:", error);
        // Lança o erro novamente para que o código principal saiba que falhou.
        throw new Error("Falha ao fazer o upload do arquivo.");
    }
}
