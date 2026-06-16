import { create } from 'zustand';
import type { TaskRow, TaskListFilter, CreateTaskInput, UpdateTaskInput } from '../shared/types/database';
import { DBSyncEvent } from '../shared/types/ipc';

interface TaskState {
  tasks: TaskRow[];
  loading: boolean;
  error: string | null;
  syncUnsubscribe: (() => void) | null;

  loadTasks: (filter?: TaskListFilter) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<TaskRow | null>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<TaskRow | null>;
  deleteTask: (id: string) => Promise<boolean>;
  handleSync: (event: DBSyncEvent) => void;
  initSync: () => void;
  cleanup: () => void;
  migrateTasksToToday: (taskIds: string[]) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  syncUnsubscribe: null,

  loadTasks: async (filter?: TaskListFilter) => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.db.listTasks(filter);
      if (response.success && response.data) {
        set({ tasks: response.data, loading: false });
      } else {
        set({ error: response.error ?? 'Failed to load tasks', loading: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  createTask: async (input: CreateTaskInput) => {
    const response = await window.api.db.createTask(input);
    // Do NOT optimistically add to state — the sync broadcast from main
    // process handles insertion. Optimistic update races with sync and
    // causes duplicate tasks when sync arrives before the IPC response.
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  },

  updateTask: async (id: string, input: UpdateTaskInput) => {
    const response = await window.api.db.updateTask(id, input);
    if (response.success && response.data) {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? response.data! : t)),
      }));
      return response.data;
    }
    return null;
  },

  deleteTask: async (id: string) => {
    const response = await window.api.db.deleteTask(id);
    if (response.success) {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
      return true;
    }
    return false;
  },

  handleSync: (event: DBSyncEvent) => {
    if (event.table !== 'tasks') return;

    const { tasks } = get();

    switch (event.action) {
      case 'insert': {
        if (event.payload) {
          const newTasks = Array.isArray(event.payload) ? event.payload : [event.payload];
          set({
            tasks: [
              ...tasks,
              ...newTasks.filter(
                (nt: TaskRow) => !tasks.some((t) => t.id === nt.id)
              ),
            ],
          });
        } else {
          get().loadTasks();
        }
        break;
      }

      case 'update': {
        if (event.payload) {
          const updated = Array.isArray(event.payload) ? event.payload[0] : event.payload;
          if (updated) {
            set({
              tasks: tasks.map((t) =>
                t.id === (updated as TaskRow).id ? (updated as TaskRow) : t
              ),
            });
          }
        } else {
          get().loadTasks();
        }
        break;
      }

      case 'delete': {
        set({
          tasks: tasks.filter((t) => !event.ids.includes(t.id)),
        });
        break;
      }
    }
  },

  initSync: () => {
    const unsubscribe = window.api.app.onSync((event) => {
      get().handleSync(event);
    });
    set({ syncUnsubscribe: unsubscribe });
  },

  cleanup: () => {
    const { syncUnsubscribe } = get();
    if (syncUnsubscribe) {
      syncUnsubscribe();
    }
  },

  migrateTasksToToday: async (taskIds: string[]) => {
    const today = new Date();
    today.setHours(23, 59, 0, 0);
    const todayDue = today.getTime();

    const results = await Promise.allSettled(
      taskIds.map((id) => window.api.db.updateTask(id, { due_time: todayDue }))
    );

    // Reload from server to get updated data
    const response = await window.api.db.listTasks();
    if (response.success && response.data) {
      set({ tasks: response.data });
    }
  },
}));
