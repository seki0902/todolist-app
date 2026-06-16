import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../useTaskStore';
import type { TaskRow, CreateTaskInput, IPCResponse } from '../../shared/types/database';

// Helper to build a mock task row
function mockTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    priority: 3,
    status: 'todo',
    progress: 0,
    start_time: null,
    due_time: null,
    reminder_time: null,
    recurrence_type: null,
    recurrence_days: null,
    category_id: null,
    parent_id: null,
    sort: 0,
    estimated_pomodoro: 0,
    ai_meta: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

describe('useTaskStore — createTask', () => {
  beforeEach(() => {
    // Reset store state between tests
    useTaskStore.setState({ tasks: [], loading: false, error: null });
  });

  it('creates a task without duplicating it in state', async () => {
    const newTask = mockTask({ id: 'new-1', title: 'Buy milk' });

    // Mock the IPC call: returns success
    const createSpy = vi.spyOn(window.api.db, 'createTask').mockResolvedValue({
      success: true,
      data: newTask,
    } as IPCResponse<TaskRow>);

    // Simulate sync event arriving AFTER IPC response
    const store = useTaskStore.getState();
    await store.createTask({ title: 'Buy milk' } as CreateTaskInput);

    // Now simulate sync insert arriving (main process broadcast)
    useTaskStore.getState().handleSync({
      table: 'tasks',
      action: 'insert',
      ids: ['new-1'],
      payload: newTask,
    });

    const tasks = useTaskStore.getState().tasks;
    const matching = tasks.filter((t) => t.id === 'new-1');

    expect(matching).toHaveLength(1);
    createSpy.mockRestore();
  });

  it('de-duplicates when sync insert arrives before optimistic update', async () => {
    const newTask = mockTask({ id: 'new-2', title: 'Sync first' });

    // Setup: sync arrives BEFORE the invoke resolves
    let resolveInvoke!: (value: IPCResponse<TaskRow>) => void;
    const invokePromise = new Promise<IPCResponse<TaskRow>>((resolve) => {
      resolveInvoke = resolve;
    });
    vi.spyOn(window.api.db, 'createTask').mockReturnValue(invokePromise as any);

    // Fire createTask
    const createPromise = useTaskStore.getState().createTask({ title: 'Sync first' });

    // Sync arrives first
    useTaskStore.getState().handleSync({
      table: 'tasks',
      action: 'insert',
      ids: ['new-2'],
      payload: newTask,
    });

    // Now resolve the IPC
    resolveInvoke!({ success: true, data: newTask });

    await createPromise;

    const tasks = useTaskStore.getState().tasks;
    const matching = tasks.filter((t) => t.id === 'new-2');
    expect(matching).toHaveLength(1);
  });
});
