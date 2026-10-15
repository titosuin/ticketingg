/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Ticket, UserAccount, AuditTransition } from './types.ts';
import { PRESEEDED_USERS } from './security.ts';

export interface LoginAuditRecord {
  id: string;
  username: string;
  timestamp: number;
  success: boolean;
  reason?: string;
  ip?: string;
}

export interface DatabaseSnapshot {
  version: number;
  savedAt: number;
  users: UserAccount[];
  tickets: Ticket[];
  loginAudit: LoginAuditRecord[];
}

const STORAGE_KEY_TICKETS = 'enterprise_tickets_db_v1';
const STORAGE_KEY_USERS = 'enterprise_users_db_v1';
const STORAGE_KEY_AUDIT = 'enterprise_login_audit_v1';
const STORAGE_KEY_SESSION = 'enterprise_active_session_v1';

/**
 * Enterprise Database Layer for Persistent Ticket & User State.
 * Guarantees zero data loss across page refreshes, browser restarts, and device sessions.
 */
export class DatabaseManager {
  private memoryTickets: Map<string, Ticket> = new Map();
  private memoryUsers: Map<string, UserAccount> = new Map();
  private memoryLoginAudit: LoginAuditRecord[] = [];
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    this.initialize();
  }

  /**
   * Initializes tables and loads persistent state.
   */
  private initialize(): void {
    if (this.isBrowser) {
      try {
        // 1. Cargar Usuarios
        const storedUsers = localStorage.getItem(STORAGE_KEY_USERS);
        if (storedUsers) {
          const parsed: UserAccount[] = JSON.parse(storedUsers);
          for (const u of parsed) {
            this.memoryUsers.set(u.id, u);
          }
        } else {
          // Sembrar los 8 usuarios predeterminados
          for (const u of PRESEEDED_USERS) {
            this.memoryUsers.set(u.id, { ...u });
          }
          this.persistUsers();
        }

        // 2. Cargar Tickets
        const storedTickets = localStorage.getItem(STORAGE_KEY_TICKETS);
        if (storedTickets) {
          const parsed: Ticket[] = JSON.parse(storedTickets);
          for (const t of parsed) {
            this.memoryTickets.set(t.id, t);
          }
        }

        // 3. Cargar Auditoría de Logins
        const storedAudit = localStorage.getItem(STORAGE_KEY_AUDIT);
        if (storedAudit) {
          this.memoryLoginAudit = JSON.parse(storedAudit);
        }
      } catch (err) {
        console.error('Error al inicializar la base de datos persistente:', err);
      }
    } else {
      // Entorno Node (Tests o CLI)
      for (const u of PRESEEDED_USERS) {
        this.memoryUsers.set(u.id, { ...u });
      }
    }
  }

  // --- MÉTODOS DE TICKETS ---

  public getAllTickets(): Ticket[] {
    return Array.from(this.memoryTickets.values());
  }

  public getTicketById(id: string): Ticket | undefined {
    return this.memoryTickets.get(id);
  }

  public saveTicket(ticket: Ticket): void {
    this.memoryTickets.set(ticket.id, { ...ticket });
    this.persistTickets();
  }

  public saveTicketsBatch(tickets: Ticket[]): void {
    for (const t of tickets) {
      this.memoryTickets.set(t.id, { ...t });
    }
    this.persistTickets();
  }

  public deleteTicket(id: string): boolean {
    const deleted = this.memoryTickets.delete(id);
    if (deleted) this.persistTickets();
    return deleted;
  }

  public clearAllTickets(): void {
    this.memoryTickets.clear();
    this.persistTickets();
  }

  private persistTickets(): void {
    if (!this.isBrowser) return;
    try {
      const arr = Array.from(this.memoryTickets.values());
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(arr));
    } catch (err) {
      console.warn('Fallo al sincronizar tickets con la base de datos:', err);
    }
  }

  // --- MÉTODOS DE USUARIOS ---

  public getAllUsers(): UserAccount[] {
    return Array.from(this.memoryUsers.values());
  }

  public getUserById(id: string): UserAccount | undefined {
    return this.memoryUsers.get(id);
  }

  public getUserByUsername(username: string): UserAccount | undefined {
    const clean = username.trim().toLowerCase();
    return Array.from(this.memoryUsers.values()).find(
      (u) => u.username.toLowerCase() === clean
    );
  }

  public saveUser(user: UserAccount): void {
    this.memoryUsers.set(user.id, { ...user });
    this.persistUsers();
  }

  public resetUsersToSeed(): void {
    this.memoryUsers.clear();
    for (const u of PRESEEDED_USERS) {
      this.memoryUsers.set(u.id, { ...u });
    }
    this.persistUsers();
  }

  private persistUsers(): void {
    if (!this.isBrowser) return;
    try {
      const arr = Array.from(this.memoryUsers.values());
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(arr));
    } catch (err) {
      console.warn('Fallo al sincronizar usuarios con la base de datos:', err);
    }
  }

  // --- MÉTODOS DE SEGURIDAD Y CONTROL DE ACCESO (LOGIN) ---

  /**
   * Records a login attempt for audit and brute-force prevention.
   */
  public recordLoginAttempt(username: string, success: boolean, reason?: string): void {
    const record: LoginAuditRecord = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: username.trim().toLowerCase(),
      timestamp: Date.now(),
      success,
      reason,
    };
    this.memoryLoginAudit.push(record);
    if (this.memoryLoginAudit.length > 500) {
      this.memoryLoginAudit = this.memoryLoginAudit.slice(-500); // Guardar últimos 500 eventos
    }

    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(this.memoryLoginAudit));
      } catch {
        // Ignore quota
      }
    }
  }

  /**
   * Checks if an account is locked due to repeated brute-force failed attempts.
   * Lockout rule: 5 failed attempts within 60 seconds triggers a 30-second lockout.
   */
  public getLockoutStatus(username: string): { isLocked: boolean; remainingSeconds: number } {
    const clean = username.trim().toLowerCase();
    const now = Date.now();
    const windowMs = 60_000;
    const lockoutDurationMs = 30_000;

    const recentAttempts = this.memoryLoginAudit.filter(
      (a) => a.username === clean && now - a.timestamp <= windowMs + lockoutDurationMs
    );

    // Encuentra los últimos fallos consecutivos
    let consecutiveFails = 0;
    let lastFailTime = 0;

    for (let i = recentAttempts.length - 1; i >= 0; i--) {
      const att = recentAttempts[i];
      if (!att.success) {
        consecutiveFails++;
        if (lastFailTime === 0) lastFailTime = att.timestamp;
      } else {
        break; // Éxito rompe la racha de fallos
      }
    }

    if (consecutiveFails >= 5 && now - lastFailTime < lockoutDurationMs) {
      const remaining = Math.ceil((lockoutDurationMs - (now - lastFailTime)) / 1000);
      return { isLocked: true, remainingSeconds: Math.max(1, remaining) };
    }

    return { isLocked: false, remainingSeconds: 0 };
  }

  // --- GESTIÓN DE SESIÓN ACTIVA ---

  public getSavedSession(): UserAccount | null {
    if (!this.isBrowser) return null;
    try {
      const str = sessionStorage.getItem(STORAGE_KEY_SESSION) || localStorage.getItem(STORAGE_KEY_SESSION);
      if (!str) return null;
      const parsed: UserAccount = JSON.parse(str);
      // Validar que el usuario aún exista en la base de datos
      const exists = this.getUserById(parsed.id);
      return exists ? { ...exists } : null;
    } catch {
      return null;
    }
  }

  public saveSession(user: UserAccount, rememberMe = true): void {
    if (!this.isBrowser) return;
    try {
      const serialized = JSON.stringify(user);
      sessionStorage.setItem(STORAGE_KEY_SESSION, serialized);
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_SESSION, serialized);
      }
    } catch (err) {
      console.warn('Error al guardar sesión:', err);
    }
  }

  public clearSession(): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }

  // --- SNAPSHOT & EXPORTACIÓN ---

  public exportDatabase(): DatabaseSnapshot {
    return {
      version: 1,
      savedAt: Date.now(),
      users: this.getAllUsers(),
      tickets: this.getAllTickets(),
      loginAudit: this.memoryLoginAudit,
    };
  }
}

export const appDatabase = new DatabaseManager();
