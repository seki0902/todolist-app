import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock, Edit2, Trash2, Copy, Play, Pause, Check, RotateCcw } from 'lucide-react';
import type { TaskRow, TagRow } from '../../shared/types/database';
import { Priority, PRIORITY_LABELS, TaskStatus, TASK_STATUS_LABELS } from '../../shared/types/database';
import { Badge } from '../ui/Badge';
import { useTagStore } from '../../store/useTagStore';

interface TaskItemProps {
  task: TaskRow;
  depth?: number;
  isDropTarget?: boolean;
  isNextStep?: boolean;
  onEdit: (task: TaskRow) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onCopy: (task: TaskRow) => void;
  onStatusChange: (task: TaskRow, newStatus: TaskStatus, progress?: number) => void;
}

const priorityVariant = {
  [Priority.P1]: 'destructive' as const,
  [Priority.P2]: 'default' as const,
  [Priority.P3]: 'secondary' as const,
  [Priority.P4]: 'outline' as const,
};

const statusColor: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'border-muted-foreground/30',
  [TaskStatus.IN_PROGRESS]: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  [TaskStatus.PAUSED]: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
  [TaskStatus.DONE]: 'border-emerald-500 bg-emerald-500',
  [TaskStatus.CANCELLED]: 'border-gray-400 bg-gray-300 dark:bg-gray-600',
};

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  depth = 0,
  isDropTarget = false,
  isNextStep = false,
  onEdit,
  onDelete,
  onRestore,
  onCopy,
  onStatusChange,
}) => {
  const tags = useTagStore((s) => s.taskTags[task.id] ?? []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : task.status === TaskStatus.CANCELLED ? 0.5 : 1,
  };

  const isDone = task.status === TaskStatus.DONE;
  const isCancelled = task.status === TaskStatus.CANCELLED;
  const isInProgress = task.status === TaskStatus.IN_PROGRESS;

  const handleStatusClick = () => {
    // Smart cycle: cancelled/paused → todo, otherwise todo → in_progress → done → todo
    if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.PAUSED) {
      onStatusChange(task, TaskStatus.TODO);
      return;
    }
    const cycle: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
    const idx = cycle.indexOf(task.status);
    if (idx >= 0) {
      onStatusChange(task, cycle[(idx + 1) % cycle.length]);
    }
  };

  const handleProgressChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    onStatusChange(task, task.status, pct);
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const bar = e.currentTarget;
    const updateFromMouse = (moveEvent: MouseEvent) => {
      const rect = bar.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
      onStatusChange(task, task.status, pct);
    };
    const cleanup = () => {
      document.removeEventListener('mousemove', updateFromMouse);
      document.removeEventListener('mouseup', cleanup);
    };
    document.addEventListener('mousemove', updateFromMouse);
    document.addEventListener('mouseup', cleanup);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingLeft: `${depth * 24}px` }}
      className={`group flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 ease-out
        glass-card btn-lift ${
        isDropTarget ? '!border-primary ring-2 ring-primary/30 scale-[1.02] !bg-primary/10' : ''
      } ${
        isDragging ? 'shadow-lg ring-2 ring-ring z-10 scale-[1.03]' : ''
      } ${isCancelled ? 'opacity-50' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing touch-none flex-shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Status checkbox */}
      <button
        onClick={handleStatusClick}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          statusColor[task.status]
        } ${!isDone && !isCancelled ? 'hover:border-primary' : ''}`}
        title={TASK_STATUS_LABELS[task.status]}
      >
        {isDone && (
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${
              isDone || isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {task.title}
          </span>
          <Badge variant={priorityVariant[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
          {isNextStep && (
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 animate-pulse">
              ⏭ 下一步
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {tag.name}
            </span>
          ))}
          {isInProgress && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Play className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {task.description}
          </p>
        )}
        {/* Draggable progress bar (always visible) */}
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="flex-1 h-2 rounded-full bg-secondary cursor-pointer group/progress relative"
            onClick={handleProgressChange}
            onMouseDown={handleProgressDrag}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-75 relative"
              style={{ width: `${task.progress}%` }}
            >
              {/* Drag handle */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-sm opacity-0 group-hover/progress:opacity-100 transition-opacity cursor-ew-resize"
              />
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground w-8 text-right tabular-nums flex-shrink-0">
            {task.progress}%
          </span>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
        {task.due_time && (
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3" />
            {new Date(task.due_time).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isCancelled ? (
          onRestore ? (
            <button
              onClick={() => onRestore(task.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950"
              title="恢复"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null
        ) : (
          <>
            <button
              onClick={() => onStatusChange(task, TaskStatus.IN_PROGRESS)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
              title="开始"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onStatusChange(task, TaskStatus.PAUSED)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
              title="暂停"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onStatusChange(task, TaskStatus.DONE)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950"
              title="完成"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onCopy(task)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="复制"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onEdit(task)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="编辑"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title={isCancelled ? '永久删除' : '归档'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
