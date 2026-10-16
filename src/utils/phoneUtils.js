/**
 * phoneUtils.js — Utilitários de Formatação e Validação de Telefone e Dados Pessoais
 * Totalmente otimizado para mobile PWA com formatação em tempo real.
 */

/**
 * Formata telefone brasileiro progressivamente enquanto o usuário digita
 * Ex: (11) 98765-4321 ou (11) 8765-4321
 */
export function formatPhoneInput(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // 11 dígitos (celular padrão com nono dígito)
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Converte qualquer formato nacional para E.164 exigido pelo Firebase Auth (ex: +5511987654321)
 */
export function toE164(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

/**
 * Formata número armazenado no Firebase Auth (+5511987654321) para exibição amigável: (11) 98765-4321
 */
export function formatDisplayPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return formatPhoneInput(digits);
}

/**
 * Validação rigorosa de telefone celular / fixo brasileiro com DDD
 */
export function validatePhone(phone) {
  if (!phone) {
    return { isValid: false, error: 'Número de telefone é obrigatório.' };
  }
  const digits = String(phone).replace(/\D/g, '');

  if (digits.length < 10) {
    return { isValid: false, error: 'Telefone incompleto. Digite o DDD + número (mínimo 10 dígitos).' };
  }
  if (digits.length > 11) {
    return { isValid: false, error: 'Telefone com dígitos em excesso.' };
  }

  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return { isValid: false, error: 'DDD inválido. Digite um DDD brasileiro válido (ex: 11 a 99).' };
  }

  // Se tiver 11 dígitos (celular), o primeiro dígito do número deve ser 9
  if (digits.length === 11 && digits.charAt(2) !== '9') {
    return { isValid: false, error: 'Celular inválido. O número com 9 dígitos deve começar com 9.' };
  }

  return { isValid: true, error: null };
}

/**
 * Validação de nome completo (pelo menos nome e sobrenome)
 */
export function validateFullName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Nome completo é obrigatório.' };
  }
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return { isValid: false, error: 'Informe seu nome e sobrenome.' };
  }
  if (trimmed.length < 5) {
    return { isValid: false, error: 'O nome deve conter ao menos 5 caracteres.' };
  }
  // Bloqueia dígitos numéricos no nome
  if (/\d/.test(trimmed)) {
    return { isValid: false, error: 'O nome não deve conter números.' };
  }

  return { isValid: true, error: null };
}

/**
 * Validação de e-mail RFC simplificado
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'E-mail é obrigatório.' };
  }
  const trimmed = email.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(trimmed)) {
    return { isValid: false, error: 'Informe um e-mail válido (ex: nome@dominio.com).' };
  }
  return { isValid: true, error: null };
}

/**
 * Calcula a força da senha e valida requisitos
 */
export function evaluatePassword(password) {
  if (!password) {
    return { isValid: false, score: 0, label: 'Vazia', error: 'A senha é obrigatória.' };
  }
  if (password.length < 6) {
    return { isValid: false, score: 1, label: 'Muito fraca', error: 'A senha deve ter no mínimo 6 caracteres.' };
  }

  let score = 1;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);

  if (password.length >= 8) score++;
  if (hasLetter && hasNumber) score++;
  if (hasSpecial || hasUpper) score++;

  let label = 'Fraca';
  if (score === 3) label = 'Média';
  if (score >= 4) label = 'Forte';

  return {
    isValid: true,
    score,
    label,
    error: null,
  };
}
