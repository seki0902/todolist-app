import { ipcMain, dialog, app } from 'electron';
import { saveDatabase, closeDatabase, initDatabase, getDatabase } from '../db/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function registerBackupIpcHandlers(): void {
  // Get database path
  ipcMain.handle('db:getPath', () => {
    const dbPath = path.join(app.getPath('userData'), 'focusflow.db');
    return { success: true, data: dbPath };
  });

  // Backup: copies current db file to user-chosen location
  ipcMain.handle('db:backup', async () => {
    try {
      // Save current state first
      saveDatabase();
      const dbPath = path.join(app.getPath('userData'), 'focusflow.db');

      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file not found' };
      }

      const result = await dialog.showSaveDialog({
        title: '备份数据库',
        defaultPath: `focusflow-backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [
          { name: 'SQLite Database', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' };
      }

      fs.copyFileSync(dbPath, result.filePath);
      return { success: true, data: result.filePath };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // Restore: replaces current db with user-chosen backup
  ipcMain.handle('db:restore', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '恢复数据库',
        filters: [
          { name: 'SQLite Database', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Cancelled' };
      }

      const sourcePath = result.filePaths[0];
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: 'File not found' };
      }

      // Close current database
      closeDatabase();

      // Backup current db before restoring (safety)
      const dbPath = path.join(app.getPath('userData'), 'focusflow.db');
      const backupPath = dbPath + '.pre-restore.bak';
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }

      // Copy restore file over current db
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, dbPath);

      // Re-initialize database
      await initDatabase();

      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });
}
