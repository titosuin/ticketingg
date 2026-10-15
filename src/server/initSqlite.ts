/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { PRESEEDED_USERS } from '../engine/security.ts';

const DB_PATH = path.resolve(process.cwd(), 'data', 'tickets.sqlite');

export function initializeSqliteDatabase(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);

  // 1. Tabla de Usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_level TEXT NOT NULL,
      password_entropy_score INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      is_preseeded INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 2. Tabla de Tickets
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      severity INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_department TEXT NOT NULL,
      author_channel TEXT NOT NULL,
      sla_minutes INTEGER NOT NULL,
      sla_deadline_ms INTEGER NOT NULL,
      max_retries INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      fencing_token INTEGER NOT NULL DEFAULT 0,
      current_worker_id TEXT,
      lease_expires_at INTEGER,
      failure_reason TEXT,
      context_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
  `);

  // 3. Tabla de Transiciones de Auditoría (Inmutable)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_transitions (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT NOT NULL,
      fencing_token INTEGER,
      metadata_json TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );
  `);

  // 4. Tabla de Auditoría de Login & Prevención de Fuerza Bruta
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_audit (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      success INTEGER NOT NULL,
      reason TEXT,
      ip TEXT
    );
  `);

  // 5. Sembrar los 8 usuarios predeterminados si la tabla está vacía
  const countRow = db.prepare('SELECT count(*) as total FROM users').get() as { total: number };
  if (countRow.total === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, username, name, department, role, password_hash, password_level, password_entropy_score, created_at, is_preseeded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const u of PRESEEDED_USERS) {
      insertUser.run(
        u.id,
        u.username,
        u.name,
        u.department,
        u.role,
        u.passwordHash || '',
        u.passwordLevel || 'ULTRA_SECURE',
        u.passwordEntropyScore || 100,
        u.createdAt,
        1
      );
    }
  }

  return db;
}

// Ejecutar si se invoca directamente
initializeSqliteDatabase();
console.log('Base de datos SQLite relacional inicializada exitosamente en data/tickets.sqlite');
