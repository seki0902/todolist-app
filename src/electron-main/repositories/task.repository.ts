import { Database } from 'sql.js';
import crypto from 'crypto';
import { execQueryAll, execQueryOne } from '../db/database';
import type { TaskRow, CreateTaskInput, UpdateTaskInput, TaskListFilter } from '../../shared/types/database';

export class TaskRepository {
  private db: Database;
  /** Accumulates IDs of ancestor tasks updated by recalcParentProgress. */
  affectedAncestorIds: Set<string> = new Set();

  constructor(db: Database) {
    this.db = db;
  }

  create(input: CreateTaskInput): TaskRow {
    const id = input.id ?? crypto.randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, description, priority, status, progress,
        start_time, due_time, reminder_time, recurrence_type, recurrence_days,
        category_id, parent_id, sort, estimated_pomodoro, ai_meta,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    stmt.run([
      id,
      input.title,
      input.description ?? '',
      input.priority ?? 3,
      input.status ?? 'todo',
      input.progress ?? 0,
      input.start_time ?? null,
      input.due_time ?? null,
      input.reminder_time ?? null,
      input.recurrence_type ?? null,
      input.recurrence_days ?? null,
      input.category_id ?? null,
      input.parent_id ?? null,
      input.sort ?? 0,
      input.estimated_pomodoro ?? 0,
      input.ai_meta ?? null,
      now,
      now,
    ]);
    stmt.free();

    // Update parent progress if this is a child task
    this.affectedAncestorIds = new Set();
    if (input.parent_id) {
      this.recalcParentProgress(input.parent_id);
    }

    return this.getById(id)!;
  }

  update(id: string, input: UpdateTaskInput): TaskRow | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const params: unknown[] = [];

    const mappings: [keyof UpdateTaskInput, string][] = [
      ['title', 'title'],
      ['description', 'description'],
      ['priority', 'priority'],
      ['status', 'status'],
      ['progress', 'progress'],
      ['start_time', 'start_time'],
      ['due_time', 'due_time'],
      ['reminder_time', 'reminder_time'],
      ['recurrence_type', 'recurrence_type'],
      ['recurrence_days', 'recurrence_days'],
      ['category_id', 'category_id'],
      ['parent_id', 'parent_id'],
      ['sort', 'sort'],
      ['estimated_pomodoro', 'estimated_pomodoro'],
      ['ai_meta', 'ai_meta'],
    ];

    for (const [key, col] of mappings) {
      if (input[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(input[key]);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(params);
    stmt.free();

    // Update parent progress (current or new parent)
    this.affectedAncestorIds = new Set();
    const updated = this.getById(id)!;
    if (updated.parent_id) {
      this.recalcParentProgress(updated.parent_id);
    }
    // Also recalc old parent if parent changed
    if (input.parent_id !== undefined && existing.parent_id && existing.parent_id !== input.parent_id) {
      this.recalcParentProgress(existing.parent_id);
    }

    return updated;
  }

  delete(id: string): boolean {
    const task = this.getById(id);
    this.affectedAncestorIds = new Set();
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run([id]);
    const changes = this.db.getRowsModified();
    stmt.free();

    // Update parent progress if this was a child task
    if (task?.parent_id) {
      this.recalcParentProgress(task.parent_id);
    }
    return changes > 0;
  }

  getById(id: string): TaskRow | null {
    return execQueryOne<TaskRow>(this.db, 'SELECT * FROM tasks WHERE id = ?', [id]);
  }

  list(filter?: TaskListFilter): TaskRow[] {
    let sql = 'SELECT DISTINCT t.* FROM tasks t';
    const params: unknown[] = [];

    // Join with task_tags if filtering by tags
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      const placeholders = filter.tag_ids.map(() => '?').join(', ');
      sql += ` INNER JOIN task_tags tt ON tt.task_id = t.id AND tt.tag_id IN (${placeholders})`;
      params.push(...filter.tag_ids);
    }

    sql += ' WHERE 1=1';

    if (filter?.status) {
      sql += ' AND t.status = ?';
      params.push(filter.status);
    }
    if (filter?.priority) {
      sql += ' AND t.priority = ?';
      params.push(filter.priority);
    }
    if (filter?.category_id) {
      sql += ' AND t.category_id = ?';
      params.push(filter.category_id);
    }
    if (filter?.parent_id === null) {
      sql += ' AND t.parent_id IS NULL';
    } else if (filter?.parent_id) {
      sql += ' AND t.parent_id = ?';
      params.push(filter.parent_id);
    }
    if (filter?.search) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term);
    }
    if (filter?.due_date) {
      const dayStart = new Date(filter.due_date + 'T00:00:00').getTime();
      const dayEnd = new Date(filter.due_date + 'T23:59:59.999').getTime();
      sql += ' AND t.due_time >= ? AND t.due_time <= ?';
      params.push(dayStart, dayEnd);
    }

    sql += ' ORDER BY t.sort ASC, t.created_at DESC';

    return execQueryAll<TaskRow>(this.db, sql, params);
  }

  // Recalculate parent task progress as average of all child tasks.
  // Also auto-complete parent when all children are done/cancelled.
  // Returns the set of all task IDs that were updated (including ancestors).
  recalcParentProgress(parentId: string): Set<string> {
    const updated = new Set<string>();
    this._recalcParentProgress(parentId, updated);
    return updated;
  }

  private _recalcParentProgress(parentId: string, updated: Set<string>): void {
    const children = execQueryAll<TaskRow>(
      this.db,
      'SELECT * FROM tasks WHERE parent_id = ?',
      [parentId]
    );

    if (children.length === 0) return;

    const avgProgress = Math.round(
      children.reduce((sum, c) => sum + (c.progress || 0), 0) / children.length
    );

    // Check if all children are done or cancelled → auto-complete parent
    const allDone = children.every((c) => c.status === 'done' || c.status === 'cancelled');

    const now = Date.now();
    if (allDone) {
      const stmt = this.db.prepare(
        'UPDATE tasks SET progress = 100, status = ?, updated_at = ? WHERE id = ?'
      );
      stmt.run(['done', now, parentId]);
      stmt.free();
    } else {
      const stmt = this.db.prepare(
        'UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?'
      );
      stmt.run([avgProgress, now, parentId]);
      stmt.free();
    }

    updated.add(parentId);

    // Recurse up if this parent is also a child of another task
    const parent = this.getById(parentId);
    if (parent?.parent_id) {
      this._recalcParentProgress(parent.parent_id, updated);
    }
  }
}
