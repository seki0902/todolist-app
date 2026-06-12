import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Search, ListTodo, Tag, X, Calendar } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useCategoryStore } from '../../store/useCategoryStore';
import { useTagStore } from '../../store/useTagStore';
import { DayStrip } from './DayStrip';
import { TaskItem } from './TaskItem';
import { TaskSkeleton } from '../ui/Skeleton';
import { TaskForm } from './TaskForm';
import { Button } from '../ui/Button';
import type { TaskRow, CreateTaskInput, UpdateTaskInput } from '../../shared/types/database';
import { TaskStatus, Priority, PRIORITY_ORDER } from '../../shared/types/database';

interface TaskListProps {
  categoryId: string | null;
  dragOverId: string | null;
}

function buildTree(tasks: TaskRow[]): TaskRow[] {
  // Sort non-done by priority first, then done tasks to the bottom
  const sorted = [...tasks].sort((a, b) => {
    // Different parents → don't reorder across trees (parent order matters for nesting)
    if (a.parent_id !== b.parent_id) return 0;
    // Done tasks go last
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    // Cancelled also at bottom (but above done)
    const aCancelled = a.status === 'cancelled' ? 1 : 0;
    const bCancelled = b.status === 'cancelled' ? 1 : 0;
    if (aCancelled !== bCancelled) return aCancelled - bCancelled;
    // Within same status group, sort by priority then sort order
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.sort - b.sort;
  });

  // Build tree: parents first, children nested after
  const roots: TaskRow[] = [];
  const childrenMap = new Map<string, TaskRow[]>();

  for (const task of sorted) {
    if (!task.parent_id) {
      roots.push(task);
    } else {
      const siblings = childrenMap.get(task.parent_id) || [];
      siblings.push(task);
      childrenMap.set(task.parent_id, siblings);
    }
  }

  // Flatten tree with depth info
  const flattened: { task: TaskRow; depth: number }[] = [];
  function flatten(parents: TaskRow[], depth: number) {
    for (const task of parents) {
      flattened.push({ task, depth });
      const children = childrenMap.get(task.id);
      if (children && children.length > 0) {
        flatten(children, depth + 1);
      }
    }
  }
  flatten(roots, 0);
  return flattened.map((f) => f.task);
}

// Get child info for a parent task
function getChildInfo(tasks: TaskRow[], parentId: string): { count: number; completed: number } {
  const children = tasks.filter((t) => t.parent_id === parentId);
  const completed = children.filter((t) => t.status === 'done' || t.status === 'cancelled').length;
  return { count: children.length, completed };
}

