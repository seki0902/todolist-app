import { ipcMain, BrowserWindow } from 'electron';
import { TaskRepository } from '../repositories/task.repository';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import type {
  IPCResponse,
  DBSyncEvent,
  TaskRow,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilter,
} from '../../shared/types/database';

function broadcastSync(
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

/** Broadcast ancestor tasks whose progress/status changed via recalcParentProgress. */
function broadcastAncestorUpdates(repo: TaskRepository): void {
  for (const ancestorId of repo.affectedAncestorIds) {
    const ancestor = repo.getById(ancestorId);
    if (ancestor) {
      broadcastSync('update', [ancestorId], ancestor);
    }
  }
}

export function registerTaskIpcHandlers(repo: TaskRepository): void {
  ipcMain.handle(
    IPC_CHANNELS.TASK.CREATE,
    async (_event, input: CreateTaskInput): Promise<IPCResponse<TaskRow>> => {
      try {
        if (!input || !input.title || typeof input.title !== 'string') {
          return { success: false, error: 'Invalid input: title is required' };
        }
        const task = repo.create(input);
        broadcastSync('insert', [task.id], task);
        broadcastAncestorUpdates(repo);
        return { success: true, data: task };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASK.UPDATE,
    async (_event, id: string, input: UpdateTaskInput): Promise<IPCResponse<TaskRow>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const task = repo.update(id, input);
        if (!task) {
          return { success: false, error: 'Task not found' };
        }
        broadcastSync('update', [task.id], task);
        broadcastAncestorUpdates(repo);
        return { success: true, data: task };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASK.DELETE,
    async (_event, id: string): Promise<IPCResponse<boolean>> => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Invalid input: id is required' };
        }
        const deleted = repo.delete(id);
        if (!deleted) {
          return { success: false, error: 'Task not found' };
        }
        broadcastSync('delete', [id]);
        broadcastAncestorUpdates(repo);
        return { success: true, data: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASK.LIST,
    async (_event, filter?: TaskListFilter): Promise<IPCResponse<TaskRow[]>> => {
      try {
        const tasks = repo.list(filter);
        return { success: true, data: tasks };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    }
  );
}
