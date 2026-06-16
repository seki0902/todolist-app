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
  [Priority.P1]: '非常紧急',
  [Priority.P2]: '紧急',
  [Priority.P3]: '一般',
  [Priority.P4]: '不着急',
};

export type PriorityStyle = 'clean' | 'funny' | 'custom';

export const PRIORITY_LABELS_FUNNY: Record<Priority, string> = {
  [Priority.P1]: '🔥 火烧眉毛',
  [Priority.P2]: '⚡ 有点着急',
  [Priority.P3]: '📋 悠着来',
  [Priority.P4]: '🧘 随缘吧',
};

export const PRIORITY_LABELS_CLEAN: Record<Priority, string> = {
  [Priority.P1]: '🔴 非常紧急',
  [Priority.P2]: '🟠 紧急',
  [Priority.P3]: '🔵 一般',
  [Priority.P4]: '⚪ 不着急',
};

export function getPriorityLabel(priority: Priority, style?: PriorityStyle, customLabels?: Record<Priority, string>): string {
  const s = style ?? getStoredPriorityStyle();
  switch (s) {
    case 'funny': return PRIORITY_LABELS_FUNNY[priority];
    case 'custom': return customLabels?.[priority] ?? PRIORITY_LABELS_CLEAN[priority];
    default: return PRIORITY_LABELS_CLEAN[priority];
  }
}

export function getStoredPriorityStyle(): PriorityStyle {
  try {
    return (localStorage.getItem('focusflow-priority-style') as PriorityStyle) || 'clean';
  } catch { return 'clean'; }
}

export function setStoredPriorityStyle(style: PriorityStyle): void {
  try {
    localStorage.setItem('focusflow-priority-style', style);
  } catch {}
}

export function getStoredCustomPriorityLabels(): Record<Priority, string> | undefined {
  try {
    const raw = localStorage.getItem('focusflow-custom-priority-labels');
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

export function setStoredCustomPriorityLabels(labels: Record<Priority, string>): void {
  try {
    localStorage.setItem('focusflow-custom-priority-labels', JSON.stringify(labels));
  } catch {}
}

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
  recurrence_days: string | null;
  category_id: string | null;
  parent_id: string | null;
  sort: number;
  estimated_pomodoro: number;
  ai_meta: string | null;
  created_at: number;
  updated_at: number;
  target_date: string;  // 'YYYY-MM-DD'
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
  recurrence_days?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
  sort?: number;
  estimated_pomodoro?: number;
  ai_meta?: string | null;
  target_date?: string;
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
  recurrence_days?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
  sort?: number;
  estimated_pomodoro?: number;
  ai_meta?: string | null;
  target_date?: string;
}

export interface TaskListFilter {
  status?: TaskStatus;
  priority?: Priority;
  category_id?: string;
  parent_id?: string | null;
  search?: string;
  tag_ids?: string[];
  due_date?: string; // YYYY-MM-DD — filter tasks due on this date
}