export const TaskList: React.FC<TaskListProps> = ({ categoryId, dragOverId }) => {
  const {
    tasks,
    loading,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
  } = useTaskStore();
  const { categories } = useCategoryStore();
  const { tags, selectedTagIds, loadTags, loadTaskTags, toggleSelectedTag, clearTagFilter } = useTagStore();

  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [miniCalOpen, setMiniCalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  // Reload tasks with tag filter when selection changes
  useEffect(() => {
    loadTasks({ tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined, due_date: selectedDate ?? undefined });
  }, [selectedTagIds]);

  // Reload tasks when date filter changes
  useEffect(() => {
    loadTasks({ tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined, due_date: selectedDate ?? undefined });
  }, [selectedDate]);

  // Batch load tags for all visible tasks (replaces per-item N+1 queries)
  useEffect(() => {
    const ids = tasks.map((t) => t.id);
    if (ids.length > 0) loadTaskTags(ids);
  }, [tasks]);

  // Filter and sort tasks (client-side filters on the already-filtered list)
  const displayTasks = useMemo(() => {
    let result = [...tasks];

    if (categoryId) {
      result = result.filter((t) => t.category_id === categoryId);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term)
      );
    }

    // Hide cancelled tasks by default (soft delete)
    if (!showCancelled) {
      result = result.filter((t) => t.status !== TaskStatus.CANCELLED);
    }

    // Hide completed tasks that were done before today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    result = result.filter((t) => {
      if (t.status !== TaskStatus.DONE) return true;
      // Only keep done tasks completed today, or with due_time today/future
      if (t.updated_at >= todayStart.getTime()) return true;
      if (t.due_time && t.due_time >= todayStart.getTime()) return true;
      return false;
    });

    return buildTree(result);
  }, [tasks, categoryId, statusFilter, search]);

  // Build depth map and next-step map for TaskItem
  const { depthMap, nextStepIds } = useMemo(() => {
    const depthMap = new Map<string, number>();
    const nextStepIds = new Set<string>();
    const childrenMap = new Map<string, TaskRow[]>();

    for (const task of displayTasks) {
      if (!task.parent_id) {
        depthMap.set(task.id, 0);
      } else {
        const siblings = childrenMap.get(task.parent_id) || [];
        siblings.push(task);
        childrenMap.set(task.parent_id, siblings);
      }
    }

    function assignDepth(parents: TaskRow[], depth: number) {
      for (const task of parents) {
        depthMap.set(task.id, depth);
        const children = childrenMap.get(task.id);
        if (children) {
          // Mark the first non-done child as "next step"
          const nextChild = children.find(
            (c) => c.status !== 'done' && c.status !== 'cancelled'
          );
          if (nextChild) nextStepIds.add(nextChild.id);
          assignDepth(children, depth + 1);
        }
      }
    }

    const roots = displayTasks.filter((t) => !t.parent_id);
    assignDepth(roots, 0);
    return { depthMap, nextStepIds };
  }, [displayTasks]);

  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((taskId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleProgressChange = useCallback(
    (task: TaskRow, progress: number) => {
      // Auto-set status: drag progress → in_progress, progress=100 → done
      let newStatus = task.status;
      if (progress === 100) {
        newStatus = TaskStatus.DONE;
      } else if (progress > 0 && task.status === TaskStatus.TODO) {
        newStatus = TaskStatus.IN_PROGRESS;
      } else if (progress < 100 && task.status === TaskStatus.DONE) {
        newStatus = TaskStatus.IN_PROGRESS;
      }
      updateTask(task.id, { progress, status: newStatus });
    },
    [updateTask]
  );

  const handleToggleDone = useCallback(
    (task: TaskRow) => {
      if (task.status === TaskStatus.DONE) {
        updateTask(task.id, { status: TaskStatus.TODO, progress: Math.min(task.progress, 99) });
      } else {
        updateTask(task.id, { status: TaskStatus.DONE, progress: 100 });
      }
    },
    [updateTask]
  );

  const handleSave = async (
    data: CreateTaskInput | { id: string; input: UpdateTaskInput }
  ) => {
    if ('id' in data) {
      await updateTask(data.id, { ...data.input, parent_id: parentId || data.input.parent_id });
    } else {
      await createTask({ ...data, parent_id: parentId || data.parent_id });
    }
    setFormOpen(false);
    setEditingTask(null);
    setParentId(null);
  };

  const handleEdit = (task: TaskRow) => {
    setEditingTask(task);
    setParentId(task.parent_id);
    setFormOpen(true);
  };

  const handleCopy = async (task: TaskRow) => {
    await createTask({
      title: `${task.title} (副本)`,
      description: task.description,
      priority: task.priority,
      category_id: task.category_id,
      parent_id: task.parent_id,
      estimated_pomodoro: task.estimated_pomodoro,
    });
  };

  const handleDelete = async (id: string) => {
    // Soft delete: archive to cancelled instead of physical deletion
    await updateTask(id, { status: TaskStatus.CANCELLED, progress: 0 });
  };

  const handleRestore = async (id: string) => {
    await updateTask(id, { status: TaskStatus.TODO, progress: 0 });
  };

  // Filter out collapsed children from display
  const visibleTasks = useMemo(() => {
    const collapsedChildIds = new Set<string>();
    for (const task of displayTasks) {
      if (task.parent_id && collapsedParents.has(task.parent_id)) {
        collapsedChildIds.add(task.id);
      }
    }
    return displayTasks.filter((t) => !collapsedChildIds.has(t.id));
  }, [displayTasks, collapsedParents]);

  const taskIds = useMemo(() => visibleTasks.map((t) => t.id), [visibleTasks]);

  const counts = {
    total: tasks.filter((t) => !categoryId || t.category_id === categoryId).length,
    todo: tasks.filter(
      (t) =>
        (!categoryId || t.category_id === categoryId) &&
        t.status !== TaskStatus.CANCELLED && t.progress === 0
    ).length,
    inProgress: tasks.filter(
      (t) =>
        (!categoryId || t.category_id === categoryId) &&
        t.status !== TaskStatus.CANCELLED && t.progress > 0 && t.progress < 100
    ).length,
    done: tasks.filter(
      (t) =>
        (!categoryId || t.category_id === categoryId) &&
        (t.progress >= 100 || t.status === TaskStatus.DONE)
    ).length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg font-semibold text-foreground">任务列表</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} 个任务 · {counts.todo} 待办 · {counts.inProgress} 进行中 · {counts.done} 已完成
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mini month picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMiniCalOpen(!miniCalOpen)}
              title="选择日期筛选"
            >
              <Calendar className="h-4 w-4" />
              {selectedDate && (
                <span className="ml-1 text-xs text-primary">
                  {new Date(selectedDate).getDate()}日
                </span>
              )}
            </Button>
            {miniCalOpen && (
              <MiniMonthPicker
                selectedDate={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d);
                  setMiniCalOpen(false);
                  if (d) {
                    setSearch('');
                    loadTasks();
                  }
                }}
                onClose={() => setMiniCalOpen(false)}
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditingTask(null); setParentId(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4" /> 新建任务
          </Button>
        </div>
      </div>

      <DayStrip tasks={tasks} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..."
            className="flex h-8 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowCancelled(!showCancelled)}
          className={`text-xs rounded-lg px-2.5 py-1 transition-colors ${
            showCancelled
              ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {showCancelled ? '隐藏已归档' : '显示已归档'}
        </button>
        {/* Tag filter chips */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleSelectedTag(tag.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {tag.name}
                  {isSelected && <X className="h-3 w-3" />}
                </button>
              );
            })}
            {selectedTagIds.length > 0 && (
              <button
                onClick={clearTagFilter}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                清除
              </button>
            )}
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="px-6 py-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <TaskSkeleton key={i} />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ListTodo className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">暂无任务</p>
            <p className="text-xs mt-1">点击"新建任务"开始</p>
          </div>
        ) : (
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 stagger">
              {visibleTasks.map((task) => {
                const childInfo = getChildInfo(tasks, task.id);
                const hasChildren = childInfo.count > 0;
                return (
                  <TaskItem
                    key={task.id}
                    task={task}
                    depth={depthMap.get(task.id) ?? 0}
                    isDropTarget={dragOverId === task.id}
                    isNextStep={nextStepIds.has(task.id)}
                    hasChildren={hasChildren}
                    childCount={childInfo.count}
                    completedChildCount={childInfo.completed}
                    isExpanded={!collapsedParents.has(task.id)}
                    onToggleExpand={() => handleToggleExpand(task.id)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onCopy={handleCopy}
                    onProgressChange={handleProgressChange}
                    onToggleDone={handleToggleDone}
                  />
                );
              })}
            </div>
          </SortableContext>
        )}
      </div>

      {/* Task Form Modal */}
      <TaskForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(null); setParentId(null); }}
        onSave={handleSave}
        task={editingTask}
        categories={categories}
        defaultCategoryId={categoryId ?? undefined}
      />
    </div>
  );
};

// Inline mini month picker for filtering tasks by date
const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

const MiniMonthPicker: React.FC<{
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
}> = ({ selectedDate, onSelect, onClose }) => {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  const days: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="absolute top-full right-0 mt-1 z-20 w-64 rounded-xl border border-border bg-card p-3 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          ‹
        </button>
        <span className="text-sm font-medium">
          {year}年{month + 1}月
        </span>
        <button
          onClick={() => month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS_ZH.map((w) => (
          <span key={w} className="text-[10px] text-muted-foreground py-1">{w}</span>
        ))}
        {days.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={d}
              onClick={() => {
                if (isSelected) {
                  onSelect(null);
                } else {
                  onSelect(dateStr);
                }
              }}
              className={`rounded-full w-7 h-7 text-xs transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'hover:bg-accent text-foreground'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <button
          onClick={() => onSelect(null)}
          className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
        >
          清除日期筛选
        </button>
      )}
    </div>
  );
};
