import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import fs from 'fs';

// Startup crash logger — writes to desktop so we can see what happened
function startupLog(msg: string) {
  try {
    const logPath = path.join(app.getPath('desktop'), 'focusflow-startup.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* can't log if app isn't ready yet */ }
}
// Early log using process env or direct path
try {
  const earlyLog = path.join(process.env.USERPROFILE || 'C:\\Users\\EDY', 'Desktop', 'focusflow-startup.log');
  fs.appendFileSync(earlyLog, `[${new Date().toISOString()}] === FocusFlow starting ===\n`);
} catch {}

import { initDatabase, getDatabase, closeDatabase } from '../db/database';
import { runAllMigrations } from '../db/migrations';
import { seedCategories } from '../db/seed';
import { TaskRepository } from '../repositories/task.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { TemplateRepository } from '../repositories/template.repository';
import { TagRepository } from '../repositories/tag.repository';
import { registerTaskIpcHandlers } from '../ipc/task.ipc';
import { registerCategoryIpcHandlers } from '../ipc/category.ipc';
import { registerTemplateIpcHandlers } from '../ipc/template.ipc';
import { registerTagIpcHandlers } from '../ipc/tag.ipc';
import { startReminderService, stopReminderService } from '../services/reminder.service';
import { startRecurrenceService, stopRecurrenceService } from '../services/recurrence.service';
import { registerBackupIpcHandlers } from '../ipc/backup.ipc';
import { registerStickyIpcHandlers, createStickyWindow } from '../services/sticky.service';

let mainWindow: BrowserWindow | null = null;

const gotTheLock = app.requestSingleInstanceLock();
startupLog(`requestSingleInstanceLock: ${gotTheLock}`);
if (!gotTheLock) { startupLog('Another instance running, quitting'); app.quit(); } else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  startupLog('Waiting for app.whenReady()...');
  app.whenReady().then(async () => {
    startupLog('app.whenReady() fired');
    try {
      startupLog('About to call initDatabase()...');
      await initDatabase();
      startupLog('initDatabase() succeeded');
      const db = getDatabase();
      runAllMigrations(db); seedCategories(db);
      startupLog('Migrations and seed done');
      const taskRepo = new TaskRepository(db);
      const categoryRepo = new CategoryRepository(db);
      const templateRepo = new TemplateRepository(db);
      const tagRepo = new TagRepository(db);
      registerTaskIpcHandlers(taskRepo); registerCategoryIpcHandlers(categoryRepo);
      registerTemplateIpcHandlers(templateRepo); registerTagIpcHandlers(tagRepo);
      registerStickyIpcHandlers(); registerBackupIpcHandlers(); startReminderService(); startRecurrenceService();
      startupLog('IPC handlers registered, about to createWindow()');
      createWindow();
      startupLog('createWindow() done, app should be visible');
    } catch (err) {
      startupLog(`STARTUP ERROR: ${err instanceof Error ? err.message : String(err)}`);
      startupLog(`STACK: ${err instanceof Error ? err.stack : 'no stack'}`);
      console.error('FocusFlow startup error:', err);
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'FocusFlow 启动失败',
        `应用启动时发生错误:\n${err instanceof Error ? err.message : String(err)}\n\n请尝试重新安装应用。`
      );
      app.quit();
    }
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { stopReminderService(); stopRecurrenceService(); closeDatabase(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'FocusFlow Desktop',
    webPreferences: { preload: path.join(__dirname, '../preload/preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });

  // Window control IPC handlers
  ipcMain.handle('win:minimize', () => { mainWindow?.minimize(); });
  ipcMain.handle('win:maximize', () => {
    if (mainWindow?.isMaximized()) { mainWindow.unmaximize(); }
    else { mainWindow?.maximize(); }
  });
  ipcMain.handle('win:close', () => { mainWindow?.close(); });
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle('notify:pomodoro', (_event, taskTitle: string) => {
    new Notification({
      title: '🍅 番茄钟完成',
      body: taskTitle ? `"${taskTitle}" 专注时间结束！` : '专注时间结束！',
      urgency: 'normal',
    }).show();
    return { success: true };
  });

  mainWindow.on('maximize', () => { mainWindow?.webContents.send('win:maximizeChange', true); });
  mainWindow.on('unmaximize', () => { mainWindow?.webContents.send('win:maximizeChange', false); });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  return mainWindow;
}
