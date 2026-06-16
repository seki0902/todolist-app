import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import type {
  IPCResponse,
  DBSyncEvent,
  TaskRow,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilter,
  CategoryRow,
  CreateCategoryInput,
  UpdateCategoryInput,
  TemplateRow,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../../shared/types/database';

const dbApi = {
  createTask: (input: CreateTaskInput): Promise<IPCResponse<TaskRow>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK.CREATE, input),

  updateTask: (id: string, input: UpdateTaskInput): Promise<IPCResponse<TaskRow>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK.UPDATE, id, input),

  deleteTask: (id: string): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK.DELETE, id),

  listTasks: (filter?: TaskListFilter): Promise<IPCResponse<TaskRow[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK.LIST, filter),

  createCategory: (input: CreateCategoryInput): Promise<IPCResponse<CategoryRow>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CATEGORY.CREATE, input),

  updateCategory: (id: string, input: UpdateCategoryInput): Promise<IPCResponse<CategoryRow>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CATEGORY.UPDATE, id, input),

  deleteCategory: (id: string): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CATEGORY.DELETE, id),

  listCategories: (): Promise<IPCResponse<CategoryRow[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CATEGORY.LIST),

  createTemplate: (input: CreateTemplateInput): Promise<IPCResponse<TemplateRow>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE.CREATE, input),

  updateTemplate: (id: string, input: UpdateTemplateInput): Promise<IPCResponse<TemplateRow>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE.UPDATE, id, input),

  deleteTemplate: (id: string): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE.DELETE, id),

  listTemplates: (): Promise<IPCResponse<TemplateRow[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE.LIST),

  applyTemplate: (id: string): Promise<IPCResponse<TaskRow[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE.APPLY, id),
};

const tagApi = {
  create: (name: string): Promise<IPCResponse<import('../../shared/types/database').TagRow>> =>
    ipcRenderer.invoke('db:tag:create', name),
  delete: (id: string): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke('db:tag:delete', id),
  list: (): Promise<IPCResponse<import('../../shared/types/database').TagRow[]>> =>
    ipcRenderer.invoke('db:tag:list'),
  getForTask: (taskId: string): Promise<IPCResponse<import('../../shared/types/database').TagRow[]>> =>
    ipcRenderer.invoke('db:tag:getForTask', taskId),
  getForTasks: (taskIds: string[]): Promise<IPCResponse<Record<string, import('../../shared/types/database').TagRow[]>>> =>
    ipcRenderer.invoke('db:tag:getForTasks', taskIds),
  setTaskTags: (taskId: string, tagIds: string[]): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke('db:tag:setTaskTags', taskId, tagIds),
};

type SyncCallback = (event: DBSyncEvent) => void;

const appApi = {
  onSync: (callback: SyncCallback): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DBSyncEvent) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.SYNC, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SYNC, handler);
    };
  },

  removeSyncListener: (callback: SyncCallback): void => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.SYNC);
  },
};

const stickyApi = {
  toggle: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('sticky:toggle'),
  setOpacity: (opacity: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('sticky:setOpacity', opacity),
  focusMain: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('sticky:focusMain'),
  close: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('sticky:close'),
};

const backupApi = {
  getPath: (): Promise<{ success: boolean; data: string }> =>
    ipcRenderer.invoke('db:getPath'),
  backup: (): Promise<{ success: boolean; data?: string; error?: string }> =>
    ipcRenderer.invoke('db:backup'),
  restore: (): Promise<{ success: boolean; data?: boolean; error?: string }> =>
    ipcRenderer.invoke('db:restore'),
};

const notifyApi = {
  pomodoroComplete: (taskTitle: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('notify:pomodoro', taskTitle),
};

const winApi = {
  minimize: (): Promise<void> => ipcRenderer.invoke('win:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('win:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('win:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
  onMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => {
      callback(isMaximized);
    };
    ipcRenderer.on('win:maximizeChange', handler);
    return () => ipcRenderer.removeListener('win:maximizeChange', handler);
  },
};

const aiApi = {
  parse: (text: string): Promise<import('../../shared/types/database').IPCResponse<import('../../shared/types/ai').ParseResult[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.PARSE, text),
};

export interface FocusFlowAPI {
  db: typeof dbApi;
  app: typeof appApi;
  tag: typeof tagApi;
  sticky: typeof stickyApi;
  backup: typeof backupApi;
  win: typeof winApi;
  notify: typeof notifyApi;
  ai: typeof aiApi;
}

contextBridge.exposeInMainWorld('api', {
  db: dbApi,
  app: appApi,
  tag: tagApi,
  sticky: stickyApi,
  backup: backupApi,
  win: winApi,
  notify: notifyApi,
  ai: aiApi,
} as FocusFlowAPI);
