import React, { useState, useMemo } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import type { TaskRow } from '../../shared/types/database';
import { Priority, TaskStatus } from '../../shared/types/database';

interface DailyMigrationDialogProps {
  open: boolean;
  yesterdayTasks: TaskRow[];
  onSkip: () => void;
  onMigrate: (taskIds: string[]) => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: '待开始',
  in_progress: '进行中',
  paused: '暂停',
};

const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-blue-500',
  4: 'text-gray-400',
};

export const DailyMigrationDialog: React.FC<DailyMigrationDialogProps> = ({
  open,
  yesterdayTasks,
  onSkip,
  onMigrate,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(yesterdayTasks.map((t) => t.id))
  );

  const toggleTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(yesterdayTasks.map((t) => t.id)));
  const deselectAll = () => setSelectedIds(new Set());

  return (
    <Dialog open={open} onClose={onSkip} title="👋 新的一天">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          昨天有{' '}
          <span className="font-semibold text-foreground">{yesterdayTasks.length}</span>{' '}
          个任务未完成，是否移动到今天继续？
        </p>

        <div className="max-h-64 overflow-y-auto space-y-1.5">
          {yesterdayTasks.map((task) => {
            const isSelected = selectedIds.has(task.id);
            return (
              <label
                key={task.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:bg-accent/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTask(task.id)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-0"
                />
                <span className="text-sm flex-1 truncate">{task.title}</span>
                <span className={`text-xs font-bold ${PRIORITY_COLORS[task.priority] ?? 'text-muted-foreground'}`}>
                  P{task.priority}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            全选
          </button>
          <button
            onClick={deselectAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            取消全选
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            已选 {selectedIds.size}/{yesterdayTasks.length}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onSkip}>
            跳过
          </Button>
          <Button
            onClick={() => onMigrate(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
          >
            移动到今天
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
