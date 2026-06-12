import { Database } from 'sql.js';
import crypto from 'crypto';
import { execQueryAll, execQueryOne } from '../db/database';
import type {
  TemplateRow,
  TemplateStepRow,
  CreateTemplateInput,
  UpdateTemplateInput,
  TaskRow,
} from '../../shared/types/database';

export class TemplateRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(input: CreateTemplateInput): TemplateRow {
    const id = input.id ?? crypto.randomUUID();
    const now = Date.now();

    const insertTemplate = this.db.prepare(
      'INSERT INTO templates (id, name, description, icon, category_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertStep = this.db.prepare(
      'INSERT INTO template_steps (id, template_id, title, sort, default_priority, default_pomodoro) VALUES (?, ?, ?, ?, ?, ?)'
    );

    this.db.exec('BEGIN');
    try {
      insertTemplate.run([id, input.name, input.description ?? null, input.icon ?? null, input.category_id ?? null, now]);

      if (input.steps && input.steps.length > 0) {
        for (const step of input.steps) {
          const stepId = step.id ?? crypto.randomUUID();
          insertStep.run([
            stepId,
            id,
            step.title,
            step.sort,
            step.default_priority ?? 3,
            step.default_pomodoro ?? 0,
          ]);
        }
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    insertTemplate.free();
    insertStep.free();

    return this.getById(id)!;
  }

  update(id: string, input: UpdateTemplateInput): TemplateRow | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      params.push(input.description);
    }
    if (input.icon !== undefined) {
      fields.push('icon = ?');
      params.push(input.icon);
    }
    if (input.category_id !== undefined) {
      fields.push('category_id = ?');
      params.push(input.category_id);
    }

    if (fields.length > 0) {
      params.push(id);
      const stmt = this.db.prepare(
        `UPDATE templates SET ${fields.join(', ')} WHERE id = ?`
      );
      stmt.run(params);
      stmt.free();
    }

    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM templates WHERE id = ?');
    stmt.run([id]);
    const changes = this.db.getRowsModified();
    stmt.free();
    return changes > 0;
  }

  getById(id: string): TemplateRow | null {
    return execQueryOne<TemplateRow>(this.db, 'SELECT * FROM templates WHERE id = ?', [id]);
  }

  getSteps(templateId: string): TemplateStepRow[] {
    return execQueryAll<TemplateStepRow>(
      this.db,
      'SELECT * FROM template_steps WHERE template_id = ? ORDER BY sort ASC',
      [templateId]
    );
  }

  list(): TemplateRow[] {
    return execQueryAll<TemplateRow>(
      this.db,
      'SELECT * FROM templates ORDER BY created_at DESC'
    );
  }

  apply(templateId: string): TaskRow[] {
    const template = this.getById(templateId);
    if (!template) return [];

    const steps = this.getSteps(templateId);
    const now = Date.now();
    const parentTaskId = crypto.randomUUID();

    const insertTask = this.db.prepare(`
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

    const createdTasks: TaskRow[] = [];
    const templateCategoryId = (template as any).category_id || null;

    this.db.exec('BEGIN');
    try {
      // Insert parent task
      insertTask.run([
        parentTaskId,
        template.name,
        template.description ?? '',
        3,
        'todo',
        0,
        null,
        null,
        null,
        null,
        null,
        templateCategoryId,
        null,
        0,
        0,
        null,
        now,
        now,
      ]);

      // Insert child steps
      for (const step of steps) {
        insertTask.run([
          crypto.randomUUID(),
          step.title,
          '',
          step.default_priority,
          'todo',
          0,
          null,
          null,
          null,
          null,
          null,
          templateCategoryId,
          parentTaskId,
          step.sort,
          step.default_pomodoro,
          null,
          now,
          now,
        ]);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      insertTask.free();
      throw err;
    }
    insertTask.free();

    // Re-fetch created tasks
    const parentTask = execQueryAll<TaskRow>(this.db, 'SELECT * FROM tasks WHERE id = ?', [parentTaskId]);
    const childTasks = execQueryAll<TaskRow>(
      this.db,
      'SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort ASC',
      [parentTaskId]
    );

    createdTasks.push(parentTask[0], ...childTasks);
    return createdTasks;
  }
}
