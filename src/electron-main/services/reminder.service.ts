import { Notification, BrowserWindow } from 'electron';
import { getDatabase, execQueryAll } from '../db/database';
import type { TaskRow } from '../../shared/types/database';

let timer: NodeJS.Timeout | null = null;
let notifiedIds = new Set<string>();

export function startReminderService(): void {
  if (timer) return;

  // Check every 30 seconds
  timer = setInterval(checkReminders, 30000);
  checkReminders(); // initial check
}

export function stopReminderService(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  notifiedIds.clear();
}

function checkReminders(): void {
  const db = getDatabase();
  const now = Date.now();

  // Windows to check: 5min, 15min, 30min, 1hour ahead
  const windows = [5, 15, 30, 60].map((m) => now + m * 60 * 1000);

  const tasks: TaskRow[] = [];
  for (const windowEnd of windows) {
    const rows = execQueryAll<TaskRow>(db, `
      SELECT * FROM tasks 
      WHERE status NOT IN ('done', 'cancelled')
        AND due_time IS NOT NULL 
        AND due_time > ? 
        AND due_time <= ?
      ORDER BY due_time ASC
    `, [now, windowEnd]);
    for (const row of rows) {
      if (!notifiedIds.has(row.id)) {
        tasks.push(row);
        notifiedIds.add(row.id);
      }
    }
  }

  // Cleanup notified IDs for tasks that are done/cancelled/no longer relevant
  if (notifiedIds.size > 100) {
    notifiedIds.clear();
  }

  for (const task of tasks) {
    sendReminder(task);
  }
}

function sendReminder(task: TaskRow): void {
  const minutesLeft = Math.round((task.due_time! - Date.now()) / 60000);

  const notification = new Notification({
    title: '⏰ 任务提醒',
    body: `"${task.title}" 将在 ${minutesLeft} 分钟后到期`,
    urgency: 'critical',
    closeButtonText: '知道了',
  });

  notification.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  notification.show();
}
