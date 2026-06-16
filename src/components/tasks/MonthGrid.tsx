import React, { useMemo } from 'react';
import type { TaskRow } from '../../shared/types/database';
import { Priority } from '../../shared/types/database';

interface MonthGridProps {
  tasks: TaskRow[];
}

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

const DOT_COLORS: Record<Priority, string> = {
  [Priority.P1]: 'bg-red-500',
  [Priority.P2]: 'bg-orange-500',
  [Priority.P3]: 'bg-blue-500',
  [Priority.P4]: 'bg-gray-400',
};

function getTasksForDate(tasks: TaskRow[], dateStr: string): TaskRow[] {
  return tasks.filter((t) => t.target_date === dateStr);
}

function getPrioritiesForDate(tasks: TaskRow[], dateStr: string): Priority[] {
  const priorities = getTasksForDate(tasks, dateStr).map((t) => t.priority);
  return [...new Set(priorities)].slice(0, 4);
}

export const MonthGrid: React.FC<MonthGridProps> = ({ tasks }) => {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  const days: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const dotsMap = useMemo(() => {
    const map = new Map<string, Priority[]>();
    for (const task of tasks) {
      if (!task.target_date) continue;
      const [y, m] = task.target_date.split('-').map(Number);
      if (y === year && m === month + 1) {
        if (!map.has(task.target_date)) {
          map.set(task.target_date, getPrioritiesForDate(tasks, task.target_date));
        }
      }
    }
    return map;
  }, [tasks, year, month]);

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return getTasksForDate(tasks, selectedDate);
  }, [tasks, selectedDate]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    return `${m}月${d}日`;
  }, [selectedDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1)}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          ← 上月
        </button>
        <span className="text-base font-semibold text-foreground">
          {year}年{month + 1}月
        </span>
        <button
          onClick={() => month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1)}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          下月 →
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center mb-2">
        {WEEKDAYS_ZH.map((w) => (
          <span key={w} className="text-xs text-muted-foreground py-2 font-medium">{w}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5 auto-rows-fr">
        {days.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dots = dotsMap.get(dateStr) || [];

          return (
            <button
              key={d}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`flex flex-col items-center rounded-xl p-2 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-primary/20 ring-2 ring-primary/50'
                  : isToday
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : 'hover:bg-accent'
              }`}
            >
              <span className={`text-sm font-semibold ${isToday || isSelected ? 'text-primary' : 'text-foreground'}`}>
                {d}
              </span>
              {/* Priority dots */}
              {dots.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {dots.map((p) => (
                    <span key={p} className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[p]}`} />
                  ))}
                </div>
              )}
              {/* Task count */}
              {dots.length > 0 && (
                <span className="text-[10px] text-muted-foreground mt-1">
                  {dots.length > 3 ? `${dots.length}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day task list */}
      {selectedDate && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">
              📅 {selectedDateLabel}
            </span>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              关闭
            </button>
          </div>
          {selectedTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">当天无任务</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {selectedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-accent"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      DOT_COLORS[task.priority] || 'bg-gray-400'
                    }`}
                  />
                  <span className="text-foreground truncate flex-1">{task.title}</span>
                  {task.progress > 0 && (
                    <span className="text-muted-foreground flex-shrink-0">{task.progress}%</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today button */}
      <button
        onClick={() => {
          const t = new Date();
          setYear(t.getFullYear());
          setMonth(t.getMonth());
          setSelectedDate(null);
        }}
        className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground rounded-lg py-1.5 transition-colors"
      >
        回到今天
      </button>
    </div>
  );
};
