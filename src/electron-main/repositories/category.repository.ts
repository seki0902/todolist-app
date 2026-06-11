import { Database } from 'sql.js';
import crypto from 'crypto';
import { execQueryAll, execQueryOne } from '../db/database';
import type { CategoryRow, CreateCategoryInput, UpdateCategoryInput } from '../../shared/types/database';

export class CategoryRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(input: CreateCategoryInput): CategoryRow {
    const id = input.id ?? crypto.randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(
      'INSERT INTO categories (id, name, color, sort, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run([id, input.name, input.color ?? null, input.sort ?? 0, now]);
    stmt.free();

    return this.getById(id)!;
  }

  update(id: string, input: UpdateCategoryInput): CategoryRow | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name);
    }
    if (input.color !== undefined) {
      fields.push('color = ?');
      params.push(input.color);
    }
    if (input.sort !== undefined) {
      fields.push('sort = ?');
      params.push(input.sort);
    }

    if (fields.length === 0) return existing;

    params.push(id);
    const stmt = this.db.prepare(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`
    );
    stmt.run(params);
    stmt.free();

    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    stmt.run([id]);
    const changes = this.db.getRowsModified();
    stmt.free();
    return changes > 0;
  }

  getById(id: string): CategoryRow | null {
    return execQueryOne<CategoryRow>(this.db, 'SELECT * FROM categories WHERE id = ?', [id]);
  }

  list(): CategoryRow[] {
    return execQueryAll<CategoryRow>(this.db, 'SELECT * FROM categories ORDER BY sort ASC, created_at ASC');
  }
}