import React, { useMemo } from 'react';
import type { TaskRow } from '../../shared/types/database';
import { toLocalDateStr } from '../../shared/utils/date';

interface DayStripProps {
  tasks: TaskRow[];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const DayStrip: React.FC<DayStripProps> = ({ tasks }) => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const weekday = WEEKDAYS[today.getDay()];

  const todayTasks = useMemo(() => {
    const todayStr = toLocalDateStr(new Date());
    return tasks.filter(
      (t) =>
        t.target_date === todayStr &&
        t.progress < 100 &&
        t.status !== 'cancelled'
    );
  }, [tasks]);

  const doneToday = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.progress < 100 && t.status !== 'done') return false;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return t.updated_at >= todayStart.getTime();
      }),
    [tasks]
  );

  const total = todayTasks.length + doneToday.length;
  const done = doneToday.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background/50">
      <div className="flex items-center gap-2">
        <span className="text-lg">📅</span>
        <span className="text-sm font-semibold text-foreground">
          {month}月{day}日
        </span>
        <span className="text-xs text-muted-foreground">星期{weekday}</span>
      </div>
      <div className="flex-1 max-w-[200px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {done}/{total}
          </span>
        </div>
      </div>
    </div>
  );
};
