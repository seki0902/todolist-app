import { Database } from 'sql.js';
import crypto from 'crypto';
import { execQueryAll } from '../db/database';
import type { TagRow, TaskTagRow } from '../../shared/types/database';

export class TagRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(name: string): TagRow {
    const id = crypto.randomUUID();
    const stmt = this.db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)');
    stmt.run([id, name]);
    stmt.free();
    return { id, name };
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tags WHERE id = ?');
    stmt.run([id]);
    const changes = this.db.getRowsModified();
    stmt.free();
    return changes > 0;
  }

  list(): TagRow[] {
    return execQueryAll<TagRow>(this.db, 'SELECT * FROM tags ORDER BY name ASC');
  }

  getForTask(taskId: string): TagRow[] {
    return execQueryAll<TagRow>(this.db, `
      SELECT t.* FROM tags t
      INNER JOIN task_tags tt ON tt.tag_id = t.id
      WHERE tt.task_id = ?
      ORDER BY t.name ASC
    `, [taskId]);
  }

  getForTasks(taskIds: string[]): Record<string, TagRow[]> {
    if (taskIds.length === 0) return {};
    const placeholders = taskIds.map(() => '?').join(', ');
    const rows = execQueryAll<TagRow & { task_id: string }>(this.db, `
      SELECT t.*, tt.task_id FROM tags t
      INNER JOIN task_tags tt ON tt.tag_id = t.id
      WHERE tt.task_id IN (${placeholders})
      ORDER BY t.name ASC
    `, taskIds);
    const result: Record<string, TagRow[]> = {};
    for (const row of rows) {
      if (!result[row.task_id]) result[row.task_id] = [];
      result[row.task_id].push({ id: row.id, name: row.name });
    }
    return result;
  }

  setTaskTags(taskId: string, tagIds: string[]): void {
    this.db.exec('BEGIN');
    try {
      const delStmt = this.db.prepare('DELETE FROM task_tags WHERE task_id = ?');
      delStmt.run([taskId]);
      delStmt.free();

      const insStmt = this.db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) {
        insStmt.run([taskId, tagId]);
      }
      insStmt.free();
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}
