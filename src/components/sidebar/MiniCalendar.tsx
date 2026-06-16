import React, { useMemo } from 'react';
import type { TaskRow } from '../../shared/types/database';
import { Priority } from '../../shared/types/database';

interface MiniCalendarProps {
  tasks: TaskRow[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onDateDoubleClick: (date: Date) => void;
}

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

function getDotsForDate(tasks: TaskRow[], dateStr: string): Priority[] {
  const priorities = tasks
    .filter((t) => {
      if (!t.due_time) return false;
      return new Date(t.due_time).toISOString().slice(0, 10) === dateStr;
    })
    .map((t) => t.priority);
  return [...new Set(priorities)].slice(0, 3);
}

const DOT_COLORS: Record<Priority, string> = {
  [Priority.P1]: 'bg-red-500',
  [Priority.P2]: 'bg-orange-500',
  [Priority.P3]: 'bg-blue-500',
  [Priority.P4]: 'bg-gray-400',
};

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  tasks,
  selectedDate,
  onSelectDate,
  onDateDoubleClick,
}) => {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  const days: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  // Pre-compute dot maps for all days this month (avoid repeated filter() on every render)
  const dotsMap = useMemo(() => {
    const map = new Map<string, Priority[]>();
    for (const task of tasks) {
      if (!task.due_time) continue;
      const d = new Date(task.due_time);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateStr = d.toISOString().slice(0, 10);
        if (!map.has(dateStr)) {
          map.set(dateStr, getDotsForDate(tasks, dateStr));
        }
      }
    }
    return map;
  }, [tasks, year, month]);

  const handleDateClick = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateStr === selectedDate) {
      onSelectDate(null);
    } else {
      onSelectDate(dateStr);
    }
  };

  const handleDateDoubleClick = (d: number) => {
    const date = new Date(year, month, d);
    date.setHours(23, 59, 0, 0);
    onDateDoubleClick(date);
  };

  return (
    <div className="px-3 py-3 border-t border-white/10 dark:border-white/5">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground text-xs"
        >
          ‹
        </button>
        <span className="text-xs font-medium text-foreground">
          {year}年{month + 1}月
        </span>
        <button
          onClick={() => month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground text-xs"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {WEEKDAYS_ZH.map((w) => (
          <span key={w} className="text-[10px] text-muted-foreground py-0.5">{w}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dots = dotsMap.get(dateStr) || [];

          return (
            <button
              key={d}
              onClick={() => handleDateClick(d)}
              onDoubleClick={() => handleDateDoubleClick(d)}
              className={`relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs transition-colors group ${
                isSelected
                  ? 'bg-primary/20 text-primary font-semibold ring-1 ring-primary/40'
                  : isToday
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-accent'
              }`}
            >
              {/* Hover "+" create hint */}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-30 text-primary text-lg font-light transition-opacity pointer-events-none">
                +
              </span>
              {d}
              {/* Priority dots */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((p) => (
                    <span key={p} className={`w-1 h-1 rounded-full ${DOT_COLORS[p]}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <button
        onClick={() => {
          const t = new Date();
          setYear(t.getFullYear());
          setMonth(t.getMonth());
          onSelectDate(null);
        }}
        className="mt-2 w-full text-[11px] text-muted-foreground hover:text-foreground rounded py-0.5 transition-colors"
      >
        回到今天
      </button>
    </div>
  );
};
