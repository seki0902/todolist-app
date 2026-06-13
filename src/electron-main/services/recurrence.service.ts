import { getDatabase, execQueryAll } from '../db/database';
import type { TaskRow } from '../../shared/types/database';

let timer: NodeJS.Timeout | null = null;

export function startRecurrenceService(): void {
  if (timer) return;
  // Check every 60 seconds
  timer = setInterval(processRecurringTasks, 60000);
  processRecurringTasks(); // initial check
}

export function stopRecurrenceService(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function processRecurringTasks(): void {
  const db = getDatabase();
  const now = Date.now();

  // Find recurring tasks whose due_time is in the past
  const tasks = execQueryAll<TaskRow>(db, `
    SELECT * FROM tasks
    WHERE recurrence_type IS NOT NULL
      AND recurrence_type != ''
      AND due_time IS NOT NULL
      AND due_time < ?
      AND status NOT IN ('cancelled')
    ORDER BY due_time ASC
  `, [now]);

  for (const task of tasks) {
    const nextDue = getNextDueTime(task.due_time!, task.recurrence_type!, task.recurrence_days);
    if (!nextDue) {
      // Could not compute next occurrence (e.g. task too far in the past,
      // invalid recurrence config).  Clear recurrence fields so we stop
      // re-querying this task every tick.
      console.warn(
        `[RecurrenceService] Could not compute next occurrence for task "${task.title}" (id=${task.id}). ` +
        `Clearing recurrence fields to avoid re-query loop.`
      );
      const clearStmt = db.prepare(`
        UPDATE tasks SET recurrence_type = NULL, recurrence_days = NULL, updated_at = ? WHERE id = ?
      `);
      clearStmt.run([now, task.id]);
      clearStmt.free();
      continue;
    }

    // Update the due_time to next occurrence
    // If task was done or paused, reset to todo for the next cycle
    const newStatus = (task.status === 'done' || task.status === 'paused') ? 'todo' : task.status;
    const stmt = db.prepare(`
      UPDATE tasks SET due_time = ?, status = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run([nextDue.getTime(), newStatus, now, task.id]);
    stmt.free();
  }
}

function getNextDueTime(currentDue: number, recurrenceType: string, recurrenceDays?: string | null): Date | null {
  const due = new Date(currentDue);

  // Handle weekly_days mode
  if (recurrenceType === 'weekly' && recurrenceDays) {
    try {
      const days: number[] = JSON.parse(recurrenceDays);
      if (days.length === 0) return null;

      const now = new Date();
      let iterations = 0;
      const maxIterations = 100;

      while (due.getTime() <= now.getTime() && iterations < maxIterations) {
        // Find the next matching day of week
        let found = false;
        for (let add = 1; add <= 7; add++) {
          due.setDate(due.getDate() + 1);
          if (days.includes(due.getDay())) {
            found = true;
            break;
          }
        }
        if (!found) return null;
        iterations++;
      }
      return iterations < maxIterations ? due : null;
    } catch {
      return null;
    }
  }

  // Standard recurrence types
  const now = new Date();
  let iterations = 0;
  const maxIterations = 100;

  while (due.getTime() <= now.getTime() && iterations < maxIterations) {
    switch (recurrenceType) {
      case 'daily':
        due.setDate(due.getDate() + 1);
        break;
      case 'weekly':
        due.setDate(due.getDate() + 7);
        break;
      case 'monthly':
        due.setMonth(due.getMonth() + 1);
        break;
      case 'yearly':
        due.setFullYear(due.getFullYear() + 1);
        break;
      default:
        return null;
    }
    iterations++;
  }

  return iterations < maxIterations ? due : null;
}
