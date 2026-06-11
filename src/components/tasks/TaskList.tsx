import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Search, ListTodo, Tag, X } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useCategoryStore } from '../../store/useCategoryStore';
import { useTagStore } from '../../store/useTagStore';
import { TaskItem } from './TaskItem';
import { TaskSkeleton } from '../ui/Skeleton';
import { TaskForm } from './TaskForm';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import type { TaskRow, CreateTaskInput, UpdateTaskInput } from '../../shared/types/database';
import { TaskStatus, TASK_STATUS_LABELS, Priority, PRIORITY_ORDER } from '../../shared/types/database';

interface TaskListProps {
  categoryId: string | null;
  dragOverId: string | null;
}

function buildTree(tasks: TaskRow[]): TaskRow[] {
  // Sort by priority (P1 first), then by sort order
  const sorted = [...tasks].sort((a, b) => {
    if (a.parent_id !== b.parent_id) return 0;
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
  const { tags, selectedTagIds, loadTags, toggleSelectedTag, clearTagFilter } = useTagStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  // Reload tasks with tag filter when selection changes
  useEffect(() => {
    loadTasks({ tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined });
  }, [selectedTagIds]);

  // Filter and sort tasks (client-side filters on the already-filtered list)
  const displayTasks = useMemo(() => {
    let result = [...tasks];

    if (categoryId) {
      result = result.filter((t) => t.category_id === categoryId);
    }
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term)
      );
    }

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

  const handleStatusChange = useCallback(
    (task: TaskRow, newStatus: TaskStatus, progress?: number) => {
      updateTask(task.id, {
        status: newStatus,
        progress: progress ?? (newStatus === TaskStatus.DONE ? 100 : task.progress),
      });
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
    if (window.confirm('确定要删除这条任务吗？如果有子任务也会失去关联。')) {
      await deleteTask(id);
    }
  };

  const taskIds = useMemo(() => displayTasks.map((t) => t.id), [displayTasks]);

  const counts = {
    total: tasks.filter((t) => !categoryId || t.category_id === categoryId).length,
    todo: tasks.filter(
      (t) =>
        (!categoryId || t.category_id === categoryId) &&
        t.status === TaskStatus.TODO
    ).length,
    inProgress: tasks.filter(
      (t) =>
        (!categoryId || t.category_id === categoryId) &&
        t.status === TaskStatus.IN_PROGRESS
    ).length,
    done: tasks.filter(
      (t) =>
        (!categoryId || t.category_id === categoryId) &&
        t.status === TaskStatus.DONE
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditingTask(null); setParentId(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4" /> 新建任务
          </Button>
        </div>
      </div>

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
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: '全部状态' },
            ...Object.values(TaskStatus)
              .filter((v): v is TaskStatus => typeof v === 'string')
              .map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
          ]}
        />
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
        ) : displayTasks.length === 0 ? (
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
              {displayTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  depth={depthMap.get(task.id) ?? 0}
                  isDropTarget={dragOverId === task.id}
                  isNextStep={nextStepIds.has(task.id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onCopy={handleCopy}
                  onStatusChange={handleStatusChange}
                />
              ))}
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
      />
    </div>
  );
};
