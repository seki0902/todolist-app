import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

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
if (!gotTheLock) { app.quit(); } else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(async () => {
    await initDatabase();
    const db = getDatabase();
    runAllMigrations(db); seedCategories(db);
    const taskRepo = new TaskRepository(db);
    const categoryRepo = new CategoryRepository(db);
    const templateRepo = new TemplateRepository(db);
    const tagRepo = new TagRepository(db);
    registerTaskIpcHandlers(taskRepo); registerCategoryIpcHandlers(categoryRepo);
    registerTemplateIpcHandlers(templateRepo); registerTagIpcHandlers(tagRepo);
    registerStickyIpcHandlers(); registerBackupIpcHandlers(); startReminderService(); startRecurrenceService();
    createWindow();
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
