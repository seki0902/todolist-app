import { Database } from 'sql.js';
import crypto from 'crypto';

function queryAll(db: Database, sql: string, params?: any[]): any[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

const DEFAULT_CATEGORIES = [
  { name: '工作', color: '#3B82F6' },
  { name: '学习', color: '#8B5CF6' },
  { name: '生活', color: '#10B981' },
  { name: '项目', color: '#F59E0B' },
];

export function seedCategories(db: Database): void {
  const rows = queryAll(db, 'SELECT COUNT(*) as count FROM categories');

  if (rows[0] && rows[0].count > 0) {
    return;
  }

  const insert = db.prepare(
    'INSERT INTO categories (id, name, color, sort, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    const now = Date.now();
    DEFAULT_CATEGORIES.forEach((cat, index) => {
      insert.run([crypto.randomUUID(), cat.name, cat.color, index, now]);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  insert.free();

  console.log('Seed data: default categories inserted.');
}