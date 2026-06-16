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

  // Check for tasks whose reminder_time has arrived (up to 60s in the past
  // to catch any missed while the timer was between ticks).
  // reminder_time = due_time - user_configured_offset, so this fires
  // exactly when the user asked to be reminded.
  const rows = execQueryAll<TaskRow>(db, `
    SELECT * FROM tasks
    WHERE status NOT IN ('done', 'cancelled')
      AND reminder_time IS NOT NULL
      AND reminder_time <= ?
      AND reminder_time > ?
    ORDER BY reminder_time ASC
  `, [now, now - 60_000]);

  // Cleanup notified IDs periodically to prevent unbounded growth
  if (notifiedIds.size > 200) {
    notifiedIds.clear();
  }

  for (const row of rows) {
    if (!notifiedIds.has(row.id)) {
      notifiedIds.add(row.id);
      sendReminder(row);
    }
  }
}

function sendReminder(task: TaskRow): void {
  if (!task.due_time) return; // Guard: reminder_time can exist without due_time in edge cases
  const minutesLeft = Math.round((task.due_time - Date.now()) / 60000);

  const notification = new Notification({
    title: '⏰ 任务提醒',
    body: minutesLeft > 0
      ? `"${task.title}" 将在 ${minutesLeft} 分钟后到期`
      : `"${task.title}" 已经到期`,
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
