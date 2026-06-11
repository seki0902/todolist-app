import { ipcMain, BrowserWindow } from 'electron';
import { CategoryRepository } from '../repositories/category.repository';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import type {
  IPCResponse,
  DBSyncEvent,
  CategoryRow,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../../shared/types/database';

function broadcastSync(
  action: DBSyncEvent['action'],
  ids: string[],
  payload?: CategoryRow | CategoryRow[]
): void {
  const event: DBSyncEvent = {
    table: 'categories',
    action,
    ids,
    payload,
  };
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC_CHANNELS.SYNC, event);
  });
}

export function registerCategoryIpcHandlers(repo: CategoryRepository): void {
  ipcMain.handle(
    IPC_CHANNELS.CATEGORY.CREATE,
    async (_event, input: CreateCategoryInput): Promise<IPCResponse<CategoryRow>> => {
      try {
        if (!input || !input.name || typeof input.name !== 'string') {
          return { success: false, error: 'Invalid input: name is required' };
        }
        const category = repo.create(input);
        broadcastSync('insert', [category.id], category);
        return { success: true, data: category };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CATEGORY.UPDATE,
    async (_event, id: string, input: UpdateCategoryInput): Promise<IPCResponse<CategoryRow>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const category = repo.update(id, input);
        if (!category) {
          return { success: false, error: 'Category not found' };
        }
        broadcastSync('update', [category.id], category);
        return { success: true, data: category };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CATEGORY.DELETE,
    async (_event, id: string): Promise<IPCResponse<boolean>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const deleted = repo.delete(id);
        if (!deleted) {
          return { success: false, error: 'Category not found' };
        }
        broadcastSync('delete', [id]);
        return { success: true, data: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CATEGORY.LIST,
    async (): Promise<IPCResponse<CategoryRow[]>> => {
      try {
        const categories = repo.list();
        return { success: true, data: categories };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );
}
