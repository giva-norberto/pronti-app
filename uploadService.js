// Arquivo: uploadService.js
// Responsabilidade: Fazer upload de arquivos (com foco em logos) para o Firebase Storage.

import { storage } from "./firebase-config.js"; 
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * Faz o upload de um arquivo para o Firebase Storage.
 * @param {File} file O arquivo a ser enviado (ex: input type="file").
 * @param {string} storagePath Caminho completo para salvar o arquivo (ex: 'logos/userId/nome.png').
 * @param {string} userId ID do usuário dono do arquivo, para validar a pasta.
 * @param {number} maxSizeBytes Limite máximo de tamanho do arquivo em bytes (padrão 2MB).
 * @returns {Promise<string>} URL pública do arquivo enviado.
 */
export async function uploadLogoFile(file, storagePath, userId, maxSizeBytes = 2 * 1024 * 1024) {
  if (!file) throw new Error("Arquivo não fornecido para upload.");
  if (!storagePath) throw new Error("Caminho de upload não fornecido.");
  if (!userId) throw new Error("UserId é obrigatório para validar o upload.");

  if (!storagePath.includes(userId)) {
    throw new Error("O caminho de upload não contém o userId correto.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo não é uma imagem válida.");
  }

  if (file.size > maxSizeBytes) {
    throw new Error(`Arquivo muito grande! Máximo permitido: ${(maxSizeBytes / 1024 / 1024).toFixed(2)} MB.`);
  }

  try {
    console.log(`Iniciando upload para: ${storagePath} (Arquivo: ${file.name}, tamanho: ${(file.size / 1024).toFixed(2)} KB)`);

    const storageRef = ref(storage, storagePath);
    const uploadResult = await uploadBytes(storageRef, file);

    const downloadURL = await getDownloadURL(uploadResult.ref);
    console.log(`Upload concluído! URL: ${downloadURL}`);

    return downloadURL;

  } catch (error) {
    console.error("Erro no upload do logo:", error);
    throw new Error("Falha ao fazer o upload do logo. Veja o console para mais detalhes.");
  }
}
