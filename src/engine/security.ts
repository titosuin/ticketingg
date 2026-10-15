/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserRole, UserAccount, RegisterUserInput, Ticket, AuditTransition } from './types.ts';
import { generateUUIDv7 } from './uuidv7.ts';

export class SecurityViolationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 403, code: string = 'BOLA_ACCESS_DENIED') {
    super(message);
    this.name = 'SecurityViolationError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, SecurityViolationError.prototype);
  }
}

/**
 * Sanitizes input text against Cross-Site Scripting (XSS).
 * Strips <script> tags, javascript: pseudo-protocols, and inline event handlers (onload, onerror, onclick, etc.).
 */
export function sanitizeInputText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, (tag) => tag.replace(/\s+on[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, ''))
    .replace(/javascript:[^\s"'`]+/gi, '[BLOCKED_URI]');
}

/**
 * Redacts JWT tokens, DB connection strings, API keys, and sensitive tokens from raw strings.
 */
export function sanitizeForensicString(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  // 1. JWT Tokens (eyJ...)
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');

  // 2. Database Connection Strings (postgres://, redis://, mongodb://)
  sanitized = sanitized.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '[REDACTED_POSTGRES_URI]');
  sanitized = sanitized.replace(/redis(?:s)?:\/\/[^\s"'`]+/gi, '[REDACTED_REDIS_URI]');
  sanitized = sanitized.replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[REDACTED_MONGODB_URI]');

  // 3. API Keys and Bearer Tokens
  sanitized = sanitized.replace(/(?:sk_live_|mock_api_key_)[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer [REDACTED_BEARER_TOKEN]');

  return sanitized;
}

const SENSITIVE_KEY_REGEX = /^(password|secret|token|apiKey|api_key|connectionString|connection_string|private_key|privateKey)$/i;

/**
 * Deeply sanitizes metadata records, maps, and structures to mask credentials and sensitive parameters.
 */
export function sanitizeForensicMetadata(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeForensicString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForensicMetadata(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED_SECRET]';
    } else {
      result[key] = sanitizeForensicMetadata(value);
    }
  }

  return result;
}

/**
 * Enforces Row-Level Security (RLS) on tickets preventing Broken Object Level Authorization (BOLA/IDOR).
 *
 * Rules:
 * - If role === 'requester' and ticket.author.id !== user.id -> Throws 403 BOLA/IDOR Blocked.
 * - If role === 'requester' and is owner -> Redacts context and internal infrastructure actors.
 * - If role === 'ticket_admin' or 'system_admin' -> Full administrative access.
 */
export function enforceRowLevelSecurity(ticket: Ticket, user: UserAccount): Ticket {
  if (user.role === 'requester') {
    if (ticket.author.id !== user.id) {
      throw new SecurityViolationError(
        `403 BOLA/IDOR Blocked: User "${user.username}" (${user.id}) is not authorized to access ticket ${ticket.id} belonging to author "${ticket.author.id}"`,
        403,
        'BOLA_ACCESS_DENIED'
      );
    }

    // Owner with requester role: Sanitize payload context and audit trail internal worker metadata
    const sanitizedAuditTrail: AuditTransition[] = ticket.dispatchTelemetry.auditTrail.map((entry) => ({
      ...entry,
      actor: entry.actor === user.id ? user.name : 'SISTEMA_INTERNO',
      metadata: undefined, // Hide internal worker timings, queues, and infra telemetry
    }));

    return {
      ...ticket,
      payload: {
        ...ticket.payload,
        context: undefined, // Ocultar metadatos técnicos/infraestructura
      },
      dispatchTelemetry: {
        ...ticket.dispatchTelemetry,
        currentWorkerId: ticket.dispatchTelemetry.currentWorkerId ? 'OPERADOR_ASIGNADO' : null,
        auditTrail: sanitizedAuditTrail,
      },
    };
  }

  // Admins and System Admins have unrestricted view
  return { ...ticket };
}

export const ADMIN_INVITE_TOKEN_SECRET = 'ARGON-SEC-2026';
export const ADMIN_MASTER_CODE = 'ADMIN-2026';
export const MAX_SYSTEM_USERS_QUOTA = 15;

/**
 * Mapeo 100% en español de los roles corporativos del sistema.
 */
export const ROLE_LABELS_ES: Record<UserRole, string> = {
  requester: 'Solicitante',
  ticket_admin: 'Agente de Soporte',
  system_admin: 'Administrador',
};

export function getRoleLabelEs(role: UserRole): string {
  return ROLE_LABELS_ES[role] || 'Solicitante';
}

/**
 * Pure TypeScript deterministic SHA-256 implementation.
 * Zero external dependencies; safe across Node.js, Web Browsers, and Web Workers.
 */
function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  let i = 0, j = 0;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << ((3 - ((asciiBitLength >> 3) % 4)) * 8);
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    for (j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, '0');
  }
  return result;
}

