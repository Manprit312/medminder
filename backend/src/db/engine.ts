import type { Pool } from 'pg';
import type Database from 'better-sqlite3';
import { openSqlite } from './sqlite.js';
import { createPgPool } from './postgres.js';

let sqliteDb: Database.Database | null = null;
let pgPool: Pool | null = null;

export function isPostgres(): boolean {
  return pgPool !== null;
}

export async function initDb(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    pgPool = await createPgPool(url);
    return;
  }
  sqliteDb = openSqlite();
}

function toPgPlaceholders(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

export async function queryOne<T>(sql: string, params: unknown[]): Promise<T | undefined> {
  if (pgPool) {
    const res = await pgPool.query(toPgPlaceholders(sql), params);
    return res.rows[0] as T | undefined;
  }
  const row = sqliteDb!.prepare(sql).get(...params) as T | undefined;
  return row;
}

export async function queryAll<T>(sql: string, params: unknown[]): Promise<T[]> {
  if (pgPool) {
    const res = await pgPool.query(toPgPlaceholders(sql), params);
    return res.rows as T[];
  }
  return sqliteDb!.prepare(sql).all(...params) as T[];
}

export async function runExec(sql: string, params: unknown[]): Promise<{ changes: number }> {
  if (pgPool) {
    const res = await pgPool.query(toPgPlaceholders(sql), params);
    return { changes: res.rowCount ?? 0 };
  }
  const r = sqliteDb!.prepare(sql).run(...params);
  return { changes: r.changes };
}
