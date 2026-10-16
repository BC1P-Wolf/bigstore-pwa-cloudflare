/**
 * 🛡️ Utilitário de Proteção Anti-Flood e Segurança para Chats
 *
 * Previne envio excessivo de mensagens, rajadas (burst), duplicatas e
 * valida rigorosamente o upload de arquivos e imagens para economizar
 * Realtime Database e Cloud Storage.
 */

const MESSAGE_COOLDOWN_MS = 1500;       // 1.5s entre mensagens
const BURST_WINDOW_MS = 10000;          // Janela de 10 segundos
const MAX_MESSAGES_IN_BURST = 4;        // Máx 4 mensagens por janela
const BURST_PENALTY_MS = 6000;          // Penalidade de 6s se estourar rajada
const DUPLICATE_WINDOW_MS = 15000;      // 15s para barrar mensagens idênticas
const IMAGE_COOLDOWN_MS = 4000;         // 4s entre envios de imagem
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB pré-compressão

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export class AntiFloodTracker {
  constructor() {
    this.lastMessageTime = 0;
    this.lastImageTime = 0;
    this.lastMessageText = '';
    this.recentTimestamps = [];
    this.lockedUntil = 0;
  }

  /**
   * Valida se uma mensagem de texto pode ser enviada.
   * Retorna { allowed: true } ou { allowed: false, reason: string, waitSeconds?: number }
   */
  canSendMessage(text) {
    const now = Date.now();
    const cleanText = String(text || '').trim();

    // 1. Verifica se está em penalidade por rajada
    if (now < this.lockedUntil) {
      const waitSec = Math.ceil((this.lockedUntil - now) / 1000);
      return {
        allowed: false,
        reason: `Muitas mensagens enviadas rapidamente. Aguarde ${waitSec}s para continuar.`,
        waitSeconds: waitSec,
      };
    }

    // 2. Cooldown entre mensagens individuais
    const elapsedSinceLast = now - this.lastMessageTime;
    if (elapsedSinceLast < MESSAGE_COOLDOWN_MS) {
      const waitSec = Math.ceil((MESSAGE_COOLDOWN_MS - elapsedSinceLast) / 1000);
      return {
        allowed: false,
        reason: `Aguarde ${waitSec}s antes de enviar outra mensagem.`,
        waitSeconds: waitSec,
      };
    }

    // 3. Detecção de mensagens idênticas consecutivas
    if (
      cleanText &&
      this.lastMessageText &&
      cleanText.toLowerCase() === this.lastMessageText.toLowerCase() &&
      now - this.lastMessageTime < DUPLICATE_WINDOW_MS
    ) {
      return {
        allowed: false,
        reason: 'Você acabou de enviar esta mesma mensagem.',
      };
    }

    // 4. Limpeza da janela de rajada
    this.recentTimestamps = this.recentTimestamps.filter(
      (ts) => now - ts < BURST_WINDOW_MS
    );

    // 5. Verifica estouro de rajada
    if (this.recentTimestamps.length >= MAX_MESSAGES_IN_BURST) {
      this.lockedUntil = now + BURST_PENALTY_MS;
      const waitSec = Math.ceil(BURST_PENALTY_MS / 1000);
      return {
        allowed: false,
        reason: `Proteção anti-flood ativada. Por favor, aguarde ${waitSec}s.`,
        waitSeconds: waitSec,
      };
    }

    return { allowed: true };
  }

  /**
   * Registra que uma mensagem foi enviada com sucesso.
   */
  recordMessageSent(text) {
    const now = Date.now();
    this.lastMessageTime = now;
    this.lastMessageText = String(text || '').trim();
    this.recentTimestamps.push(now);
  }

  /**
   * Valida se um arquivo de imagem pode ser enviado e se está dentro dos padrões de segurança.
   */
  validateImageFile(file) {
    if (!file) {
      return { valid: false, reason: 'Nenhum arquivo selecionado.' };
    }

    const now = Date.now();
    const elapsedSinceLastImage = now - this.lastImageTime;
    if (elapsedSinceLastImage < IMAGE_COOLDOWN_MS) {
      const waitSec = Math.ceil((IMAGE_COOLDOWN_MS - elapsedSinceLastImage) / 1000);
      return {
        valid: false,
        reason: `Aguarde ${waitSec}s antes de enviar outra foto.`,
      };
    }

    const mime = (file.type || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mime) && !mime.startsWith('image/')) {
      return {
        valid: false,
        reason: 'Formato de imagem inválido. Use JPG, PNG ou WebP.',
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        reason: 'A imagem deve ter no máximo 5 MB.',
      };
    }

    return { valid: true };
  }

  /**
   * Registra envio de imagem com sucesso.
   */
  recordImageSent() {
    this.lastImageTime = Date.now();
  }
}
