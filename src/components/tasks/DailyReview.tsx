import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import type { TaskRow } from '../../shared/types/database';

interface DailyReviewProps {
  yesterdayTasks: TaskRow[];
  onSkip: () => void;
  onMigrate: (taskIds: string[]) => void;
}

const PRIORITY_BG: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-blue-500',
  4: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  todo: '待开始',
  in_progress: '进行中',
  paused: '暂停',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '🌙 夜深了';
  if (h < 12) return '👋 早上好';
  if (h < 18) return '☀️ 下午好';
  return '🌆 晚上好';
}

export const DailyReview: React.FC<DailyReviewProps> = ({
  yesterdayTasks,
  onSkip,
  onMigrate,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(yesterdayTasks.map((t) => t.id))
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

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[today.getDay()];

  const stats = useMemo(() => {
    const totalPomodoros = yesterdayTasks.reduce(
      (sum, t) => sum + (t.estimated_pomodoro || 0), 0
    );
    const avgProgress = yesterdayTasks.length > 0
      ? Math.round(yesterdayTasks.reduce((sum, t) => sum + t.progress, 0) / yesterdayTasks.length)
      : 0;
    return {
      total: yesterdayTasks.length,
      pomodoros: totalPomodoros,
      avgProgress,
    };
  }, [yesterdayTasks]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}，新的一天
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {dateStr} · {weekday}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            跳过 →
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="px-8 mb-6 grid grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-red-500 tabular-nums">
            {stats.total}
          </div>
          <div className="text-xs text-muted-foreground mt-1">昨日遗留</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-primary tabular-nums">
            🍅 {stats.pomodoros}
          </div>
          <div className="text-xs text-muted-foreground mt-1">待完成番茄钟</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-500 tabular-nums">
            {stats.avgProgress}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">昨日平均进度</div>
        </div>
      </div>

      {/* Task list */}
      <div className="px-8 flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">
            选择要迁移到今天继续的任务
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button onClick={selectAll} className="hover:text-foreground transition-colors">
              全选
            </button>
            <button onClick={deselectAll} className="hover:text-foreground transition-colors">
              取消全选
            </button>
            <span>已选 {selectedIds.size}/{yesterdayTasks.length}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {yesterdayTasks.map((task) => {
            const isSelected = selectedIds.has(task.id);
            return (
              <label
                key={task.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
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
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block">
                    {task.title}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    {/* Mini progress bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {task.progress}%
                      </span>
                    </div>
                    {/* Pomodoro info */}
                    {task.estimated_pomodoro > 0 && (
                      <span className="text-xs text-muted-foreground">
                        🍅 {task.estimated_pomodoro}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0 ${
                    PRIORITY_BG[task.priority] || 'bg-gray-400'
                  }`}
                >
                  P{task.priority}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-8 py-5 border-t border-border mt-4">
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onSkip}>
            全部跳过
          </Button>
          <Button
            onClick={() => onMigrate(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
          >
            ✅ 确认迁移 ({selectedIds.size})
          </Button>
        </div>
      </div>
    </div>
  );
};
