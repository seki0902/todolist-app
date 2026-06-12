import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock, Edit2, Trash2, Copy, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import type { TaskRow } from '../../shared/types/database';
import { Priority, TaskStatus, getPriorityLabel } from '../../shared/types/database';
import { Badge } from '../ui/Badge';
import { useTagStore } from '../../store/useTagStore';

interface TaskItemProps {
  task: TaskRow;
  depth?: number;
  isDropTarget?: boolean;
  isNextStep?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  completedChildCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onEdit: (task: TaskRow) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onCopy: (task: TaskRow) => void;
  onProgressChange: (task: TaskRow, progress: number) => void;
  onToggleDone: (task: TaskRow) => void;
}

const priorityVariant = {
  [Priority.P1]: 'destructive' as const,
  [Priority.P2]: 'default' as const,
  [Priority.P3]: 'secondary' as const,
  [Priority.P4]: 'outline' as const,
};

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  depth = 0,
  isDropTarget = false,
  isNextStep = false,
  hasChildren = false,
  childCount = 0,
  completedChildCount = 0,
  isExpanded = true,
  onToggleExpand,
  onEdit,
  onDelete,
  onRestore,
  onCopy,
  onProgressChange,
  onToggleDone,
}) => {
  const tags = useTagStore((s) => s.taskTags[task.id] ?? []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : task.status === TaskStatus.CANCELLED ? 0.5 : 1,
  };

  const isDone = task.status === TaskStatus.DONE;
  const isCancelled = task.status === TaskStatus.CANCELLED;
  const isInProgress = task.status === TaskStatus.IN_PROGRESS;

  const handleProgressChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDone || isCancelled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    onProgressChange(task, pct);
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDone || isCancelled) return;
    e.preventDefault();
    const bar = e.currentTarget;
    const updateFromMouse = (moveEvent: MouseEvent) => {
      const rect = bar.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
      onProgressChange(task, pct);
    };
    const cleanup = () => {
      document.removeEventListener('mousemove', updateFromMouse);
      document.removeEventListener('mouseup', cleanup);
    };
    document.addEventListener('mousemove', updateFromMouse);
    document.addEventListener('mouseup', cleanup);
  };

  const progressColor = isDone
    ? 'bg-emerald-500'
    : isInProgress
      ? 'bg-blue-500'
      : 'bg-primary';

  const progressBg = isDone
    ? 'bg-emerald-100 dark:bg-emerald-950'
    : 'bg-secondary';

  const isParent = hasChildren && !isDone && !isCancelled;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginLeft: `${depth * 28}px` }}
      className={`group flex items-center gap-3 border transition-all duration-300 ease-out
        ${isParent
          ? 'rounded-xl border-2 border-primary/20 bg-primary/5 dark:bg-primary/10 shadow-sm p-3.5'
          : isDone
            ? 'rounded-xl border border-muted bg-muted/30 p-3'
            : depth > 0
              ? 'rounded-xl border border-border/60 bg-background/60 p-2.5 border-l-primary/30 border-l-2'
              : 'rounded-xl border border-border bg-card p-3 glass-card'
        }
        ${isDropTarget ? '!border-primary ring-2 ring-primary/30 scale-[1.02] !bg-primary/10' : ''}
        ${isDragging ? 'shadow-lg ring-2 ring-ring z-10 scale-[1.03]' : ''}
        ${isCancelled ? 'opacity-50' : ''}`}
    >
      {/* Collapse/Expand toggle for parent tasks */}
      {hasChildren ? (
        <button
          onClick={onToggleExpand}
          className="flex-shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
          title={isExpanded ? '折叠子任务' : '展开子任务'}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        /* Drag handle for non-parent or leaf tasks */
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Done checkbox — replaces old status cycle */}
      <button
        onClick={() => onToggleDone(task)}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isDone
            ? 'border-emerald-500 bg-emerald-500'
            : isCancelled
              ? 'border-gray-400 bg-gray-300 dark:bg-gray-600'
              : 'border-muted-foreground/30 hover:border-primary'
        }`}
        title={isDone ? '点击取消完成' : '点击完成任务'}
      >
        {isDone && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`truncate ${
              isDone || isCancelled
                ? 'line-through text-muted-foreground text-sm'
                : isParent
                  ? 'text-sm font-bold text-foreground'
                  : 'text-sm font-medium text-foreground'
            }`}
          >
            {task.title}
          </span>
          <Badge variant={priorityVariant[task.priority]}>{getPriorityLabel(task.priority)}</Badge>
          {/* Child count badge for parent tasks */}
          {hasChildren && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              completedChildCount === childCount && childCount > 0
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
            }`}>
              📋 {completedChildCount}/{childCount}
            </span>
          )}
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
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {task.description}
          </p>
        )}
        {/* Draggable progress bar */}
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className={`flex-1 h-2 rounded-full ${progressBg} ${!isDone && !isCancelled ? 'cursor-pointer' : ''} group/progress relative`}
            onClick={handleProgressChange}
            onMouseDown={handleProgressDrag}
          >
            <div
              className={`h-full rounded-full ${progressColor} transition-[width] duration-75 relative`}
              style={{ width: `${task.progress}%` }}
            >
              {!isDone && !isCancelled && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-sm opacity-0 group-hover/progress:opacity-100 transition-opacity cursor-ew-resize" />
              )}
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
