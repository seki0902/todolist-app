import initSqlJs, { Database } from 'sql.js';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

let db: Database | null = null;

export function queryAll<T = any>(sql: string, params?: any[]): T[] {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params?: any[]): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execQueryAll<T = any>(dbInstance: Database, sql: string, params?: any[]): T[] {
  const stmt = dbInstance.prepare(sql);
  if (params) stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function execQueryOne<T = any>(dbInstance: Database, sql: string, params?: any[]): T | null {
  const rows = execQueryAll<T>(dbInstance, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // sql.js internally uses __dirname which produces mixed slashes on Windows.
      // path.join() produces clean platform-native paths that the asar-patched fs
      // can correctly resolve to files inside the asar archive.
      return path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', file);
    },
  });
  const dbPath = path.join(app.getPath('userData'), 'focusflow.db');

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error(
      'Database not initialised. Call initDatabase() before getDatabase().'
    );
  }
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(app.getPath('userData'), 'focusflow.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}
