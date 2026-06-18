import imageCompression from "browser-image-compression";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_IMAGE_BYTES_BEFORE_COMPRESSION = 30 * 1024 * 1024; // 30 MB (sanity guard)

const IMAGE_COMPRESSION_OPTS = {
  maxSizeMB: 1, // alvo ~1 MB
  maxWidthOrHeight: 2000, // mantém detalhe suficiente p/ evidência
  useWebWorker: true,
  initialQuality: 0.85,
  fileType: "image/jpeg" as const,
};

export class MediaTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaTooLargeError";
  }
}

function isVideo(file: File): boolean {
  return file.type.startsWith("video/");
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

/**
 * Processa um arquivo antes do upload:
 * - Imagens: comprime silenciosamente para ~1MB (JPEG, max 2000px).
 * - Vídeos: valida tamanho máximo (100MB). Sem compressão (custo proibitivo em mobile).
 * - Outros tipos: passa direto.
 *
 * Lança MediaTooLargeError com mensagem amigável quando exceder o limite.
 */
export async function processMediaFile(file: File): Promise<File> {
  if (isVideo(file)) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new MediaTooLargeError(
        `Vídeo "${file.name}" tem ${formatMB(file.size)}. Máximo permitido: ${formatMB(MAX_VIDEO_BYTES)}. ` +
        `Grave clipes mais curtos (1-2 min) ou reduza a qualidade na câmera.`
      );
    }
    return file;
  }

  if (isImage(file)) {
    // Guard: arquivo absurdamente grande (HEIC bruto, etc.) — rejeita antes de tentar comprimir
    if (file.size > MAX_IMAGE_BYTES_BEFORE_COMPRESSION) {
      throw new MediaTooLargeError(
        `Imagem "${file.name}" tem ${formatMB(file.size)}. Use uma foto menor que ${formatMB(MAX_IMAGE_BYTES_BEFORE_COMPRESSION)}.`
      );
    }
    // Já é pequena? Não recomprime para evitar perda desnecessária.
    if (file.size <= 500 * 1024) {
      return file;
    }
    try {
      const compressed = await imageCompression(file, IMAGE_COMPRESSION_OPTS);
      // browser-image-compression retorna Blob em alguns casos — garantir File
      if (compressed instanceof File) return compressed;
      return new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } catch (err) {
      // Se a compressão falhar, faz upload do original (não bloqueia o usuário)
      console.warn("[mediaProcessing] Falha ao comprimir imagem, enviando original:", err);
      return file;
    }
  }

  return file;
}

/** Processa em lote, agregando erros para mostrar de uma vez. */
export async function processMediaFiles(
  files: File[]
): Promise<{ processed: File[]; errors: string[] }> {
  const processed: File[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      processed.push(await processMediaFile(f));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { processed, errors };
}
