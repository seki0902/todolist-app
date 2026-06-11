import { ipcMain } from 'electron';
import { TagRepository } from '../repositories/tag.repository';
import type { IPCResponse, TagRow } from '../../shared/types/database';

export function registerTagIpcHandlers(repo: TagRepository): void {
  ipcMain.handle('db:tag:create', async (_e, name: string): Promise<IPCResponse<TagRow>> => {
    try {
      if (!name || typeof name !== 'string') return { success: false, error: 'Invalid name' };
      const tag = repo.create(name.trim());
      return { success: true, data: tag };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle('db:tag:delete', async (_e, id: string): Promise<IPCResponse<boolean>> => {
    try {
      const ok = repo.delete(id);
      return ok ? { success: true, data: true } : { success: false, error: 'Not found' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle('db:tag:list', async (): Promise<IPCResponse<TagRow[]>> => {
    try {
      const tags = repo.list();
      return { success: true, data: tags };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle('db:tag:getForTasks', async (_e, taskIds: string[]): Promise<IPCResponse<Record<string, TagRow[]>>> => {
    try {
      const result = repo.getForTasks(taskIds);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle('db:tag:getForTask', async (_e, taskId: string): Promise<IPCResponse<TagRow[]>> => {
    try {
      const tags = repo.getForTask(taskId);
      return { success: true, data: tags };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle('db:tag:setTaskTags', async (_e, taskId: string, tagIds: string[]): Promise<IPCResponse<boolean>> => {
    try {
      repo.setTaskTags(taskId, tagIds);
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });
}