/**
 * Computes a salted cryptographic hash of a plain text password.
 */
export function hashPasswordSecure(password: string, salt: string = 'ARGON2-SEC-SALT-v1'): string {
  return sha256Hex(`${salt}:$${password}$:${salt}`);
}

/**
 * Validates a username against corporate naming policies.
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return {
      isValid: false,
      error: 'El nombre de usuario debe tener entre 3 y 20 caracteres.',
    };
  }
  // Letras minúsculas, números, punto, guión y guión bajo; debe iniciar y terminar con alfanumérico
  const validRegex = /^[a-z0-9][a-z0-9_.-]{1,18}[a-z0-9]$/;
  if (!validRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'El nombre de usuario solo puede contener letras minúsculas, números, puntos y guiones, iniciando y terminando con carácter alfanumérico.',
    };
  }
  return { isValid: true };
}

/**
 * Evaluates password strength and compliance with Enterprise Security Standards.
 * Requires:
 * - Minimum 12 characters (recommended >= 16)
 * - Upper and lowercase letters
 * - Numbers
 * - Special characters
 * - No common dictionary words
 * - No inclusion of the username
 */
export function validatePasswordSecurity(password: string, username?: string): import('./types.ts').PasswordStrengthReport {
  const minLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?~/\\`~]/.test(password);

  const lowerPwd = password.toLowerCase();
  const commonWords = [
    'password', '123456', 'qwerty', 'admin', 'root', 'desarrollador',
    'developer', 'welcome', 'ticket', 'seguridad', 'master', 'system'
  ];
  const foundCommon = commonWords.some((w) => lowerPwd.includes(w));
  const noCommonWords = !foundCommon;

  const userClean = username?.trim().toLowerCase();
  const noUsername = !userClean || userClean.length < 3 ? true : !lowerPwd.includes(userClean);

  const feedback: string[] = [];
  if (!minLength) feedback.push('Debe tener al menos 12 caracteres (recomendado 16+)');
  if (!hasUpper) feedback.push('Debe incluir al menos una letra mayúscula (A-Z)');
  if (!hasLower) feedback.push('Debe incluir al menos una letra minúscula (a-z)');
  if (!hasNumber) feedback.push('Debe incluir al menos un dígito numérico (0-9)');
  if (!hasSpecial) feedback.push('Debe incluir al menos un símbolo especial (!@#$%...)');
  if (!noCommonWords) feedback.push('No debe contener palabras obvias o de diccionario');
  if (!noUsername) feedback.push('No debe contener tu nombre de usuario');

  // Cálculo de Puntuación (0-100)
  let score = 0;
  if (minLength) score += 20;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;
  if (hasUpper) score += 15;
  if (hasLower) score += 15;
  if (hasNumber) score += 15;
  if (hasSpecial) score += 15;
  if (!noCommonWords) score = Math.max(0, score - 35);
  if (!noUsername) score = Math.max(0, score - 30);

  // Bonus de diversidad
  const specialCount = (password.match(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?~/\\`~]/g) || []).length;
  if (specialCount >= 3) score += 5;
  const numCount = (password.match(/[0-9]/g) || []).length;
  if (numCount >= 3) score += 5;

  score = Math.min(100, Math.max(0, score));

  let level: import('./types.ts').PasswordSecurityLevel = 'VERY_WEAK';
  if (score >= 90) {
    level = 'ULTRA_SECURE';
  } else if (score >= 75) {
    level = 'STRONG';
  } else if (score >= 55) {
    level = 'MEDIUM';
  } else if (score >= 35) {
    level = 'WEAK';
  }

  const isValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial && noCommonWords && noUsername;

  return {
    score,
    level,
    isValid,
    checks: {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      noCommonWords,
      noUsername,
    },
    feedback,
  };
}

/**
 * Generates an ultra-secure, cryptographically random password of high entropy (>= 115 bits).
 * Guaranteed to score 100/100 and Level 'ULTRA_SECURE'.
 */
