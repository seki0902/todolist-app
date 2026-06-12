import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import type { TaskRow, CreateTaskInput, UpdateTaskInput, CategoryRow } from '../../shared/types/database';
import { Priority, getPriorityLabel } from '../../shared/types/database';
import { TagSelect } from './TagSelect';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: CreateTaskInput | { id: string; input: UpdateTaskInput }) => void;
  task?: TaskRow | null;
  categories: CategoryRow[];
  defaultCategoryId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  open,
  onClose,
  onSave,
  task,
  categories,
  defaultCategoryId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.P3);
  const [categoryId, setCategoryId] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [pomodoro, setPomodoro] = useState(0);
  const [reminderOffset, setReminderOffset] = useState(0); // minutes before due_time

  const isEdit = !!task;

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description);
        setPriority(task.priority);
        setCategoryId(task.category_id ?? '');
        setDueTime(task.due_time ? toDatetimeLocal(task.due_time) : '');
        setRecurrenceType(task.recurrence_type ?? '');
        try {
          setRecurrenceDays(task.recurrence_days ? JSON.parse(task.recurrence_days) : []);
        } catch { setRecurrenceDays([]); }
        setPomodoro(task.estimated_pomodoro);
        // Reverse-compute reminder offset from stored reminder_time
        if (task.reminder_time && task.due_time) {
          const diffMin = Math.round((task.due_time - task.reminder_time) / 60000);
          const presets = [5, 15, 30, 60];
          setReminderOffset(presets.includes(diffMin) ? diffMin : 0);
        } else {
          setReminderOffset(0);
        }
      } else {
        setTitle('');
        setDescription('');
        setPriority(Priority.P3);
        setCategoryId(defaultCategoryId ?? '');
        setDueTime('');
        setRecurrenceType('');
        setRecurrenceDays([]);
        setPomodoro(0);
        setReminderOffset(0);
      }
    }
  }, [open, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const dueTimeValue = dueTime ? new Date(dueTime).getTime() : null;
    const reminderTimeValue = (reminderOffset > 0 && dueTimeValue) ? dueTimeValue - reminderOffset * 60 * 1000 : null;

    const baseInput = {
      title: title.trim(),
      description: description.trim(),
      priority,
      category_id: categoryId || null,
      due_time: dueTimeValue,
      reminder_time: reminderTimeValue,
      recurrence_type: recurrenceType || null,
      recurrence_days: recurrenceDays.length > 0 ? JSON.stringify(recurrenceDays) : null,
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
        <Select
          label="优先级"
          value={String(priority)}
          onChange={(v) => setPriority(Number(v) as Priority)}
          options={Object.values(Priority)
            .filter((v): v is Priority => typeof v === 'number')
            .map((p) => ({
              value: String(p),
              label: getPriorityLabel(p),
            }))}
        />
        <Select
          label="分类"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: '', label: '无分类' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Input
          label="截止日期"
          type="datetime-local"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">🔁 重复</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRecurrenceType('')}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                recurrenceType === '' || !recurrenceType
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              不重复
            </button>
            <button
              type="button"
              onClick={() => setRecurrenceType('weekly')}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                recurrenceType === 'weekly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              每周
            </button>
          </div>
          {recurrenceType === 'weekly' && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                { day: 1, label: '周一' },
                { day: 2, label: '周二' },
                { day: 3, label: '周三' },
                { day: 4, label: '周四' },
                { day: 5, label: '周五' },
                { day: 6, label: '周六' },
                { day: 0, label: '周日' },
              ].map(({ day, label }) => {
                const active = recurrenceDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setRecurrenceDays((prev) =>
                        prev.includes(day)
                          ? prev.filter((d) => d !== day)
                          : [...prev, day]
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Select
          label="⏰ 提醒"
          value={String(reminderOffset)}
          onChange={(v) => setReminderOffset(Number(v))}
          options={[
            { value: '0', label: '不提醒' },
            { value: '5', label: '5分钟前' },
            { value: '15', label: '15分钟前' },
            { value: '30', label: '30分钟前' },
            { value: '60', label: '1小时前' },
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
