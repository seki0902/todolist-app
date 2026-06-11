import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { TaskRow } from '../../shared/types/database';

interface CalendarViewProps {
  tasks: TaskRow[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (taskId: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onDateClick, onEventClick }) => {
  const events = useMemo(() => {
    return tasks
      .filter((t) => t.due_time)
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: new Date(t.due_time!).toISOString().slice(0, 10),
        backgroundColor: t.priority === 1 ? '#ef4444' : t.priority === 2 ? '#f97316' : '#3b82f6',
        borderColor: 'transparent',
        textColor: '#fff',
        extendedProps: { priority: t.priority, status: t.status },
      }));
  }, [tasks]);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">日历视图</h2>
      <div className="rounded-xl border border-border bg-card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridDay,timeGridWeek,dayGridMonth',
          }}
          views={{
            timeGridDay: { titleFormat: { year: 'numeric', month: 'long', day: 'numeric' } },
            timeGridWeek: { titleFormat: { year: 'numeric', month: 'long', day: 'numeric' } },
          }}
          height="auto"
          events={events}
          locale="zh-cn"
          buttonText={{
            today: '今天',
            day: '日',
            week: '周',
            month: '月',
          }}
          dateClick={(info) => onDateClick?.(info.date)}
          eventClick={(info) => onEventClick?.(info.event.id)}
          eventContent={(arg) => (
            <div className="text-xs truncate px-1 py-0.5">
              {arg.event.title}
            </div>
          )}
        />
      </div>
    </div>
  );
};