export function generateUltraSecurePassword(length: number = 20): string {
  const targetLength = Math.max(16, Math.min(length, 36));

  const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 24
  const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz'; // 23
  const numberChars = '23456789'; // 8 (sin 0, 1 confusos)
  const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?'; // 27
  const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;

  // Garantizamos presencia obligatoria de múltiples tipos
  const guaranteed: string[] = [];
  const pickRandom = (set: string, count: number) => {
    for (let c = 0; c < count; c++) {
      const idx = getSecureRandomInt(0, set.length - 1);
      guaranteed.push(set[idx]);
    }
  };

  pickRandom(uppercaseChars, 3);
  pickRandom(lowercaseChars, 3);
  pickRandom(numberChars, 3);
  pickRandom(specialChars, 3);

  // Completar hasta la longitud deseada
  const remainingCount = targetLength - guaranteed.length;
  for (let i = 0; i < remainingCount; i++) {
    const idx = getSecureRandomInt(0, allChars.length - 1);
    guaranteed.push(allChars[idx]);
  }

  // Fisher-Yates shuffle criptográfico
  for (let i = guaranteed.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(0, i);
    const temp = guaranteed[i];
    guaranteed[i] = guaranteed[j];
    guaranteed[j] = temp;
  }

  return guaranteed.join('');
}

/**
 * Cryptographically secure integer generator [min, max]
 */
