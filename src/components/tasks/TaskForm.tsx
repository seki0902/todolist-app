import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import type { TaskRow, CreateTaskInput, UpdateTaskInput, CategoryRow } from '../../shared/types/database';
import { Priority, PRIORITY_LABELS, TaskStatus, TASK_STATUS_LABELS } from '../../shared/types/database';
import { TagSelect } from './TagSelect';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: CreateTaskInput | { id: string; input: UpdateTaskInput }) => void;
  task?: TaskRow | null;
  categories: CategoryRow[];
}

export const TaskForm: React.FC<TaskFormProps> = ({
  open,
  onClose,
  onSave,
  task,
  categories,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.P3);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [categoryId, setCategoryId] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('');
  const [pomodoro, setPomodoro] = useState(0);

  const isEdit = !!task;

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description);
        setPriority(task.priority);
        setStatus(task.status);
        setCategoryId(task.category_id ?? '');
        setDueTime(task.due_time ? toDatetimeLocal(task.due_time) : '');
        setRecurrenceType(task.recurrence_type ?? '');
        setPomodoro(task.estimated_pomodoro);
      } else {
        setTitle('');
        setDescription('');
        setPriority(Priority.P3);
        setStatus(TaskStatus.TODO);
        setCategoryId('');
        setDueTime('');
        setRecurrenceType('');
        setPomodoro(1);
      }
    }
  }, [open, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const baseInput = {
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      category_id: categoryId || null,
      due_time: dueTime ? new Date(dueTime).getTime() : null,
      recurrence_type: recurrenceType || null,
      estimated_pomodoro: pomodoro,
    };

    if (isEdit && task) {
      onSave({ id: task.id, input: baseInput } as { id: string; input: UpdateTaskInput });
    } else {
      onSave(baseInput as CreateTaskInput);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? '编辑任务' : '新建任务'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="任务名称"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入任务名称..."
          autoFocus
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="添加任务描述（可选）"
            rows={3}
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="优先级"
            value={String(priority)}
            onChange={(v) => setPriority(Number(v) as Priority)}
            options={Object.values(Priority)
              .filter((v): v is Priority => typeof v === 'number')
              .map((p) => ({
                value: String(p),
                label: `${PRIORITY_LABELS[p]} ${
                  p === Priority.P1 ? '🔴' : p === Priority.P2 ? '🟠' : p === Priority.P3 ? '🔵' : '⚪'
                }`,
              }))}
          />
          <Select
            label="状态"
            value={status}
            onChange={(v) => setStatus(v as TaskStatus)}
            options={Object.values(TaskStatus).map((s) => ({
              value: s,
              label: TASK_STATUS_LABELS[s],
            }))}
          />
        </div>
        <Select
          label="分类"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: '', label: '无分类' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="截止日期"
            type="datetime-local"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              🍅 番茄钟（可选）
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={pomodoro}
              onChange={(e) => setPomodoro(Math.max(1, Number(e.target.value)))}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <Select
          label="🔁 重复"
          value={recurrenceType}
          onChange={setRecurrenceType}
          options={[
            { value: '', label: '不重复' },
            { value: 'daily', label: '每天' },
            { value: 'weekly', label: '每周' },
            { value: 'monthly', label: '每月' },
            { value: 'yearly', label: '每年' },
          ]}
        />
        {isEdit && task && (
          <TagSelect taskId={task.id} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">
            {isEdit ? '保存' : '创建任务'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

function toDatetimeLocal(timestamp: number): string {
  const d = new Date(timestamp);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
