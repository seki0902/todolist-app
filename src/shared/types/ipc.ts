export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const IPC_CHANNELS = {
  TASK: {
    CREATE: 'db:task:create',
    UPDATE: 'db:task:update',
    DELETE: 'db:task:delete',
    LIST: 'db:task:list',
    CLONE_TASKS: 'db:task:cloneTasks',
  },
  CATEGORY: {
    CREATE: 'db:category:create',
    UPDATE: 'db:category:update',
    DELETE: 'db:category:delete',
    LIST: 'db:category:list',
  },
  TEMPLATE: {
    CREATE: 'db:template:create',
    UPDATE: 'db:template:update',
    DELETE: 'db:template:delete',
    LIST: 'db:template:list',
    APPLY: 'db:template:apply',
  },
  SYNC: 'db:sync',
  NOTIFY: 'app:notify',
  STICKY: 'app:sticky',
  AI: {
    PARSE: 'ai:parse',
    RESET_OLLAMA: 'ai:reset-ollama',
  },
} as const;

export interface DBSyncEvent {
  table: 'tasks' | 'categories' | 'templates' | 'template_steps';
  action: 'insert' | 'update' | 'delete';
  ids: string[];
  payload?: unknown;
}