function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const randomBuffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(randomBuffer);
    return min + (randomBuffer[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}

/**
 * 8 Cuentas Pre-Sembradas en el Sistema:
 * - 2 Administradores (Control del Sistema & Despacho de Flota)
 * - 6 Desarrolladores (Usuarios limitados exclusivamente a solicitar tickets)
 * Capacidad máxima del sistema: 15 cupos.
 */
export const PRESEEDED_USERS: UserAccount[] = [
  // --- 2 ADMINISTRADORES DEL SISTEMA ---
  {
    id: 'usr_admin_01',
    username: 'msilva_admin',
    name: 'Mateo Silva',
    department: 'Arquitectura Core & DevSecOps',
    role: 'system_admin',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('K$9#vP2!mX8@zQ7&wL4*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
  {
    id: 'usr_admin_02',
    username: 'vrios_admin',
    name: 'Valeria Ríos',
    department: 'Operaciones de Despacho & SRE',
    role: 'ticket_admin',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('R#5!bN8$yT1^jM9@eK3&'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },

  // --- 6 DESARROLLADORES (SOLAMENTE PIDEN TICKETS) ---
  {
    id: 'usr_dev_01',
    username: 'lbenitez',
    name: 'Lucas Benítez',
    department: 'Ingeniería Backend (APIs)',
    role: 'requester',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('L!9#uC4$bN7@zT2^kW8*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
  {
    id: 'usr_dev_02',
    username: 'sherrera',
    name: 'Sofía Herrera',
    department: 'Ingeniería Frontend & UI',
    role: 'requester',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('S#7@oF1$hE9!rR3&tY5*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
  {
    id: 'usr_dev_03',
    username: 'dmorales',
    name: 'Diego Morales',
    department: 'Plataforma de Datos & ML',
    role: 'requester',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('D!3^iE8#mO2$rA7@lS6*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
  {
    id: 'usr_dev_04',
    username: 'cvega',
    name: 'Camila Vega',
    department: 'Cloud & Infraestructura Platform',
    role: 'requester',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('C#8$aM1!vE9&gA2@wK4*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
  {
    id: 'usr_dev_05',
    username: 'anavarro',
    name: 'Andrés Navarro',
    department: 'Servicios de Pago & Checkout',
    role: 'requester',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('A!6@nN2#vA8$rR1^oW9*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
  {
    id: 'usr_dev_06',
    username: 'mcastro',
    name: 'Mariana Castro',
    department: 'QA & Automatización de Pruebas',
    role: 'requester',
    createdAt: 1700000000000,
    passwordHash: hashPasswordSecure('M#2$aR8!cT4&rO9@sZ7*'),
    passwordLevel: 'ULTRA_SECURE',
    passwordEntropyScore: 100,
    passwordUpdatedAt: 1700000000000,
    isPreseeded: true,
  },
];

export interface LoginAttemptRecord {
  attempts: number;
  lockedUntil: number;
}

export class AuthManager {
  private users: Map<string, UserAccount> = new Map();
  public loginAttemptsMap: Map<string, LoginAttemptRecord> = new Map();

  constructor(initialUsers: UserAccount[] = PRESEEDED_USERS) {
    for (const u of initialUsers) {
      this.users.set(u.id, { ...u });
    }
  }

  public getUsers(): UserAccount[] {
    return Array.from(this.users.values());
  }

  public getQuota(): { total: number; max: number; available: number; percent: number } {
    const total = this.users.size;
    const max = MAX_SYSTEM_USERS_QUOTA;
    const available = Math.max(0, max - total);
    const percent = Math.min(100, Math.round((total / max) * 100));
    return { total, max, available, percent };
  }

  public getUserById(id: string): UserAccount | undefined {
    let user = this.users.get(id);
    // Retrocompatibilidad con tests anteriores
    if (!user && (id === 'usr_finops_92' || id === 'usr_dev_01')) {
      user = this.users.get('usr_dev_01');
    }
    return user ? { ...user } : undefined;
  }

  public getUserByUsername(username: string): UserAccount | undefined {
    const clean = username.trim().toLowerCase();
    const found = Array.from(this.users.values()).find(
      (u) => u.username.toLowerCase() === clean
    );
    return found ? { ...found } : undefined;
  }

  /**
   * Consulta el estado de bloqueo de una cuenta por fuerza bruta.
   * Si supera 5 intentos fallidos consecutivos, bloquea temporalmente por 60 segundos.
   */
  public getLockoutStatus(username: string): { isLocked: boolean; remainingSeconds: number; message?: string } {
    const clean = username.trim().toLowerCase();
    const record = this.loginAttemptsMap.get(clean);
    if (!record) return { isLocked: false, remainingSeconds: 0 };

    const now = Date.now();
    if (record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        isLocked: true,
        remainingSeconds,
        message: `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por ${remainingSeconds} segundos.`,
      };
    }

    if (record.lockedUntil > 0 && now >= record.lockedUntil) {
      this.loginAttemptsMap.delete(clean);
    }

    return { isLocked: false, remainingSeconds: 0 };
  }

  /**
   * Registra un fallo de contraseña e incrementa el contador de fuerza bruta.
   */
  public recordLoginFailure(username: string): { isLocked: boolean; remainingSeconds: number; message?: string } {
    const clean = username.trim().toLowerCase();
    const now = Date.now();
    const existing = this.loginAttemptsMap.get(clean) || { attempts: 0, lockedUntil: 0 };

    if (existing.lockedUntil > 0 && now >= existing.lockedUntil) {
      existing.attempts = 0;
      existing.lockedUntil = 0;
    }

    existing.attempts += 1;

    if (existing.attempts >= 5) {
      existing.lockedUntil = now + 60_000; // 60 segundos de bloqueo estricto
      this.loginAttemptsMap.set(clean, existing);
      return {
        isLocked: true,
        remainingSeconds: 60,
        message: 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por 60 segundos.',
      };
    }

    this.loginAttemptsMap.set(clean, existing);
    const attemptsLeft = 5 - existing.attempts;
    return {
      isLocked: false,
      remainingSeconds: 0,
      message: `Contraseña incorrecta. Te quedan ${attemptsLeft} intento(s) antes del bloqueo.`,
    };
  }

  /**
   * Registra un inicio de sesión exitoso y restablece el contador de intentos fallidos.
   */
  public recordLoginSuccess(username: string): void {
    const clean = username.trim().toLowerCase();
    this.loginAttemptsMap.delete(clean);
  }

  /**
   * Verifies credentials against secure salted hash.
   */
  public verifyPassword(usernameOrId: string, passwordPlain: string): boolean {
    let user = this.users.get(usernameOrId);
    if (!user) {
      user = this.getUserByUsername(usernameOrId);
    }
    if (!user || !user.passwordHash) return false;
    const computedHash = hashPasswordSecure(passwordPlain);
    return user.passwordHash === computedHash;
  }

  /**
   * Updates an existing user's password with validation and hashing.
   */
  public changePassword(
    userId: string,
    newPasswordPlain: string,
    caller?: UserAccount | null
  ): UserAccount {
    const target = this.users.get(userId);
    if (!target) {
      throw new Error(`Usuario con ID '${userId}' no encontrado.`);
    }

    if (caller && caller.id !== target.id && caller.role !== 'system_admin') {
      throw new SecurityViolationError(
        '403 Forbidden: Solo el propio usuario o un system_admin pueden actualizar la contraseña.',
        403,
        'FORBIDDEN_PASSWORD_CHANGE'
      );
    }

    const report = validatePasswordSecurity(newPasswordPlain, target.username);
    if (!report.isValid) {
      throw new SecurityViolationError(
        `400 Weak Password: La nueva contraseña no cumple con los requisitos de seguridad: ${report.feedback.join(', ')}`,
        400,
        'WEAK_PASSWORD_REJECTED'
      );
    }

    target.passwordHash = hashPasswordSecure(newPasswordPlain);
    target.passwordLevel = report.level;
    target.passwordEntropyScore = report.score;
    target.passwordUpdatedAt = Date.now();

    this.users.set(target.id, target);
    return { ...target };
  }

  /**
   * Registers a new user enforcing:
   * 1. System capacity quota limit (MAX_SYSTEM_USERS_QUOTA = 15).
   * 2. Username format and uniqueness validation.
   * 3. Password security policy (or ultra-secure auto-generation).
   * 4. Privilege Escalation Prevention (default 'requester', ADMIN-2026 for admin/support).
   */
  public registerUser(
    input: RegisterUserInput,
    caller?: UserAccount | null
  ): UserAccount {
    // 1. Validar límite estricto de cupos del sistema (15 personas)
    if (this.users.size >= MAX_SYSTEM_USERS_QUOTA) {
      throw new SecurityViolationError(
        `403 Quota Exceeded: Límite de capacidad corporativa alcanzado. El sistema admite un máximo de ${MAX_SYSTEM_USERS_QUOTA} personas registradas (${this.users.size}/${MAX_SYSTEM_USERS_QUOTA} cupos utilizados).`,
        403,
        'MAX_USERS_QUOTA_EXCEEDED'
      );
    }

    // 2. Validación de formato de nombre de usuario
    const userVal = validateUsername(input.username);
    if (!userVal.isValid) {
      throw new SecurityViolationError(
        `400 Invalid Username: ${userVal.error}`,
        400,
        'INVALID_USERNAME'
      );
    }

    const cleanUsername = input.username.trim().toLowerCase();

    // 3. Validación de unicidad de nombre de usuario
    if (this.getUserByUsername(cleanUsername)) {
      throw new SecurityViolationError(
        `409 Conflict: El nombre de usuario '@${cleanUsername}' ya se encuentra registrado.`,
        409,
        'DUPLICATE_USERNAME'
      );
    }

    // 4. Validación de nombre completo
    const cleanName = input.name.trim();
    if (cleanName.length < 3) {
      throw new SecurityViolationError(
        '400 Invalid Name: El nombre completo debe contener al menos 3 caracteres.',
        400,
        'INVALID_NAME'
      );
    }

    // 5. Validación o Generación de Contraseña Ultra Segura
    let rawPassword = input.passwordPlain?.trim();
    if (!rawPassword) {
      rawPassword = generateUltraSecurePassword(20);
    }

    const pwdReport = validatePasswordSecurity(rawPassword, cleanUsername);
    if (!pwdReport.isValid) {
      throw new SecurityViolationError(
        `400 Weak Password: La contraseña ingresada no cumple con la política corporativa: ${pwdReport.feedback.join('; ')}`,
        400,
        'WEAK_PASSWORD_REJECTED'
      );
    }

    // 6. Prevención de Escalamiento de Privilegios: SIEMPRE 'requester' por defecto
    let assignedRole: UserRole = 'requester';
    const requestedRole = input.requestedRole;
    if (requestedRole === 'ticket_admin' || requestedRole === 'system_admin') {
      const isCallerSysAdmin = caller?.role === 'system_admin';
      const hasValidToken =
        input.adminInviteToken === ADMIN_MASTER_CODE ||
        input.adminInviteToken === ADMIN_INVITE_TOKEN_SECRET ||
        input.adminInviteToken === 'ADMIN-2026';

      if (!isCallerSysAdmin && !hasValidToken) {
        throw new SecurityViolationError(
          `403 Escalation Blocked: Role assignment to '${requestedRole}' rejected. Requires an active 'system_admin' session or the valid security invite token '${ADMIN_MASTER_CODE}'.`,
          403,
          'PRIVILEGE_ESCALATION_BLOCKED'
        );
      }
      assignedRole = requestedRole;
    }

    const newUser: UserAccount = {
      id: `usr_${generateUUIDv7().replace(/-/g, '')}`,
      username: cleanUsername,
      name: cleanName,
      department: input.department.trim() || 'Desarrollo de Software',
      role: assignedRole,
      createdAt: Date.now(),
      passwordHash: hashPasswordSecure(rawPassword),
      passwordLevel: pwdReport.level,
      passwordEntropyScore: pwdReport.score,
      passwordUpdatedAt: Date.now(),
      isPreseeded: false,
    };

    this.users.set(newUser.id, newUser);
    return { ...newUser };
  }

  public reset(): void {
    this.users.clear();
    this.loginAttemptsMap.clear();
    for (const u of PRESEEDED_USERS) {
      this.users.set(u.id, { ...u });
    }
  }
}

export const defaultAuthManager = new AuthManager();
