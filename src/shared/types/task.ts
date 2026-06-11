export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '待开始',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.PAUSED]: '暂停',
  [TaskStatus.DONE]: '已完成',
  [TaskStatus.CANCELLED]: '已取消',
};

export enum Priority {
  P1 = 1,
  P2 = 2,
  P3 = 3,
  P4 = 4,
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.P1]: 'P1',
  [Priority.P2]: 'P2',
  [Priority.P3]: 'P3',
  [Priority.P4]: 'P4',
};

export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; badge: string }> = {
  [Priority.P1]: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', badge: 'destructive' as const },
  [Priority.P2]: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', badge: 'default' as const },
  [Priority.P3]: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', badge: 'secondary' as const },
  [Priority.P4]: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', badge: 'outline' as const },
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  [Priority.P1]: 0,
  [Priority.P2]: 1,
  [Priority.P3]: 2,
  [Priority.P4]: 3,
};

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  start_time: number | null;
  due_time: number | null;
  reminder_time: number | null;
  recurrence_type: string | null;
  category_id: string | null;
  parent_id: string | null;
  sort: number;
  estimated_pomodoro: number;
  ai_meta: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateTaskInput {
  id?: string;
  title: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  progress?: number;
  start_time?: number | null;
  due_time?: number | null;
  reminder_time?: number | null;
  recurrence_type?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
  sort?: number;
  estimated_pomodoro?: number;
  ai_meta?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  progress?: number;
  start_time?: number | null;
  due_time?: number | null;
  reminder_time?: number | null;
  recurrence_type?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
  sort?: number;
  estimated_pomodoro?: number;
  ai_meta?: string | null;
}

export interface TaskListFilter {
  status?: TaskStatus;
  priority?: Priority;
  category_id?: string;
  parent_id?: string | null;
  search?: string;
  tag_ids?: string[];
}