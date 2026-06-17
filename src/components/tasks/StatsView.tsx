import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { TaskRow } from '../../shared/types/database';
import { Priority, getPriorityLabel } from '../../shared/types/database';
import { useCategoryStore } from '../../store/useCategoryStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { toLocalDateStr } from '../../shared/utils/date';
import { MonthGrid } from './MonthGrid';

interface StatsViewProps {
  tasks: TaskRow[];
}

const PIE_COLORS = ['#ef4444', '#f97316', '#3b82f6', '#9ca3af'];

export const StatsView: React.FC<StatsViewProps> = ({ tasks }) => {
  const [activeTab, setActiveTab] = useState<'charts' | 'calendar'>('charts');
  const { categories } = useCategoryStore();
  // Subscribe to pomodoro history so stats re-render when a session completes
  const pomodoroHistory = usePomodoroStore((s) => s.history);

  const stats = useMemo(() => {
    const todayStr = toLocalDateStr(new Date());
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const done = tasks.filter((t) => t.progress >= 100 || t.status === 'done');
    const todayDone = done.filter((t) => t.target_date === todayStr);
    const weekDone = done.filter((t) => t.updated_at >= weekStart.getTime());
    const monthDone = done.filter((t) => t.updated_at >= monthStart.getTime());

    const priorityDist = [
      { name: getPriorityLabel(Priority.P1), value: tasks.filter((t) => t.priority === 1).length, color: '#ef4444' },
      { name: getPriorityLabel(Priority.P2), value: tasks.filter((t) => t.priority === 2).length, color: '#f97316' },
      { name: getPriorityLabel(Priority.P3), value: tasks.filter((t) => t.priority === 3).length, color: '#3b82f6' },
      { name: getPriorityLabel(Priority.P4), value: tasks.filter((t) => t.priority === 4).length, color: '#9ca3af' },
    ];

    const statusDist = [
      { name: '待开始', value: tasks.filter((t) => t.progress === 0 && t.status !== 'cancelled').length, color: '#9ca3af' },
      { name: '进行中', value: tasks.filter((t) => t.progress > 0 && t.progress < 100 && t.status !== 'cancelled').length, color: '#3b82f6' },
      { name: '已完成', value: tasks.filter((t) => t.progress >= 100 || t.status === 'done').length, color: '#10b981' },
      { name: '已归档', value: tasks.filter((t) => t.status === 'cancelled').length, color: '#6b7280' },
    ];

    // Category distribution
    const categoryDist = categories.map((cat) => ({
      name: cat.name,
      value: tasks.filter((t) => t.category_id === cat.id).length,
    })).filter((c) => c.value > 0);

    // Weekly trend: completions per day for the past 7 days
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay() + i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = done.filter((t) => t.updated_at >= dayStart && t.updated_at < dayEnd).length;
      return { name: `周${weekDays[i]}`, value: count };
    });

    // Pomodoro stats from reactive store subscription
    const totalCompletedPomodoros = pomodoroHistory.length;
    const totalFocusMinutes = pomodoroHistory.reduce((sum, r) => sum + r.duration, 0);

    return {
      total: tasks.length,
      done: done.length,
      todayDone: todayDone.length,
      weekDone: weekDone.length,
      monthDone: monthDone.length,
      totalPomodoros: totalCompletedPomodoros,
      donePomodoros: totalCompletedPomodoros,
      totalFocusMinutes,
      completionRate: tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0,
      priorityDist,
      statusDist,
      categoryDist,
      weekTrend,
    };
  }, [tasks, categories, pomodoroHistory]);

  return (
    <div className="p-6 space-y-6 overflow-y-auto absolute inset-0">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">数据统计</h2>
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary">
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'charts'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📊 图表
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📅 日历
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <div className="flex-1">
          <MonthGrid tasks={tasks} />
        </div>
      ) : (
        <>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '今日完成', value: stats.todayDone, color: 'text-emerald-500' },
          { label: '本周完成', value: stats.weekDone, color: 'text-blue-500' },
          { label: '本月完成', value: stats.monthDone, color: 'text-purple-500' },
          { label: '累计完成', value: stats.done, color: 'text-foreground' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '任务总数', value: stats.total },
          { label: '完成率', value: `${stats.completionRate}%` },
          { label: '累计番茄', value: stats.totalPomodoros },
          { label: '专注时长', value: `${stats.totalFocusMinutes}分钟` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">优先级分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={stats.priorityDist}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {stats.priorityDist.map((entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">状态分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.statusDist}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {stats.statusDist.map((entry, i) => (
                  <Cell key={i} fill={entry.color || 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Trend */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">本周完成趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.weekTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        {stats.categoryDist.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">分类分布</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.categoryDist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={50} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};
