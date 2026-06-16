import React, { useMemo } from 'react';
import type { TaskRow } from '../../shared/types/database';
import { Priority } from '../../shared/types/database';
import { toLocalDateStr } from '../../shared/utils/date';

interface WeekStripProps {
  tasks: TaskRow[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

const DOT_COLORS: Record<Priority, string> = {
  [Priority.P1]: 'bg-red-500',
  [Priority.P2]: 'bg-orange-500',
  [Priority.P3]: 'bg-blue-500',
  [Priority.P4]: 'bg-gray-400',
};

function getPrioritiesForDate(tasks: TaskRow[], dateStr: string): Priority[] {
  const priorities = tasks
    .filter((t) => t.target_date === dateStr)
    .map((t) => t.priority);
  return [...new Set(priorities)].slice(0, 4);
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  tasks,
  selectedDate,
  onSelectDate,
}) => {
  const [weekOffset, setWeekOffset] = React.useState(0);

  const today = new Date();
  const todayStr = toLocalDateStr(today);

  const weekStart = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    thisMonday.setDate(thisMonday.getDate() + weekOffset * 7);
    return thisMonday;
  }, [weekOffset]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${fmt(weekStart)} — ${fmt(end)}`;
  }, [weekStart]);

  // Pre-compute dots for all 7 days
  const dotsMap = useMemo(() => {
    const map = new Map<string, Priority[]>();
    for (const day of days) {
      const dateStr = toLocalDateStr(day);
      map.set(dateStr, getPrioritiesForDate(tasks, dateStr));
    }
    return map;
  }, [tasks, days]);

  const handleDateClick = (d: Date) => {
    const dateStr = toLocalDateStr(d);
    if (dateStr === selectedDate) {
      onSelectDate(null);
    } else {
      onSelectDate(dateStr);
    }
  };

  return (
    <div className="px-6 py-3 border-b border-border bg-background/50">
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="text-xs text-muted-foreground hover:text-foreground rounded px-2 py-0.5 transition-colors"
        >
          ← 前一周
        </button>
        <span className="text-xs font-semibold text-foreground">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="text-xs text-muted-foreground hover:text-foreground rounded px-2 py-0.5 transition-colors"
        >
          后一周 →
        </button>
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dateStr = toLocalDateStr(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dots = dotsMap.get(dateStr) || [];
          const weekday = WEEKDAYS_ZH[day.getDay() === 0 ? 6 : day.getDay() - 1]; // Convert Sun=0 to Mon=0

          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(day)}
              className={`flex flex-col items-center rounded-lg py-2 px-1 text-xs transition-colors ${
                isSelected
                  ? 'bg-primary/20 text-primary font-semibold ring-1 ring-primary/40'
                  : isToday
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-accent'
              }`}
            >
              <span className="text-[10px] text-muted-foreground">{weekday}</span>
              <span className="text-xs mt-0.5">{day.getDate()}</span>
              {/* Priority dots */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dots.map((p) => (
                    <span
                      key={p}
                      className={`w-1 h-1 rounded-full ${DOT_COLORS[p]}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
