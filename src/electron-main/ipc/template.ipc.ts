import { ipcMain, BrowserWindow } from 'electron';
import { TemplateRepository } from '../repositories/template.repository';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import type {
  IPCResponse,
  DBSyncEvent,
  TemplateRow,
  TaskRow,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../../shared/types/database';

function broadcastTemplateSync(
  action: DBSyncEvent['action'],
  ids: string[],
  payload?: TemplateRow | TemplateRow[]
): void {
  const event: DBSyncEvent = {
    table: 'templates',
    action,
    ids,
    payload,
  };
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC_CHANNELS.SYNC, event);
  });
}

function broadcastTaskSync(
  action: DBSyncEvent['action'],
  ids: string[],
  payload?: TaskRow | TaskRow[]
): void {
  const event: DBSyncEvent = {
    table: 'tasks',
    action,
    ids,
    payload,
  };
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC_CHANNELS.SYNC, event);
  });
}

export function registerTemplateIpcHandlers(repo: TemplateRepository): void {
  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE.CREATE,
    async (_event, input: CreateTemplateInput): Promise<IPCResponse<TemplateRow>> => {
      try {
        if (!input || !input.name || typeof input.name !== 'string') {
          return { success: false, error: 'Invalid input: name is required' };
        }
        const template = repo.create(input);
        broadcastTemplateSync('insert', [template.id], template);
        return { success: true, data: template };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE.UPDATE,
    async (_event, id: string, input: UpdateTemplateInput): Promise<IPCResponse<TemplateRow>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const template = repo.update(id, input);
        if (!template) {
          return { success: false, error: 'Template not found' };
        }
        broadcastTemplateSync('update', [template.id], template);
        return { success: true, data: template };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE.DELETE,
    async (_event, id: string): Promise<IPCResponse<boolean>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const deleted = repo.delete(id);
        if (!deleted) {
          return { success: false, error: 'Template not found' };
        }
        broadcastTemplateSync('delete', [id]);
        return { success: true, data: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE.LIST,
    async (): Promise<IPCResponse<TemplateRow[]>> => {
      try {
        const templates = repo.list();
        return { success: true, data: templates };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE.APPLY,
    async (_event, id: string): Promise<IPCResponse<TaskRow[]>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const tasks = repo.apply(id);
        if (tasks.length === 0) {
          return { success: false, error: 'Template not found or has no steps' };
        }
        broadcastTaskSync('insert', tasks.map((t) => t.id), tasks);
        return { success: true, data: tasks };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );
}
